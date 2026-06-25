"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiUsers, FiClock, FiArrowRight } from "react-icons/fi";
import { getMyCommitments, type MyCommitment } from "@/lib/api";
import { money, hms, getDemoUserId } from "@/lib/format";

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

  useEffect(() => {
    const userId = getDemoUserId();
    let active = true;

    async function load() {
      try {
        const items = await getMyCommitments(userId);
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
        <CommitmentRow key={c.commitment_id} c={c} />
      ))}
    </ul>
  );
}

function CommitmentRow({ c }: { c: MyCommitment }) {
  const { campaign } = c;
  const closed = c.settled || c.seconds_remaining <= 0;
  const lineTotal = c.current_price * c.quantity;

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
                  : `${hms(c.seconds_remaining)} left`}
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
      </div>
    </li>
  );
}
