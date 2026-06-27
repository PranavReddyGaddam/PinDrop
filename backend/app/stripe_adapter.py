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
        pid = f"pi_mock_{uuid.uuid4().hex[:24]}"
        return {
            "id": pid,
            "status": "requires_capture",
            "amount": amount_cents,
            "metadata": metadata or {},
            # A fake client_secret so the frontend mock path has the same shape.
            "client_secret": f"{pid}_secret_{uuid.uuid4().hex[:16]}",
        }

    def retrieve_payment_intent(self, payment_intent_id: str) -> dict[str, Any]:
        return {"id": payment_intent_id, "status": "requires_capture"}

    def cancel_payment_intent(self, payment_intent_id: str) -> dict[str, Any]:
        return {"id": payment_intent_id, "status": "canceled"}

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
        # Manual capture: the card is authorized (held) now on the client via the
        # returned client_secret, then captured at the final price during settlement.
        # automatic_payment_methods lets the frontend PaymentElement pick the method.
        intent = self._stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            capture_method="manual",
            metadata=metadata or {},
            automatic_payment_methods={"enabled": True},
        )
        return {
            "id": intent.id,
            "status": intent.status,
            "client_secret": intent.client_secret,
        }

    def retrieve_payment_intent(self, payment_intent_id: str) -> dict[str, Any]:
        intent = self._stripe.PaymentIntent.retrieve(payment_intent_id)
        return {"id": intent.id, "status": intent.status, "amount": intent.amount}

    def capture_payment_intent(
        self, payment_intent_id: str, amount_to_capture_cents: int
    ) -> dict[str, Any]:
        intent = self._stripe.PaymentIntent.capture(
            payment_intent_id, amount_to_capture=amount_to_capture_cents
        )
        return {"id": intent.id, "status": intent.status}

    def cancel_payment_intent(self, payment_intent_id: str) -> dict[str, Any]:
        # Releases the authorization hold (manual-capture intents) when a buyer
        # uncommits before settlement.
        intent = self._stripe.PaymentIntent.cancel(payment_intent_id)
        return {"id": intent.id, "status": intent.status}


def _build_stripe() -> MockStripe | LiveStripe:
    if config.STRIPE_MODE == "test" and config.STRIPE_SECRET_KEY:
        return LiveStripe(config.STRIPE_SECRET_KEY)
    return MockStripe()


stripe_client: MockStripe | LiveStripe = _build_stripe()
