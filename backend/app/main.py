"""Pindrop FastAPI backend.

Endpoints:
    GET  /healthz
    GET  /api/campaigns                  list open campaigns
    POST /api/campaigns                  create a campaign (+ tiers + control row)
    GET  /api/campaigns/{id}             live stats (polled by the UI)
    POST /api/campaigns/{id}/commit      commit to a campaign (cap-guarded)
    POST /api/campaigns/{id}/settle      settle a closed campaign (chunked)
"""

from __future__ import annotations

import datetime as dt
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import SessionLocal, get_session, init_db
from .models import Campaign, CampaignControl, Commitment, Order, PriceTier
from .occ import with_dsql_retry
from .pricing import get_current_price, price_from_tiers
from .schemas import (
    CampaignCreate,
    CampaignOut,
    CampaignStats,
    CampaignSummary,
    CommitIn,
    CommitOut,
    MyCommitment,
    PreviousDrop,
    SettleOut,
    TierOut,
)
from .stripe_adapter import stripe_client

SETTLEMENT_CHUNK_SIZE = 500  # stay well under DSQL's 10,000-row transaction limit

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they don't exist. Safe/idempotent on both local and DSQL.
    init_db()
    yield


app = FastAPI(title="Pindrop API", lifespan=lifespan)

# The frontend (later slice) will run on a different origin; allow it broadly for now.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def _as_aware(value: dt.datetime) -> dt.datetime:
    """Treat naive timestamps (e.g. from SQLite) as UTC so comparisons are safe."""
    if value.tzinfo is None:
        return value.replace(tzinfo=dt.timezone.utc)
    return value


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_session)) -> list[str]:
    """Distinct categories among open campaigns, for the browse nav."""
    rows = db.execute(
        select(Campaign.category)
        .where(Campaign.status == "open")
        .distinct()
        .order_by(Campaign.category)
    ).scalars().all()
    return list(rows)


@app.get("/api/campaigns", response_model=list[CampaignSummary])
def list_campaigns(
    category: str | None = None, db: Session = Depends(get_session)
) -> list[CampaignSummary]:
    query = select(Campaign).where(Campaign.status == "open")
    if category:
        query = query.where(Campaign.category == category)
    campaigns = (
        db.execute(query.order_by(Campaign.created_at.desc())).scalars().all()
    )
    if not campaigns:
        return []

    ids = [c.id for c in campaigns]

    # Batch the per-campaign reads into TWO set-based queries instead of ~3 round-trips
    # per campaign. On DSQL every query is a network hop, so this is the difference
    # between ~3s and well under a second for the homepage grid.
    counts = dict(
        db.execute(
            select(
                Commitment.campaign_id,
                func.coalesce(func.sum(Commitment.quantity), 0),
            )
            .where(
                Commitment.campaign_id.in_(ids),
                Commitment.status == "active",
            )
            .group_by(Commitment.campaign_id)
        ).all()
    )

    tiers_by_campaign: dict[uuid.UUID, list[tuple[int, float]]] = {}
    for cid, min_q, unit_price in db.execute(
        select(PriceTier.campaign_id, PriceTier.min_quantity, PriceTier.unit_price)
        .where(PriceTier.campaign_id.in_(ids))
        .order_by(PriceTier.campaign_id, PriceTier.min_quantity)
    ).all():
        tiers_by_campaign.setdefault(cid, []).append((int(min_q), float(unit_price)))

    summaries: list[CampaignSummary] = []
    for c in campaigns:
        seconds_remaining = max(
            0, int((_as_aware(c.closes_at) - _now()).total_seconds())
        )
        # The browse grid shows LIVE drops only. A drop whose deadline has passed (even if
        # its status is still "open") is finished -> it belongs in a product's drop history,
        # not the homepage. Closed/settled drops are filtered too.
        if seconds_remaining <= 0:
            continue
        tiers = tiers_by_campaign.get(c.id, [])
        pricing = price_from_tiers(int(counts.get(c.id, 0)), tiers)
        floor_price = tiers[0][1] if tiers else pricing.current_price
        summaries.append(
            CampaignSummary(
                campaign=CampaignOut.model_validate(c),
                current_count=pricing.current_count,
                current_price=pricing.current_price,
                floor_price=floor_price,
                seconds_remaining=seconds_remaining,
            )
        )
    return summaries


@app.get("/api/users/{user_id}/commitments", response_model=list[MyCommitment])
def my_commitments(
    user_id: uuid.UUID, db: Session = Depends(get_session)
) -> list[MyCommitment]:
    """Every active commitment for a (demo) user, with each campaign's live price.

    Drives the "My commitments" page. The current_price for a settled campaign is the
    locked final price, since the commitment count is frozen once it settles.
    """
    commitments = (
        db.execute(
            select(Commitment)
            .where(
                Commitment.user_id == user_id,
                Commitment.status == "active",
            )
            .order_by(Commitment.committed_at.desc())
        )
        .scalars()
        .all()
    )

    out: list[MyCommitment] = []
    for c in commitments:
        campaign = db.get(Campaign, c.campaign_id)
        if campaign is None:
            continue  # campaign deleted out from under the commitment; skip defensively
        pricing = get_current_price(db, c.campaign_id)
        out.append(
            MyCommitment(
                commitment_id=c.id,
                campaign=CampaignOut.model_validate(campaign),
                quantity=c.quantity,
                committed_at=c.committed_at,
                current_price=pricing.current_price,
                current_count=pricing.current_count,
                seconds_remaining=max(
                    0, int((_as_aware(campaign.closes_at) - _now()).total_seconds())
                ),
                settled=campaign.status == "settled",
            )
        )
    return out


@app.post("/api/campaigns", response_model=CampaignOut, status_code=201)
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_session)) -> Campaign:
    campaign = Campaign(
        seller_id=payload.seller_id,
        title=payload.title,
        description=payload.description,
        image_url=payload.image_url,
        category=payload.category,
        batch_cap=payload.batch_cap,
        opens_at=payload.opens_at,
        closes_at=payload.closes_at,
        status="open",
    )
    db.add(campaign)
    db.flush()  # assign campaign.id

    for tier in payload.tiers:
        db.add(
            PriceTier(
                campaign_id=campaign.id,
                min_quantity=tier.min_quantity,
                unit_price=tier.unit_price,
            )
        )
    db.add(CampaignControl(campaign_id=campaign.id, reserved_count=0))
    db.commit()
    db.refresh(campaign)
    return campaign


def _load_campaign(db: Session, campaign_id: uuid.UUID) -> Campaign:
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@app.get("/api/campaigns/{campaign_id}", response_model=CampaignStats)
def campaign_stats(campaign_id: uuid.UUID, db: Session = Depends(get_session)) -> CampaignStats:
    campaign = _load_campaign(db, campaign_id)
    control = db.get(CampaignControl, campaign_id)

    # Fetch the count and tiers once each, then compute pricing in Python (avoids the
    # extra tiers query get_current_price would do -- every query is a DSQL round-trip).
    count = int(
        db.execute(
            select(func.coalesce(func.sum(Commitment.quantity), 0)).where(
                Commitment.campaign_id == campaign_id,
                Commitment.status == "active",
            )
        ).scalar_one()
    )
    tier_rows = db.execute(
        select(PriceTier.min_quantity, PriceTier.unit_price)
        .where(PriceTier.campaign_id == campaign_id)
        .order_by(PriceTier.min_quantity)
    ).all()
    tiers = [(int(q), float(p)) for q, p in tier_rows]
    pricing = price_from_tiers(count, tiers)

    seconds_remaining = max(
        0, int((_as_aware(campaign.closes_at) - _now()).total_seconds())
    )
    return CampaignStats(
        campaign=CampaignOut.model_validate(campaign),
        current_count=pricing.current_count,
        current_price=pricing.current_price,
        next_tier_price=pricing.next_tier_price,
        next_tier_at=pricing.next_tier_at,
        seconds_remaining=seconds_remaining,
        reserved_count=control.reserved_count if control else 0,
        tiers=[
            TierOut(min_quantity=q, unit_price=p) for (q, p) in tiers
        ],
    )


@app.get("/api/campaigns/{campaign_id}/history", response_model=list[PreviousDrop])
def campaign_history(
    campaign_id: uuid.UUID, db: Session = Depends(get_session)
) -> list[PreviousDrop]:
    """Previous (finished) drops for the SAME product as this campaign.

    Products are grouped by exact title. A drop counts as "previous" if it's not this
    campaign and it has finished -- settled/closed, or its deadline has passed.
    """
    campaign = _load_campaign(db, campaign_id)

    siblings = (
        db.execute(
            select(Campaign)
            .where(
                Campaign.title == campaign.title,
                Campaign.id != campaign_id,
            )
            .order_by(Campaign.closes_at.desc())
        )
        .scalars()
        .all()
    )

    history: list[PreviousDrop] = []
    for s in siblings:
        finished = s.status != "open" or _now() > _as_aware(s.closes_at)
        if not finished:
            continue
        pricing = get_current_price(db, s.id)
        floor_tier = db.execute(
            select(PriceTier.unit_price)
            .where(PriceTier.campaign_id == s.id)
            .order_by(PriceTier.min_quantity)
            .limit(1)
        ).scalar_one_or_none()
        history.append(
            PreviousDrop(
                campaign_id=s.id,
                final_price=pricing.current_price,
                floor_price=float(floor_tier)
                if floor_tier is not None
                else pricing.current_price,
                committed=pricing.current_count,
                closed_at=s.closes_at,
            )
        )
    return history


@app.post("/api/campaigns/{campaign_id}/commit", response_model=CommitOut)
def commit(campaign_id: uuid.UUID, payload: CommitIn) -> CommitOut:
    # 1. Validate campaign state (read-only, no OCC risk).
    with SessionLocal() as db:
        campaign = _load_campaign(db, campaign_id)
        if campaign.status != "open":
            raise HTTPException(status_code=400, detail="Campaign is not open")
        if _now() > _as_aware(campaign.closes_at):
            raise HTTPException(status_code=400, detail="Campaign has closed")
        batch_cap = campaign.batch_cap
        pricing = get_current_price(db, campaign_id)

    unit_price = pricing.current_price

    # 2. Authorize payment at the current price (manual capture; captured at settle).
    intent = stripe_client.create_payment_intent(
        amount_cents=round(unit_price * payload.quantity * 100),
        metadata={"campaign_id": str(campaign_id), "user_id": str(payload.user_id)},
    )
    payment_intent_id = intent["id"]

    # 3. Write the commitment inside an OCC-retried transaction.
    #    SELECT ... FOR UPDATE on the single control row serializes the cap check.
    #    In DSQL, FOR UPDATE surfaces the conflict at commit -> loser gets 40001 and
    #    the whole closure re-runs via with_dsql_retry.
    def _do_commit() -> None:
        with SessionLocal() as db:
            control = db.execute(
                select(CampaignControl)
                .where(CampaignControl.campaign_id == campaign_id)
                .with_for_update()
            ).scalar_one_or_none()
            if control is None:
                raise HTTPException(status_code=500, detail="Campaign control row missing")

            if control.reserved_count + payload.quantity > batch_cap:
                raise HTTPException(status_code=409, detail="BATCH_FULL")

            # Append-only insert -- never update a shared counter for the count.
            db.add(
                Commitment(
                    campaign_id=campaign_id,
                    user_id=payload.user_id,
                    quantity=payload.quantity,
                    status="active",
                    payment_intent_id=payment_intent_id,
                )
            )
            # The control row's reserved_count is the cap guard, updated under the lock.
            control.reserved_count += payload.quantity
            db.commit()

    try:
        with_dsql_retry(_do_commit)
    except HTTPException:
        raise
    return CommitOut(
        success=True,
        authorized_unit_price=unit_price,
        payment_intent_id=payment_intent_id,
    )


@app.post("/api/campaigns/{campaign_id}/settle", response_model=SettleOut)
def settle(campaign_id: uuid.UUID) -> SettleOut:
    # Mark closed first, then settle. Compute the final (lowest reached) price.
    def _mark_settled() -> None:
        with SessionLocal() as db:
            campaign = _load_campaign(db, campaign_id)
            campaign.status = "settled"
            db.commit()

    with_dsql_retry(_mark_settled)

    with SessionLocal() as db:
        final_price = get_current_price(db, campaign_id).current_price
        commitments = (
            db.execute(
                select(Commitment).where(
                    Commitment.campaign_id == campaign_id,
                    Commitment.status == "active",
                )
            )
            .scalars()
            .all()
        )

    # Chunk to respect the 10,000-row transaction limit; each chunk is its own
    # OCC-retried transaction.
    total = len(commitments)
    for start in range(0, total, SETTLEMENT_CHUNK_SIZE):
        chunk = commitments[start : start + SETTLEMENT_CHUNK_SIZE]

        def _settle_chunk(chunk=chunk) -> None:  # bind chunk per iteration
            with SessionLocal() as db:
                for c in chunk:
                    if c.payment_intent_id:
                        stripe_client.capture_payment_intent(
                            c.payment_intent_id,
                            amount_to_capture_cents=round(final_price * c.quantity * 100),
                        )
                    db.add(
                        Order(
                            campaign_id=campaign_id,
                            user_id=c.user_id,
                            final_unit_price=final_price,
                            quantity=c.quantity,
                            stripe_payment_intent_id=c.payment_intent_id,
                        )
                    )
                db.commit()

        with_dsql_retry(_settle_chunk)

    return SettleOut(success=True, final_price=final_price, settled=total)
