"""Seed a multi-category marketplace of drops so the demo grid looks real.

Each product has ONE live drop (shown on the homepage grid) and, for some products, one
or more FINISHED prior drops (shown as "previous drops" history on the detail page).
Products are grouped by title, so a prior drop just shares the live drop's title with a
past `closes_at`.

The FIRST campaign is primed one commit below its first tier drop, so a single on-camera
commit triggers a visible price drop (the hero demo moment).

Usage (from backend/):
    venv/bin/python -m scripts.seed
"""

from __future__ import annotations

import datetime as dt
import uuid

from app.db import SessionLocal, init_db
from app.models import Campaign, CampaignControl, Commitment, Order, PriceTier, User

# Product images are served by the FRONTEND from its public/ dir (e.g. /SONY.webp),
# so image_url is a root-relative path resolved against the frontend origin.

# Each entry: title, category, desc, image, cap, closes_in_hours (live), tiers, seeded_count.
# Optional "history": list of finished prior drops, each:
#   {"seeded": N, "closed_ago_h": H}  -> a drop that closed H hours ago with N committed.
#   (Prior drops reuse the same cap + tiers as the live drop.)
SEED: list[dict] = [
    {
        "title": "Sony WH-1000XM5 Noise-Cancelling Headphones",
        "category": "Electronics",
        "seller": "AudioWorks",
        "desc": "Flagship over-ear ANC headphones. Group drop on a sealed pallet of 120 units.",
        "image": "/SONY.webp",
        "cap": 120,
        "closes_h": 72,
        "tiers": [(1, 329.0), (10, 299.0), (30, 269.0), (60, 239.0)],
        "seeded": 9,  # one below the 10-tier -> demo drop
        "history": [
            {"seeded": 64, "closed_ago_h": 24 * 14},  # last batch hit the 60-tier ($239)
            {"seeded": 31, "closed_ago_h": 24 * 38},
        ],
    },
    {
        "title": "Fellow Stagg EKG Electric Kettle",
        "category": "Home",
        "seller": "Brew Supply Co.",
        "desc": "Pour-over precision kettle. Matte black. Batch import drop.",
        "image": "/Kettle.jpg",
        "cap": 80,
        "closes_h": 36,
        "tiers": [(1, 165.0), (15, 145.0), (40, 129.0)],
        "seeded": 22,
        "history": [
            {"seeded": 44, "closed_ago_h": 24 * 20},  # reached $129
        ],
    },
    {
        "title": "Allbirds Wool Runner — Natural Grey",
        "category": "Apparel",
        "seller": "Sole Collective",
        "desc": "Merino wool everyday sneaker. Mixed-size run, ships in 5 days.",
        "image": "/Runners.webp",
        "cap": 200,
        "closes_h": 60,
        "tiers": [(1, 98.0), (25, 84.0), (75, 72.0), (150, 65.0)],
        "seeded": 33,
        "history": [
            {"seeded": 158, "closed_ago_h": 24 * 9},   # reached the floor ($65)
            {"seeded": 61, "closed_ago_h": 24 * 27},
        ],
    },
    {
        "title": "Ethiopia Yirgacheffe Natural — Batch #47",
        "category": "Coffee",
        "seller": "Blue Bottle Coffee",
        "desc": "Single-origin natural process. 60kg batch roasted to order. Ships within 5 days of close.",
        "image": "/Coffee.webp",
        "cap": 100,
        "closes_h": 30,
        "tiers": [(1, 50.0), (10, 42.0), (25, 35.0), (50, 29.0)],
        "seeded": 24,
        "history": [
            {"seeded": 52, "closed_ago_h": 24 * 11},   # reached $29
        ],
    },
    {
        "title": "Anker 737 Power Bank (24,000mAh)",
        "category": "Electronics",
        "seller": "ChargeHub",
        "desc": "140W fast-charging power bank with smart display. Bulk drop.",
        "image": "/Anker.avif",
        "cap": 150,
        "closes_h": 48,
        "tiers": [(1, 119.0), (20, 99.0), (50, 85.0)],
        "seeded": 14,
    },
    {
        "title": "Patagonia Better Sweater Fleece",
        "category": "Apparel",
        "seller": "Summit Outfitters",
        "desc": "Recycled-polyester fleece jacket. Pre-season batch drop.",
        "image": "/Patagonia.webp",
        "cap": 90,
        "closes_h": 48,
        "tiers": [(1, 139.0), (15, 122.0), (45, 109.0)],
        "seeded": 12,
        "history": [
            {"seeded": 47, "closed_ago_h": 24 * 16},   # reached $109
        ],
    },
    {
        "title": "LEGO Botanical Collection — Orchid",
        "category": "Toys",
        "seller": "BrickBatch",
        "desc": "608-piece display set. Group buy on a wholesale case.",
        "image": "/LEGO.avif",
        "cap": 60,
        "closes_h": 40,
        "tiers": [(1, 49.99), (12, 43.0), (30, 38.0)],
        "seeded": 7,
    },
]


def _wipe(db) -> None:
    """Delete all seedable rows so re-running seed is idempotent (no duplicate drops).

    Order doesn't matter -- there are no FK constraints (DSQL). Done as plain DELETEs.
    """
    from sqlalchemy import delete

    for model in (Order, Commitment, CampaignControl, PriceTier, Campaign, User):
        db.execute(delete(model))
    db.commit()


def seed() -> None:
    init_db()
    with SessionLocal() as db:
        _wipe(db)
        now = dt.datetime.now(dt.timezone.utc)

        # IDs are assigned in Python (uuid4) so we never need per-row flush() round-trips
        # to read back a generated key -- on DSQL each flush is a network hop, which made
        # the old seed take minutes. We build every row in memory, then bulk-insert per
        # campaign and commit, so drops appear progressively and fast.

        def build_drop(seller_id, item, *, opens_at, closes_at, status, seeded):
            """Return (campaign, [rows...]) for one drop, all with pre-assigned UUIDs."""
            cid = uuid.uuid4()
            campaign = Campaign(
                id=cid,
                seller_id=seller_id,
                title=item["title"],
                description=item["desc"],
                image_url=item["image"],
                category=item["category"],
                batch_cap=item["cap"],
                opens_at=opens_at,
                closes_at=closes_at,
                status=status,
            )
            rows: list = [
                PriceTier(
                    id=uuid.uuid4(), campaign_id=cid, min_quantity=q, unit_price=p
                )
                for (q, p) in item["tiers"]
            ]
            for _ in range(seeded):
                uid = uuid.uuid4()
                rows.append(
                    User(id=uid, name="Buyer", email=f"buyer-{uid}@example.com")
                )
                rows.append(
                    Commitment(
                        id=uuid.uuid4(),
                        campaign_id=cid,
                        user_id=uid,
                        quantity=1,
                        status="active",
                    )
                )
            rows.append(CampaignControl(campaign_id=cid, reserved_count=seeded))
            return campaign, rows

        first_id = None
        for idx, item in enumerate(SEED):
            seller = User(
                id=uuid.uuid4(), name=item["seller"], email=f"seller{idx}@example.com"
            )
            batch: list = [seller]

            # Finished prior drops (history).
            for h in item.get("history", []):
                closed_at = now - dt.timedelta(hours=h["closed_ago_h"])
                campaign, rows = build_drop(
                    seller.id,
                    item,
                    opens_at=closed_at - dt.timedelta(hours=item["closes_h"]),
                    closes_at=closed_at,
                    status="settled",
                    seeded=h["seeded"],
                )
                batch.append(campaign)
                batch.extend(rows)

            # The live drop.
            campaign, rows = build_drop(
                seller.id,
                item,
                opens_at=now,
                closes_at=now + dt.timedelta(hours=item["closes_h"]),
                status="open",
                seeded=item["seeded"],
            )
            if first_id is None:
                first_id = campaign.id
            batch.append(campaign)
            batch.extend(rows)

            # One bulk insert + commit per product -> fast, and drops show up as we go.
            db.bulk_save_objects(batch)
            db.commit()
            print(f"  seeded {item['title'][:40]}")

        live_n = len(SEED)
        hist_n = sum(len(i.get("history", [])) for i in SEED)
        print(f"Seeded {live_n} live drops + {hist_n} finished prior drops.")
        print(f"Demo campaign (one commit below first drop): {first_id}")


if __name__ == "__main__":
    seed()
