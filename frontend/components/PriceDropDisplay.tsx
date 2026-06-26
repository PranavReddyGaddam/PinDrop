"use client";

import { useEffect, useRef, useState } from "react";
import {
  FiUsers,
  FiClock,
  FiArrowUpRight,
  FiShoppingBag,
  FiLock,
  FiMinus,
  FiPlus,
} from "react-icons/fi";
import { getCampaignStats, settle, ApiError, type CampaignStats } from "@/lib/api";
import { money } from "@/lib/format";
import { Countdown } from "./Countdown";
import { TierLadder } from "./TierLadder";
import { CommitButton } from "./CommitButton";
import { useCart } from "./cart/CartContext";

const POLL_MS = 2000;

/**
 * The hero live panel. Seeds from server-rendered `initial` stats, then polls every 2s.
 * When current_price drops, flashes the price number (the on-camera moment).
 */
export function PriceDropDisplay({ initial }: { initial: CampaignStats }) {
  const [stats, setStats] = useState<CampaignStats>(initial);
  const [flash, setFlash] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const prevPrice = useRef(initial.current_price);
  const cart = useCart();

  async function handleSettle() {
    setSettling(true);
    setSettleError(null);
    try {
      await settle(initial.campaign.id);
      await refresh();
    } catch (err) {
      setSettleError(
        err instanceof ApiError ? err.message : "Couldn't settle this drop.",
      );
    } finally {
      setSettling(false);
    }
  }

  async function refresh() {
    try {
      const next = await getCampaignStats(initial.campaign.id);
      setStats(next);
    } catch {
      /* keep last good stats on a transient error */
    }
  }

  // Poll loop.
  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger the flash when the price actually changes.
  useEffect(() => {
    if (stats.current_price !== prevPrice.current) {
      prevPrice.current = stats.current_price;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      return () => clearTimeout(t);
    }
  }, [stats.current_price]);

  const {
    current_price,
    current_count,
    next_tier_price,
    next_tier_at,
    seconds_remaining,
    tiers,
  } = stats;
  const { batch_cap, title, status, closes_at, image_url } = stats.campaign;
  // Backend stores naive UTC timestamps; normalize to UTC so the Date parses correctly
  // regardless of the viewer's timezone.
  const deadline = new Date(
    closes_at.endsWith("Z") || closes_at.includes("+") ? closes_at : `${closes_at}Z`,
  ).getTime();

  // Units still available in the batch — caps the quantity stepper (min 1 so the
  // controls stay usable even on a nearly-full drop).
  const maxQty = Math.max(1, batch_cap - current_count);

  const peopleToNext =
    next_tier_at != null ? Math.max(0, next_tier_at - current_count) : 0;
  const savedFromFloor =
    tiers.length > 0 ? tiers[0].unit_price - current_price : 0;

  // Progress toward the next tier (or full bar if at the lowest tier).
  const progressPct = (() => {
    if (next_tier_at == null) return 100;
    // base = current tier threshold; span to next tier threshold.
    const unlocked = tiers.filter((t) => current_count >= t.min_quantity);
    const base = unlocked.length ? unlocked[unlocked.length - 1].min_quantity : 0;
    const span = next_tier_at - base;
    return span > 0
      ? Math.min(100, Math.round(((current_count - base) / span) * 100))
      : 0;
  })();

  const settled = status === "settled";
  const closed = status !== "open" || seconds_remaining <= 0;

  return (
    <div className="flex flex-col gap-5">
      {/* DROP LIVE badge */}
      <div className="flex items-center gap-2">
        {settled ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-teal px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
            <FiLock className="h-3 w-3" aria-hidden />
            Settled — price locked
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-lime px-3 py-1 text-xs font-semibold uppercase tracking-wide text-lime-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-ink animate-live-dot" />
            {closed ? "Drop closed" : "Drop live"}
          </span>
        )}
      </div>

      {/* Title (serif) */}
      <h1 className="font-serif text-3xl leading-tight text-teal sm:text-4xl">
        {title}
      </h1>

      {/* The price — the loudest thing on the page (sized to leave room for the
          recruit hook + progress + CTAs above the fold) */}
      <div>
        <div
          className={`font-serif text-5xl font-semibold text-teal sm:text-[3.25rem] ${
            flash ? "animate-price-drop" : ""
          }`}
        >
          {money(current_price)}
        </div>
        {savedFromFloor > 0 && (
          <div className="mt-2 text-base text-muted">
            <span className="line-through">{money(tiers[0].unit_price)}</span>{" "}
            <span className="font-medium text-teal">
              {settled ? "locked in" : "you save"} {money(savedFromFloor)}
            </span>
          </div>
        )}
        {settled && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-teal">
            <FiLock className="h-3.5 w-3.5" aria-hidden />
            Final price — every buyer pays this.
          </p>
        )}
      </div>

      {/* The recruit hook */}
      {next_tier_price != null && peopleToNext > 0 && !closed && (
        <p className="text-lg text-foreground">
          <span className="font-semibold">{peopleToNext} more</span>{" "}
          {peopleToNext === 1 ? "person" : "people"} ={" "}
          <span className="font-semibold text-teal">
            {money(next_tier_price)} for everyone
          </span>
        </p>
      )}

      {/* Progress to next tier */}
      <div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-hairline">
          <div
            className="h-full rounded-full bg-teal transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <FiUsers aria-hidden className="text-muted" />
            {current_count} committed
          </span>
          <span>
            {current_count} / {batch_cap} units claimed
          </span>
        </div>
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-2 text-sm text-muted">
        <FiClock aria-hidden />
        <Countdown deadline={deadline} /> left
      </div>

      {settled ? (
        /* Settled: no more commits — the price is locked for everyone. */
        <div className="flex items-center justify-center gap-2 rounded-full bg-soft px-6 py-3.5 text-base font-medium text-teal">
          <FiLock aria-hidden />
          This drop has settled at {money(current_price)}
        </div>
      ) : (
        <>
          {/* Quantity stepper */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-foreground">Quantity</span>
              <p className="text-xs text-muted">{maxQty} available</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={closed || qty <= 1}
                aria-label="Decrease quantity"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-teal hover:text-teal disabled:opacity-40"
              >
                <FiMinus className="h-4 w-4" aria-hidden />
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={maxQty}
                value={qty}
                disabled={closed}
                aria-label="Quantity"
                onChange={(e) => {
                  // Allow the field to be empty mid-typing; clamp on blur.
                  const v = e.target.value;
                  if (v === "") {
                    setQty(1);
                    return;
                  }
                  const n = parseInt(v, 10);
                  if (!Number.isNaN(n)) setQty(Math.min(maxQty, Math.max(1, n)));
                }}
                onBlur={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setQty(Number.isNaN(n) ? 1 : Math.min(maxQty, Math.max(1, n)));
                }}
                className="h-10 w-16 rounded-lg border border-hairline text-center text-lg font-semibold tabular-nums text-foreground outline-none transition-colors focus:border-teal disabled:opacity-40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                disabled={closed || qty >= maxQty}
                aria-label="Increase quantity"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-hairline text-foreground transition-colors hover:border-teal hover:text-teal disabled:opacity-40"
              >
                <FiPlus className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Commit CTA */}
          <CommitButton
            campaignId={initial.campaign.id}
            unitPrice={current_price}
            quantity={qty}
            disabled={closed}
            onCommitted={refresh}
          />

          {/* Add to cart */}
          <button
            onClick={() =>
              cart.add(
                {
                  campaignId: initial.campaign.id,
                  title,
                  imageUrl: image_url,
                  unitPrice: current_price,
                },
                qty,
              )
            }
            disabled={closed}
            className="-mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-hairline px-6 py-3.5 text-base font-medium text-foreground transition-colors hover:border-teal hover:text-teal disabled:opacity-50"
          >
            <FiShoppingBag aria-hidden />
            Add to cart
          </button>

          <p className="-mt-1 flex items-center justify-center gap-1 text-sm text-muted">
            Share to drop the price
            <FiArrowUpRight aria-hidden />
          </p>

          {/* Settle now (demo control): lock the final price for all committed buyers. */}
          <div className="-mt-1 border-t border-hairline pt-4">
            <button
              onClick={handleSettle}
              disabled={settling}
              className="flex w-full items-center justify-center gap-2 text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-teal hover:underline disabled:opacity-50"
            >
              <FiLock aria-hidden />
              {settling ? "Settling…" : "Settle now (lock the price)"}
            </button>
            {settleError && (
              <p className="mt-2 text-center text-sm text-red-600">
                {settleError}
              </p>
            )}
          </div>
        </>
      )}

      {/* Tier ladder */}
      <div className="border-t border-hairline pt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
          Price tiers
        </p>
        <TierLadder tiers={tiers} currentCount={current_count} />
      </div>
    </div>
  );
}
