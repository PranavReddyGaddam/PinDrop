"""Pydantic request/response models for the API."""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field


class TierIn(BaseModel):
    min_quantity: int = Field(ge=1)
    unit_price: float = Field(gt=0)


class CampaignCreate(BaseModel):
    seller_id: uuid.UUID
    title: str
    description: str | None = None
    image_url: str | None = None
    category: str = "Other"
    batch_cap: int = Field(gt=0)
    opens_at: dt.datetime
    closes_at: dt.datetime
    tiers: list[TierIn] = Field(min_length=1)


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    seller_id: uuid.UUID
    title: str
    description: str | None
    image_url: str | None
    category: str
    batch_cap: int
    opens_at: dt.datetime
    closes_at: dt.datetime
    status: str


class TierOut(BaseModel):
    min_quantity: int
    unit_price: float


class CampaignStats(BaseModel):
    campaign: CampaignOut
    current_count: int
    current_price: float
    next_tier_price: float | None
    next_tier_at: int | None
    seconds_remaining: int
    reserved_count: int
    tiers: list[TierOut]


class CampaignSummary(BaseModel):
    """Lightweight card data for the homepage grid — campaign + live price snapshot."""

    campaign: CampaignOut
    current_count: int
    current_price: float
    floor_price: float
    seconds_remaining: int


class PaymentIntentIn(BaseModel):
    user_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)


class PaymentIntentOut(BaseModel):
    """Returned to the frontend so Stripe.js can confirm the card (test mode)."""

    client_secret: str
    payment_intent_id: str
    amount: int  # cents, current price * quantity
    unit_price: float
    mock: bool  # true when STRIPE_MODE=mock -> frontend skips real card UI


class CommitIn(BaseModel):
    user_id: uuid.UUID
    quantity: int = Field(default=1, ge=1)
    # When the frontend has already created + confirmed a PaymentIntent (real Stripe
    # test flow), it passes that id here. If omitted, the backend creates one itself
    # (mock mode, or the no-card demo path).
    payment_intent_id: str | None = None


class CommitOut(BaseModel):
    success: bool
    authorized_unit_price: float
    payment_intent_id: str | None


class UncommitIn(BaseModel):
    user_id: uuid.UUID


class UncommitOut(BaseModel):
    success: bool
    cancelled: int  # number of commitment rows cancelled
    quantity_released: int  # total units returned to the batch


class SetQuantityIn(BaseModel):
    user_id: uuid.UUID
    quantity: int = Field(ge=0)  # the new TOTAL committed quantity (0 = leave the drop)


class SetQuantityOut(BaseModel):
    success: bool
    quantity: int  # the resulting total committed quantity


class SettleOut(BaseModel):
    success: bool
    final_price: float
    settled: int


class PreviousDrop(BaseModel):
    """A finished drop for the same product, shown as history on the detail page."""

    campaign_id: uuid.UUID
    final_price: float  # lowest tier reached at close
    floor_price: float  # the starting (highest) tier, for the strike-through
    committed: int
    closed_at: dt.datetime  # when the drop ended (closes_at)


class MyCommitment(BaseModel):
    """One row in the buyer's "my commitments" view — the commitment joined with the
    campaign's live (or settled-final) price snapshot."""

    commitment_id: uuid.UUID
    campaign: CampaignOut
    quantity: int
    committed_at: dt.datetime
    current_price: float  # live price now (or the locked final price if settled)
    current_count: int  # how many committed so far (drives the live price)
    seconds_remaining: int
    settled: bool
