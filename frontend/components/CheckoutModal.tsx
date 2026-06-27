"use client";

import { useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { FiX, FiLock, FiCheck } from "react-icons/fi";
import {
  ApiError,
  commit,
  createPaymentIntent,
  type PaymentIntentResult,
} from "@/lib/api";
import { getDemoUserId, money } from "@/lib/format";
import { getStripe } from "@/lib/stripe";

/**
 * Full Stripe checkout for committing to a drop.
 *
 * Flow:
 *  1. Open -> POST /payment-intent (current price * qty) -> client_secret.
 *  2. Real test mode: render PaymentElement, confirm the card (manual capture =
 *     authorize/hold), then POST /commit with the confirmed payment_intent_id.
 *  3. Mock mode: no card UI; commit directly with the mock payment_intent_id.
 *
 * The card is only authorized here; the final (lowest) price is captured at settlement.
 */
export function CheckoutModal({
  campaignId,
  quantity,
  unitPrice,
  onClose,
  onCommitted,
}: {
  campaignId: string;
  quantity: number;
  unitPrice: number;
  onClose: () => void;
  onCommitted: () => void;
}) {
  const [intent, setIntent] = useState<PaymentIntentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create the PaymentIntent when the modal opens.
  useEffect(() => {
    let cancelled = false;
    createPaymentIntent(campaignId, { user_id: getDemoUserId(), quantity })
      .then((r) => {
        if (!cancelled) setIntent(r);
      })
      .catch((e) => {
        if (!cancelled)
          setError(
            e instanceof ApiError ? e.message : "Couldn't start checkout. Try again.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, quantity]);

  const total = unitPrice * quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="Close checkout"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-md bg-background p-7 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p className="font-script text-xl text-teal">secure your spot</p>
            <h2 className="font-serif text-2xl text-foreground">
              Commit {quantity > 1 ? `${quantity} units` : ""} at {money(unitPrice)}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Authorize {money(total)} now — you&apos;re charged the final, lower price
              when the drop closes.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-3 shrink-0 text-muted transition-colors hover:text-foreground"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="mb-4 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {!intent && !error && (
          <p className="py-8 text-center text-sm text-muted">Starting checkout…</p>
        )}

        {intent && intent.mock && (
          <MockCheckout
            campaignId={campaignId}
            quantity={quantity}
            paymentIntentId={intent.payment_intent_id}
            total={total}
            onCommitted={onCommitted}
            onError={setError}
          />
        )}

        {intent && !intent.mock && (
          <Elements
            stripe={getStripe()}
            options={{
              clientSecret: intent.client_secret,
              appearance: { theme: "flat", variables: { colorPrimary: "#0f766e" } },
            }}
          >
            <CardForm
              campaignId={campaignId}
              quantity={quantity}
              paymentIntentId={intent.payment_intent_id}
              total={total}
              onCommitted={onCommitted}
              onError={setError}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}

/** Real Stripe card form: confirms (authorizes) the card, then commits. */
function CardForm({
  campaignId,
  quantity,
  paymentIntentId,
  total,
  onCommitted,
  onError,
}: {
  campaignId: string;
  quantity: number;
  paymentIntentId: string;
  total: number;
  onCommitted: () => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handlePay() {
    if (!stripe || !elements) return;
    setBusy(true);
    onError("");

    // Confirm the card. With capture_method=manual this authorizes (holds) the funds;
    // capture happens server-side at settlement.
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message ?? "Card authorization failed.");
      setBusy(false);
      return;
    }

    // Card authorized — record the commitment against this PaymentIntent.
    try {
      await commit(campaignId, {
        user_id: getDemoUserId(),
        quantity,
        payment_intent_id: paymentIntentId,
      });
      setDone(true);
      onCommitted();
    } catch (e) {
      onError(
        e instanceof ApiError ? e.message : "Couldn't record your commitment.",
      );
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 bg-teal px-6 py-4 text-base font-semibold text-white">
        <FiCheck aria-hidden />
        You&apos;re in — authorized {money(total)}
      </div>
    );
  }

  return (
    <div>
      <PaymentElement />
      <button
        onClick={handlePay}
        disabled={busy || !stripe}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-4 text-base font-semibold text-lime-ink transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {busy ? "Authorizing…" : `Authorize ${money(total)}`}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
        <FiLock aria-hidden /> Test mode — use card 4242 4242 4242 4242
      </p>
    </div>
  );
}

/** Mock path: no card UI, commit straight against the mock PaymentIntent. */
function MockCheckout({
  campaignId,
  quantity,
  paymentIntentId,
  total,
  onCommitted,
  onError,
}: {
  campaignId: string;
  quantity: number;
  paymentIntentId: string;
  total: number;
  onCommitted: () => void;
  onError: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleCommit() {
    setBusy(true);
    onError("");
    try {
      await commit(campaignId, {
        user_id: getDemoUserId(),
        quantity,
        payment_intent_id: paymentIntentId,
      });
      setDone(true);
      onCommitted();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Couldn't commit.");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 bg-teal px-6 py-4 text-base font-semibold text-white">
        <FiCheck aria-hidden />
        You&apos;re in — authorized {money(total)}
      </div>
    );
  }

  return (
    <div>
      <p className="bg-soft px-4 py-3 text-sm text-muted">
        Stripe is in mock mode — no card needed for this demo. Click below to authorize.
      </p>
      <button
        onClick={handleCommit}
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-4 text-base font-semibold text-lime-ink transition-transform hover:scale-[1.01] disabled:opacity-60"
      >
        {busy ? "Committing…" : `Authorize ${money(total)}`}
      </button>
    </div>
  );
}
