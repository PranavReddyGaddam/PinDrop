"""Thin Stripe adapter with an env-toggled mock mode.

STRIPE_MODE=mock -> no network, returns fake PaymentIntent-shaped objects. Lets the
                    commit/settle flow run end-to-end with no Stripe key at all.
STRIPE_MODE=test -> real Stripe test mode (sk_test_... keys). Test mode is free: no
                    real money moves, no business verification required.

Both modes expose the same two operations the app needs:
    create_payment_intent(amount_cents, metadata) -> {"id", "status"}
    capture_payment_intent(payment_intent_id, amount_to_capture_cents) -> {"id", "status"}

We authorize at commit time (manual capture) and capture the final, possibly lower,
price at settlement.
"""

from __future__ import annotations

import uuid
from typing import Any

from . import config


class MockStripe:
    """In-memory stand-in. Records nothing persistent; just returns plausible shapes."""

    def create_payment_intent(
        self, amount_cents: int, metadata: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        return {
            "id": f"pi_mock_{uuid.uuid4().hex[:24]}",
            "status": "requires_capture",
            "amount": amount_cents,
            "metadata": metadata or {},
        }

    def capture_payment_intent(
        self, payment_intent_id: str, amount_to_capture_cents: int
    ) -> dict[str, Any]:
        return {
            "id": payment_intent_id,
            "status": "succeeded",
            "amount_received": amount_to_capture_cents,
        }


class LiveStripe:
    """Real Stripe test/live mode via the stripe SDK."""

    def __init__(self, secret_key: str) -> None:
        import stripe

        stripe.api_key = secret_key
        self._stripe = stripe

    def create_payment_intent(
        self, amount_cents: int, metadata: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        intent = self._stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            capture_method="manual",  # authorize now, capture at settlement
            metadata=metadata or {},
            # For a real client flow you'd attach a payment_method + confirm=True;
            # left to the frontend slice. Here we create the intent to authorize.
        )
        return {"id": intent.id, "status": intent.status}

    def capture_payment_intent(
        self, payment_intent_id: str, amount_to_capture_cents: int
    ) -> dict[str, Any]:
        intent = self._stripe.PaymentIntent.capture(
            payment_intent_id, amount_to_capture=amount_to_capture_cents
        )
        return {"id": intent.id, "status": intent.status}


def _build_stripe() -> MockStripe | LiveStripe:
    if config.STRIPE_MODE == "test" and config.STRIPE_SECRET_KEY:
        return LiveStripe(config.STRIPE_SECRET_KEY)
    return MockStripe()


stripe_client: MockStripe | LiveStripe = _build_stripe()
