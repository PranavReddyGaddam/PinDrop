"use client";

import { useState } from "react";
import { FiCheck, FiArrowRight } from "react-icons/fi";
import { commit, ApiError } from "@/lib/api";
import { getDemoUserId } from "@/lib/format";
import { money } from "@/lib/format";

type State = "idle" | "loading" | "done" | "full" | "error";

/**
 * Commits the current browser's demo user to the campaign. In the backend's mock
 * Stripe mode this needs only user_id + quantity — no card UI. (Stripe Elements is a
 * later slice; this component is the seam where it'll plug in.)
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
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setState("loading");
    setError(null);
    try {
      await commit(campaignId, { user_id: getDemoUserId(), quantity });
      setState("done");
      onCommitted?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setState("full");
      } else {
        setState("error");
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    }
  }

  if (state === "full" || disabled) {
    return (
      <button
        disabled
        className="w-full rounded-full bg-soft px-6 py-4 text-base font-semibold text-muted"
      >
        {state === "full" ? "Batch full — campaign closed early" : "Drop closed"}
      </button>
    );
  }

  if (state === "done") {
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
    <div>
      <button
        onClick={handleClick}
        disabled={state === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-lime px-6 py-4 text-base font-semibold text-lime-ink transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
      >
        {state === "loading" ? (
          "Committing…"
        ) : (
          <>
            {quantity > 1
              ? `Commit ${quantity} at ${money(unitPrice * quantity)}`
              : `Commit at ${money(unitPrice)}`}
            <FiArrowRight aria-hidden />
          </>
        )}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
