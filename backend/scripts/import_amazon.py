"""Import a curated catalog of real products from the Amazon dataset into Pindrop.

Source files (kept OUTSIDE the repo / gitignored, in the project root):
    ../../amazon_products.csv     (asin,title,imgUrl,productURL,stars,reviews,price,
                                   listPrice,category_id,isBestSeller,boughtInLastMonth)
    ../../amazon_categories.csv   (id,category_name)

We DON'T load all 1.4M rows -- a drop is a time-boxed live event, the UI shows open
drops only, and seeding millions of rows to DSQL would take hours. Instead we pick a
balanced, demo-friendly sample of products that have a REAL discount (listPrice > price)
and a working HTTPS image (Amazon's m.media-amazon.com CDN serves over https, so we
hotlink -- no downloads, no repo bloat).

Each product becomes a live drop:
  - tier ladder built from listPrice (floor/original) down toward price (best),
  - committed count scaled from boughtInLastMonth so it looks real,
  - prices in USD (the dataset is already USD).

Usage (from backend/, with the same env that points at local or DSQL):
    venv/bin/python -m scripts.import_amazon
"""

from __future__ import annotations

import csv
import datetime as dt
import os
import random
import uuid

from app.db import SessionLocal, init_db
from app.models import Campaign, CampaignControl, Commitment, Order, PriceTier, User

# --- Tunables -------------------------------------------------------------
TOTAL_PRODUCTS = 200          # how many live drops to create
PER_CATEGORY_CAP = 16         # keep the catalog spread across many categories
MIN_PRICE, MAX_PRICE = 5.0, 1500.0
MAX_SEEDED_COMMITS = 80       # cap seeded commitments per drop (keep seed fast)
CSV_LIMIT_SCAN = 600_000      # how many CSV rows to scan while collecting candidates

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.abspath(os.path.join(_HERE, "..", ".."))
PRODUCTS_CSV = os.path.join(_ROOT, "amazon_products.csv")
CATEGORIES_CSV = os.path.join(_ROOT, "amazon_categories.csv")

csv.field_size_limit(10_000_000)


def _load_categories() -> dict[str, str]:
    cats: dict[str, str] = {}
    with open(CATEGORIES_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cats[row["id"]] = row["category_name"]
    return cats


def _tiers_from_prices(list_price: float, price: float) -> list[tuple[int, float]]:
    """Build a descending tier ladder: tier 1 = list price (everyone starts high),
    final tier = the discounted price (the floor reached if enough people join)."""
    list_price = round(list_price, 2)
    price = round(price, 2)
    # 3-4 tiers stepping from list_price down to price.
    steps = [(1, list_price)]
    mid1 = round(list_price - (list_price - price) * 0.45, 2)
    mid2 = round(list_price - (list_price - price) * 0.75, 2)
    steps.append((10, mid1))
    steps.append((30, mid2))
    steps.append((60, price))
    # Dedup any equal-price tiers (cheap items can collapse) while keeping order.
    seen: set[float] = set()
    out: list[tuple[int, float]] = []
    for q, p in steps:
        if p not in seen:
            out.append((q, p))
            seen.add(p)
    return out


def _seeded_count(bought_last_month: str) -> int:
    """Scale the seeded commitment count from boughtInLastMonth, capped + jittered."""
    try:
        n = int(float(bought_last_month or 0))
    except ValueError:
        n = 0
    # Compress big numbers, keep it under MAX so seeding stays fast.
    scaled = min(MAX_SEEDED_COMMITS, max(2, int(n ** 0.5)))
    return scaled + random.randint(-1, 3)


def _collect_candidates() -> list[dict]:
    cats = _load_categories()
    by_cat: dict[str, list[dict]] = {}
    scanned = 0
    with open(PRODUCTS_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            scanned += 1
            if scanned > CSV_LIMIT_SCAN:
                break
            try:
                price = float(row["price"])
                lst = float(row["listPrice"])
            except (ValueError, KeyError):
                continue
            img = row.get("imgUrl", "")
            if not img.startswith("https://"):
                continue
            if not (lst > price and MIN_PRICE < price < MAX_PRICE):
                continue
            cat = cats.get(row["category_id"], "Other")
            bucket = by_cat.setdefault(cat, [])
            if len(bucket) < PER_CATEGORY_CAP:
                bucket.append(
                    {
                        "title": row["title"][:200].strip(),
                        "category": cat,
                        "image": img,
                        "price": price,
                        "list": lst,
                        "bought": row.get("boughtInLastMonth", "0"),
                    }
                )
    # Round-robin across categories so the sample is well spread.
    picks: list[dict] = []
    buckets = [b for b in by_cat.values() if b]
    random.shuffle(buckets)
    idx = 0
    while len(picks) < TOTAL_PRODUCTS and buckets:
        b = buckets[idx % len(buckets)]
        if b:
            picks.append(b.pop())
        else:
            buckets.remove(b)
            continue
        idx += 1
        buckets = [b for b in buckets if b]
    return picks[:TOTAL_PRODUCTS]


def _wipe(db) -> None:
    from sqlalchemy import delete

    for model in (Order, Commitment, CampaignControl, PriceTier, Campaign, User):
        db.execute(delete(model))
    db.commit()


def run() -> None:
    if not os.path.exists(PRODUCTS_CSV):
        raise SystemExit(f"Missing {PRODUCTS_CSV}")

    print("Collecting candidates from the Amazon CSV...")
    products = _collect_candidates()
    print(f"  picked {len(products)} products across categories")

    init_db()
    with SessionLocal() as db:
        _wipe(db)
        now = dt.datetime.now(dt.timezone.utc)

        # One shared synthetic seller for the imported catalog.
        seller = User(id=uuid.uuid4(), name="Pindrop Market", email="market@pindrop.app")
        db.bulk_save_objects([seller])
        db.commit()

        BATCH = 20  # commit every N products so progress is visible + memory stays low
        buffer: list = []
        done = 0
        for p in products:
            cid = uuid.uuid4()
            tiers = _tiers_from_prices(p["list"], p["price"])
            seeded = _seeded_count(p["bought"])
            # closes between 12h and 96h out so countdowns vary.
            closes_h = random.randint(12, 96)

            buffer.append(
                Campaign(
                    id=cid,
                    seller_id=seller.id,
                    title=p["title"],
                    description=f"{p['category']} — group drop. Price falls as more people join.",
                    image_url=p["image"],
                    category=p["category"],
                    batch_cap=max(80, seeded + random.randint(40, 160)),
                    opens_at=now,
                    closes_at=now + dt.timedelta(hours=closes_h),
                    status="open",
                )
            )
            for q, price in tiers:
                buffer.append(
                    PriceTier(id=uuid.uuid4(), campaign_id=cid, min_quantity=q, unit_price=price)
                )
            for _ in range(seeded):
                uid = uuid.uuid4()
                buffer.append(User(id=uid, name="Buyer", email=f"buyer-{uid}@example.com"))
                buffer.append(
                    Commitment(id=uuid.uuid4(), campaign_id=cid, user_id=uid, quantity=1, status="active")
                )
            buffer.append(CampaignControl(campaign_id=cid, reserved_count=seeded))

            done += 1
            if done % BATCH == 0:
                db.bulk_save_objects(buffer)
                db.commit()
                buffer = []
                print(f"  imported {done}/{len(products)}")

        if buffer:
            db.bulk_save_objects(buffer)
            db.commit()

        print(f"Done. Imported {len(products)} live drops.")


if __name__ == "__main__":
    run()
