"""Drop-pricing computation: current price tier from the live commitment count.

The live count is a read-only COUNT(*) over active commitments -- conflict-free under
DSQL OCC because it reads a consistent snapshot, so no retry wrapper is needed here.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Commitment, PriceTier


@dataclass
class Pricing:
    current_count: int
    current_price: float
    next_tier_price: float | None
    next_tier_at: int | None


def price_from_tiers(
    count: int, tiers: list[tuple[int, float]]
) -> Pricing:
    """Pure pricing walk given a committed count and (min_quantity, unit_price) tiers
    sorted ascending by min_quantity. No DB access -- safe to call in a batch loop.
    """
    if not tiers:
        return Pricing(current_count=count, current_price=0.0, next_tier_price=None, next_tier_at=None)

    current_price = tiers[0][1]  # floor (min_quantity = 1)
    next_tier_price: float | None = None
    next_tier_at: int | None = None
    for min_q, unit_price in tiers:
        if count >= min_q:
            current_price = unit_price
        else:
            next_tier_price = unit_price
            next_tier_at = min_q
            break

    return Pricing(
        current_count=count,
        current_price=current_price,
        next_tier_price=next_tier_price,
        next_tier_at=next_tier_at,
    )


def get_current_price(db: Session, campaign_id: uuid.UUID) -> Pricing:
    # Live count = sum of active commitment quantities for this campaign.
    current_count = db.execute(
        select(func.coalesce(func.sum(Commitment.quantity), 0)).where(
            Commitment.campaign_id == campaign_id,
            Commitment.status == "active",
        )
    ).scalar_one()
    count = int(current_count)

    tiers = (
        db.execute(
            select(PriceTier.min_quantity, PriceTier.unit_price)
            .where(PriceTier.campaign_id == campaign_id)
            .order_by(PriceTier.min_quantity)
        )
        .all()
    )
    return price_from_tiers(count, [(int(q), float(p)) for q, p in tiers])
