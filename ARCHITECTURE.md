# Pindrop — Architecture

Pindrop is a **drop-pricing group-buy marketplace**: the unit price falls as more people
commit, and *every* committed buyer pays the lowest tier reached by the deadline. Sharing
a drop recruits more buyers, which drops the price for everyone already in.

The interesting engineering problem is doing this correctly on **Aurora DSQL** — a
serverless distributed SQL database with optimistic concurrency (no row locks), no foreign
keys, and a one-DDL-per-transaction rule — without overselling a batch or creating a hot
write row that serializes every commit.

---

## System overview

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI["Next.js 16 + React 19 UI<br/>(Vercel)"]
    end

    subgraph API["FastAPI backend (Python)"]
        R["REST routes<br/>/api/campaigns · /commit · /settle · /history"]
        P["pricing.py<br/>price_from_tiers()"]
        OCC["occ.py<br/>with_dsql_retry()  · SQLSTATE 40001"]
        STR["stripe_adapter.py<br/>mock | test"]
        DB["db.py<br/>engine switch · IAM token per connect"]
    end

    subgraph Cloud["AWS"]
        DSQL[("Aurora DSQL<br/>serverless distributed SQL")]
        IAM["IAM auth<br/>(boto3 token, ~15 min)"]
    end

    STRIPE["Stripe<br/>(manual-capture PaymentIntents)"]

    UI -- "poll every 2-5s (live prices)" --> R
    R --> P
    R --> OCC
    R --> STR
    OCC --> DB
    P --> DB
    DB -- "mint token on each physical connect" --> IAM
    DB -- "psycopg / SSL" --> DSQL
    STR -. "test mode" .-> STRIPE
```

**Frontend** (Next.js 16 / React 19 / Tailwind v4, deployed on Vercel) is a thin client
that polls the backend for live prices and renders the drop mechanic. No business logic
lives here.

**Backend** (FastAPI, standalone Python) owns all pricing, concurrency, and settlement.
It is driver-switchable: `DB_DRIVER=local` runs against SQLite/Postgres for dev,
`DB_DRIVER=dsql` runs against the real cluster. Stripe is behind an adapter
(`STRIPE_MODE=mock|test`) so the full flow runs with no key.

**Aurora DSQL** is the system of record. Connections authenticate with a short-lived IAM
token minted locally by boto3 on every physical connect (tokens expire ~15 min, so we
never cache them).

---

## Data model (no foreign keys — DSQL doesn't support them)

```mermaid
erDiagram
    users {
        uuid id PK
        text email
    }
    campaigns {
        uuid id PK
        uuid seller_id "app-enforced ref"
        text title "products grouped by title"
        text category
        int batch_cap
        timestamptz opens_at
        timestamptz closes_at
        text status "open|settled|closed"
    }
    price_tiers {
        uuid id PK
        uuid campaign_id
        int min_quantity
        numeric unit_price
    }
    commitments {
        uuid id PK "APPEND-ONLY"
        uuid campaign_id
        uuid user_id
        int quantity
        text status "active|cancelled"
        text payment_intent_id
    }
    campaign_control {
        uuid campaign_id PK "the ONE hot row"
        int reserved_count "cap guard"
    }
    orders {
        uuid id PK "written at settlement"
        uuid campaign_id
        uuid user_id
        numeric final_unit_price
    }

    campaigns ||..o{ price_tiers : "has"
    campaigns ||..o{ commitments : "receives"
    campaigns ||..|| campaign_control : "guarded by"
    campaigns ||..o{ orders : "settles into"
```

Relationships are enforced in application code, not by DDL (DSQL has no FK constraints).
All primary keys are random UUIDs (`gen_random_uuid()`) to avoid hot key ranges.

### The two key design choices

1. **`commitments` is append-only.** Each commit is its own INSERT with a random UUID
   key. The live count is a conflict-free `SUM(quantity)` aggregate over a consistent
   snapshot — reads never conflict, so the price display scales without contention.

2. **`campaign_control` is the *only* hot row.** It exists purely for the batch-cap
   guard. Under DSQL's OCC, `SELECT ... FOR UPDATE` on this row doesn't block — it surfaces
   the conflict at commit time, so the losing transaction retries. This prevents
   overselling the last unit without serializing every read.

---

## Commit flow (the cap-guarded write path)

```mermaid
sequenceDiagram
    participant U as Browser
    participant API as FastAPI /commit
    participant S as Stripe adapter
    participant DSQL as Aurora DSQL

    U->>API: POST /campaigns/{id}/commit {user_id, qty}
    API->>DSQL: read campaign (open? before closes_at?)
    API->>DSQL: current price = price_from_tiers(SUM(qty), tiers)
    API->>S: authorize PaymentIntent (manual capture)
    Note over API,DSQL: with_dsql_retry( ... )
    API->>DSQL: SELECT campaign_control FOR UPDATE
    alt reserved_count + qty > batch_cap
        API-->>U: 409 BATCH_FULL
    else room in batch
        API->>DSQL: INSERT commitment (append-only)
        API->>DSQL: reserved_count += qty
        API->>DSQL: COMMIT
        alt COMMIT returns SQLSTATE 40001 (OCC conflict)
            Note over API: backoff + jitter, re-run whole closure
        end
        API-->>U: 200 {authorized_unit_price}
    end
```

Every write transaction is wrapped in `with_dsql_retry()`: on a `40001` serialization
failure it re-runs the *entire* unit of work with exponential backoff + jitter (up to 5
attempts). Reads are outside the retry path because they can't conflict.

---

## Settlement flow (locking the final price)

```mermaid
sequenceDiagram
    participant API as FastAPI /settle
    participant DSQL as Aurora DSQL
    participant S as Stripe adapter

    API->>DSQL: status = "settled" (price now frozen)
    API->>DSQL: final_price = price_from_tiers(final count, tiers)
    API->>DSQL: load active commitments
    loop chunks of 500 (under DSQL's 10k-row tx limit)
        Note over API,DSQL: with_dsql_retry per chunk
        API->>S: capture each PaymentIntent at final_price
        API->>DSQL: INSERT orders at final_unit_price
        API->>DSQL: COMMIT chunk
    end
```

Once settled, the commitment count is frozen, so `price_from_tiers` returns the locked
final price for every buyer. Settlement is chunked at 500 rows per transaction to stay
well under DSQL's 10,000-row transaction limit; each chunk is independently OCC-retried.

---

## DSQL-specific accommodations (what the cluster forced us to change)

| DSQL constraint | How Pindrop handles it |
|---|---|
| **No foreign keys** | Refs enforced in app code; no `references()` / FK DDL. |
| **No `SAVEPOINT`** | psycopg's first-connect hstore probe uses SAVEPOINT → set `use_native_hstore=False` on the DSQL engine to skip it. |
| **One DDL statement per transaction** | `init_db()` creates each table in its own AUTOCOMMIT transaction (can't batch `create_all`). |
| **Optimistic concurrency (SQLSTATE 40001)** | `with_dsql_retry()` re-runs the whole transaction with exponential backoff + jitter. |
| **10,000-row transaction limit** | Settlement chunks buyers into batches of 500. |
| **IAM token auth (~15 min TTL)** | boto3 mints a fresh token on every physical connect (`do_connect` event); never cached. |
| **Every query is a network hop** | Hot endpoints batch reads into set-based queries (no N+1) and compute pricing in Python. |

---

## Tech stack

- **Frontend:** Next.js 16, React 19, Tailwind v4, deployed on **Vercel**
- **Backend:** FastAPI + SQLAlchemy 2.0 + psycopg 3 (Python 3.12)
- **Database:** **Amazon Aurora DSQL** (IAM auth via boto3)
- **Payments:** Stripe (manual-capture PaymentIntents), env-toggled mock/test adapter
- **Concurrency:** append-only commitments + single OCC-guarded control row per campaign
