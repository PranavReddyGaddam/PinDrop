"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FiUsers, FiClock, FiArrowRight, FiX, FiPlus, FiMinus } from "react-icons/fi";
import {
  getMyCommitments,
  uncommit,
  setQuantity,
  ApiError,
  type MyCommitment,
} from "@/lib/api";
import { money, humanTime, getDemoUserId } from "@/lib/format";
import { CheckoutModal } from "./CheckoutModal";

const POLL_MS = 5000;

type State =
  | { phase: "loading" }
  | { phase: "ready"; items: MyCommitment[] }
  | { phase: "error" };

/**
 * The buyer's "My drops" view. Reads the browser's demo user id (client-only), loads
 * their commitments, and polls so live prices keep falling on screen.
 */
export function MyCommitments() {
  const [state, setState] = useState<State>({ phase: "loading" });

  const reload = useCallback(async () => {
    try {
      const items = await getMyCommitments(getDemoUserId());
      setState({ phase: "ready", items });
    } catch {
      setState((s) => (s.phase === "ready" ? s : { phase: "error" }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const items = await getMyCommitments(getDemoUserId());
        if (active) setState({ phase: "ready", items });
      } catch {
        if (active) setState((s) => (s.phase === "ready" ? s : { phase: "error" }));
      }
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  if (state.phase === "loading") {
    return <p className="text-muted">Loading your drops…</p>;
  }

  if (state.phase === "error") {
    return (
      <p className="text-muted">
        Couldn&apos;t load your drops right now. Please refresh.
      </p>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="rounded-2xl border border-hairline bg-soft px-8 py-16 text-center">
        <p className="font-serif text-3xl text-teal">No drops yet</p>
        <p className="mx-auto mt-2 max-w-sm text-muted">
          Commit to a drop and you&apos;ll watch the price fall here as more
          people join.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 bg-lime px-6 py-3.5 text-sm font-semibold uppercase tracking-wide text-lime-ink transition-colors hover:brightness-95"
        >
          Browse drops
          <FiArrowRight aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-hairline">
      {state.items.map((c) => (
        <CommitmentRow key={c.commitment_id} c={c} onChanged={reload} />
      ))}
    </ul>
  );
}

function CommitmentRow({
  c,
  onChanged,
}: {
  c: MyCommitment;
  onChanged: () => void | Promise<void>;
}) {
  const { campaign } = c;
  const closed = c.settled || c.seconds_remaining <= 0;
  const lineTotal = c.current_price * c.quantity;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Editable TOTAL quantity. Seeded from the committed amount; max = current committed
  // plus the units still free in the batch (so you can raise it), min = 1 (use "Leave
  // drop" to go to 0).
  const available = Math.max(0, campaign.batch_cap - c.current_count);
  const maxTotal = c.quantity + available;
  const [draft, setDraft] = useState(c.quantity);
  const [checkout, setCheckout] = useState(false);
  const dirty = draft !== c.quantity;

  function clamp(n: number) {
    if (Number.isNaN(n)) return 1;
    return Math.min(maxTotal, Math.max(1, n));
  }

  async function applyChange() {
    if (!dirty) return;
    if (draft < c.quantity) {
      // Reduction applies instantly (releases the freed holds).
      setBusy(true);
      setErr(null);
      try {
        await setQuantity(campaign.id, { user_id: getDemoUserId(), quantity: draft });
        await onChanged();
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Couldn't update quantity.");
      } finally {
        setBusy(false);
      }
    } else {
      // Increase -> authorize the extra units through checkout.
      setCheckout(true);
    }
  }

  async function handleUncommit() {
    if (!confirm("Leave this drop? Your spot and price hold are released.")) return;
    setBusy(true);
    setErr(null);
    try {
      await uncommit(campaign.id, { user_id: getDemoUserId() });
      await onChanged();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't leave the drop.");
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center">
      <Link
        href={`/campaigns/${campaign.id}`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-soft">
          {campaign.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={campaign.image_url}
              alt={campaign.title}
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {campaign.category}
          </p>
          <h3 className="truncate font-serif text-xl text-teal hover:underline">
            {campaign.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <FiUsers aria-hidden />
              {c.current_count} committed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiClock aria-hidden />
              {c.settled
                ? "Settled"
                : closed
                  ? "Closed"
                  : `${humanTime(c.seconds_remaining)} left`}
            </span>
            {c.quantity > 1 && <span>Qty {c.quantity}</span>}
          </div>
        </div>
      </Link>

      <div className="shrink-0 text-left sm:text-right">
        <p className="font-serif text-2xl text-teal">{money(c.current_price)}</p>
        <p className="text-sm text-muted">
          {c.settled
            ? "final price locked"
            : closed
              ? "final price"
              : "current price — still dropping"}
        </p>
        {c.quantity > 1 && (
          <p className="mt-0.5 text-sm text-muted">
            {money(lineTotal)} total
          </p>
        )}
        {!closed && (
          <div className="mt-3 flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="text-sm text-muted">Qty</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDraft((q) => clamp(q - 1))}
                disabled={busy || draft <= 1}
                aria-label="Decrease quantity"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-teal hover:text-teal disabled:opacity-40"
              >
                <FiMinus className="h-3.5 w-3.5" aria-hidden />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={maxTotal}
                value={draft}
                disabled={busy}
                aria-label="Total quantity"
                onChange={(e) =>
                  setDraft(e.target.value === "" ? 1 : clamp(parseInt(e.target.value, 10)))
                }
                onBlur={(e) => setDraft(clamp(parseInt(e.target.value, 10)))}
                className="h-8 w-14 rounded-lg border border-hairline text-center text-base font-semibold tabular-nums text-foreground outline-none transition-colors focus:border-teal disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => setDraft((q) => clamp(q + 1))}
                disabled={busy || draft >= maxTotal}
                aria-label="Increase quantity"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-teal hover:text-teal disabled:opacity-40"
              >
                <FiPlus className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            {dirty && (
              <button
                onClick={applyChange}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-1.5 text-sm font-semibold text-lime-ink transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {busy ? "Updating…" : draft > c.quantity ? `Add ${draft - c.quantity}` : "Update"}
              </button>
            )}
          </div>
        )}

        {!closed && (
          <button
            onClick={handleUncommit}
            disabled={busy}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-red-600 hover:underline disabled:opacity-50 sm:justify-end"
          >
            <FiX aria-hidden className="h-3.5 w-3.5" />
            {busy ? "Leaving…" : "Leave drop"}
          </button>
        )}
        {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      </div>

      {checkout && (
        <CheckoutModal
          campaignId={campaign.id}
          quantity={Math.max(1, draft - c.quantity)}
          unitPrice={c.current_price}
          onClose={() => {
            setCheckout(false);
            setDraft(c.quantity);
          }}
          onCommitted={() => {
            setCheckout(false);
            void onChanged();
          }}
        />
      )}
    </li>
  );
}
