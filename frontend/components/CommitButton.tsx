"use client";

import { useState } from "react";
import { FiCheck, FiArrowRight } from "react-icons/fi";
import { money } from "@/lib/format";
import { CheckoutModal } from "./CheckoutModal";

type State = "idle" | "checkout" | "done";

/**
 * Opens the Stripe checkout for committing to a drop. The actual payment (authorize
 * now, capture at settle) happens in CheckoutModal; this is the trigger + done state.
 *
 * If the buyer changes the quantity after committing, the "done" state is dismissed and
 * the Commit button reappears so they can commit the new amount.
 */
export function CommitButton({
  campaignId,
  unitPrice,
  quantity = 1,
  disabled,
  onCommitted,
}: {
  campaignId: string;
  unitPrice: number;
  quantity?: number;
  disabled?: boolean;
  onCommitted?: () => void;
}) {
  const [state, setState] = useState<State>("idle");
  // The quantity captured in the last successful commit; used to re-show the button
  // when the stepper changes after committing.
  const [committedAtQty, setCommittedAtQty] = useState<number | null>(null);

  // Only show the "done" confirmation while the quantity still matches what was
  // committed; if the buyer changes the stepper, the Commit button reappears.
  const showDone = state === "done" && committedAtQty === quantity;

  if (disabled) {
    return (
      <button
        disabled
        className="w-full rounded-full bg-soft px-6 py-4 text-base font-semibold text-muted"
      >
        Drop closed
      </button>
    );
  }

  if (showDone) {
    return (
      <button
        disabled
        className="flex w-full items-center justify-center gap-2 rounded-full bg-teal px-6 py-4 text-base font-semibold text-white"
      >
        You&apos;re in — committed at {money(unitPrice)}
        <FiCheck aria-hidden />
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setState("checkout")}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-4 text-base font-semibold text-lime-ink transition-transform hover:scale-[1.01] active:scale-[0.99]"
      >
        {quantity > 1
          ? `Commit ${quantity} at ${money(unitPrice * quantity)}`
          : `Commit at ${money(unitPrice)}`}
        <FiArrowRight aria-hidden />
      </button>

      {state === "checkout" && (
        <CheckoutModal
          campaignId={campaignId}
          quantity={quantity}
          unitPrice={unitPrice}
          onClose={() => setState("idle")}
          onCommitted={() => {
            setCommittedAtQty(quantity);
            setState("done");
            onCommitted?.();
          }}
        />
      )}
    </>
  );
}
