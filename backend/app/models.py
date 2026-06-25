"""SQLAlchemy models for Pindrop.

Aurora DSQL constraints that shape these models:
1. No foreign keys (DSQL does not support them) -> refs enforced in app code, no ForeignKey().
2. Primary keys are random UUIDs (gen_random_uuid()) -> avoids hot key ranges.
3. No triggers / views / stored procedures.
4. OCC: write conflicts return SQLSTATE 40001 -> retry (see app/occ.py).
5. 10,000-row transaction limit -> settlement chunks buyers into batches.

The `commitments` table is APPEND-ONLY: each commit is its own INSERT with a random
UUID key, so the live count is a conflict-free COUNT(*) aggregate. The only hot row in
the system is `campaign_control` (one row per campaign), locked with SELECT ... FOR
UPDATE at commit time to guard the batch cap.
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Integer, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import TIMESTAMP, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


# gen_random_uuid() runs server-side on Postgres/DSQL; the Python-side default keeps
# local inserts working identically without round-tripping for an id.
def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
        default=uuid.uuid4,
    )


def _now_col() -> Mapped[dt.datetime]:
    return mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str | None] = mapped_column(Text, nullable=True)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[dt.datetime] = _now_col()


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[uuid.UUID] = _uuid_pk()
    seller_id: Mapped[uuid.UUID] = mapped_column(  # app-enforced ref -> users.id
        UUID(as_uuid=True), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Marketplace category, e.g. "Electronics", "Home", "Apparel". Free-form text;
    # the UI offers a curated set but DSQL has no enum dependency.
    category: Mapped[str] = mapped_column(
        String(40), nullable=False, server_default=text("'Other'"), default="Other"
    )
    batch_cap: Mapped[int] = mapped_column(Integer, nullable=False)
    opens_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    closes_at: Mapped[dt.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    # open | settled | closed
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'open'"), default="open"
    )
    created_at: Mapped[dt.datetime] = _now_col()


class PriceTier(Base):
    __tablename__ = "price_tiers"

    id: Mapped[uuid.UUID] = _uuid_pk()
    campaign_id: Mapped[uuid.UUID] = mapped_column(  # app-enforced ref -> campaigns.id
        UUID(as_uuid=True), nullable=False
    )
    # tier unlocks when committed count >= min_quantity
    min_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)


class Commitment(Base):
    """APPEND-ONLY. Never UPDATE a shared counter row here.

    Live count = COUNT(*) WHERE status = 'active' for a campaign.
    """

    __tablename__ = "commitments"

    id: Mapped[uuid.UUID] = _uuid_pk()
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    quantity: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("1"), default=1
    )
    # active | cancelled
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=text("'active'"), default="active"
    )
    payment_intent_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    committed_at: Mapped[dt.datetime] = _now_col()


class CampaignControl(Base):
    """ONE ROW PER CAMPAIGN. The only hot row in the system.

    Used exclusively for the batch cap guard: SELECT ... FOR UPDATE before inserting a
    commitment. FOR UPDATE in DSQL does not block -- it surfaces the OCC conflict at
    commit time, so the losing transaction retries. Prevents overselling the last unit.
    """

    __tablename__ = "campaign_control"

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True
    )
    reserved_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0"), default=0
    )


class Order(Base):
    """Written at settlement. One row per committed buyer at the final price."""

    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = _uuid_pk()
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    final_unit_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    settled_at: Mapped[dt.datetime] = _now_col()
