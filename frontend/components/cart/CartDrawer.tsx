"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiX,
  FiMinus,
  FiPlus,
  FiTrash2,
  FiArrowRight,
  FiCheck,
} from "react-icons/fi";
import { useCart } from "./CartContext";
import { commit, ApiError } from "@/lib/api";
import { money, getDemoUserId } from "@/lib/format";

// Spend threshold for the free-shipping nudge.
const FREE_SHIPPING_AT = 75;
// Premium easing: a smooth decelerating curve (easeOutExpo-ish).
const EASE = "ease-[cubic-bezier(0.16,1,0.3,1)]";

/** Slide-in cart sidebar with a smooth, premium open animation. */
export function CartDrawer() {
  const { items, isOpen, close, subtotal, count, setQuantity, remove, clear } =
    useCart();

  // Checkout flow: commit every cart item to its drop, then show a confirmation.
  type CheckoutState =
    | { phase: "idle" }
    | { phase: "processing" }
    | { phase: "done"; committed: number }
    | { phase: "error"; message: string };
  const [checkout, setCheckout] = useState<CheckoutState>({ phase: "idle" });

  // Lock body scroll while open; close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  // Reset the confirmation a moment after the drawer closes, so reopening is fresh.
  useEffect(() => {
    if (isOpen || checkout.phase === "idle") return;
    const t = setTimeout(() => setCheckout({ phase: "idle" }), 400);
    return () => clearTimeout(t);
  }, [isOpen, checkout.phase]);

  async function handleCheckout() {
    if (items.length === 0) return;
    setCheckout({ phase: "processing" });
    const userId = getDemoUserId();
    try {
      // Commit each cart line to its drop. Mock Stripe authorizes at the live price.
      for (const item of items) {
        await commit(item.campaignId, {
          user_id: userId,
          quantity: item.quantity,
        });
      }
      const committed = items.length;
      clear();
      setCheckout({ phase: "done", committed });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Something went wrong committing your drops. Please try again.";
      setCheckout({ phase: "error", message });
    }
  }

  const remaining = Math.max(0, FREE_SHIPPING_AT - subtotal);
  const shippingPct = Math.min(100, (subtotal / FREE_SHIPPING_AT) * 100);

  return (
    <>
      {/* Backdrop — fades in, with a soft blur for depth. */}
      <div
        onClick={close}
        aria-hidden
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px] transition-opacity duration-500 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel — slides in with a smooth decelerating ease. */}
      <aside
        role="dialog"
        aria-label="Cart"
        aria-modal="true"
        className={`fixed right-0 top-0 z-[70] flex h-full w-full max-w-sm flex-col bg-background shadow-2xl transition-transform duration-500 ${EASE} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-7 pt-7">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold uppercase tracking-wide text-teal">
              Your cart ({count})
            </h2>
            <button
              onClick={close}
              aria-label="Close cart"
              className="-mr-1 flex h-9 w-9 items-center justify-center text-foreground transition-colors hover:text-teal"
            >
              <FiX className="h-6 w-6" aria-hidden />
            </button>
          </div>

          {/* Free-shipping nudge + progress */}
          <div className="mt-4">
            <p className="text-center text-sm text-teal">
              {remaining > 0 ? (
                <>
                  Add <span className="font-semibold">{money(remaining)}</span> to
                  get free shipping
                </>
              ) : (
                <>You&apos;ve unlocked free shipping</>
              )}
            </p>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full border border-teal/40">
              <div
                className="h-full rounded-full bg-lime transition-[width] duration-500 ease-out"
                style={{ width: `${shippingPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Items / empty / confirmation state */}
        <div className="mt-2 flex-1 overflow-y-auto px-7">
          {checkout.phase === "done" ? (
            <div className="flex h-full flex-col items-center justify-center pb-24 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lime text-lime-ink">
                <FiCheck className="h-7 w-7" aria-hidden />
              </span>
              <p className="mt-6 font-serif text-3xl text-teal">
                You&apos;re in the drop
              </p>
              <p className="mt-2 max-w-xs text-sm text-muted">
                Committed to {checkout.committed}{" "}
                {checkout.committed === 1 ? "drop" : "drops"}. Your price keeps
                falling as more people join — track it in My drops.
              </p>
              <Link
                href="/commitments"
                onClick={close}
                className="mt-8 w-full bg-lime py-4 text-sm font-semibold uppercase tracking-wide text-lime-ink transition-colors hover:brightness-95"
              >
                View my drops
              </Link>
              <button
                onClick={close}
                className="mt-3 text-sm text-muted underline-offset-4 hover:underline"
              >
                Keep shopping
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center pb-24">
              <p className="text-center font-serif text-3xl text-teal">
                No Commitments Yet
              </p>
              <button
                onClick={close}
                className="mt-10 w-full bg-lime py-4 text-sm font-semibold uppercase tracking-wide text-lime-ink transition-colors hover:brightness-95"
              >
                Time to shop
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {items.map((item) => (
                <li key={item.campaignId} className="flex gap-4 py-5">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-soft">
                    {item.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/campaigns/${item.campaignId}`}
                      onClick={close}
                      className="font-serif text-base leading-snug text-teal hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-0.5 text-sm text-muted">
                      {money(item.unitPrice)} each
                    </p>

                    <div className="mt-2 flex items-center justify-between">
                      {/* Quantity stepper */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setQuantity(item.campaignId, item.quantity - 1)
                          }
                          aria-label="Decrease quantity"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-foreground hover:border-teal"
                        >
                          <FiMinus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            setQuantity(item.campaignId, item.quantity + 1)
                          }
                          aria-label="Increase quantity"
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-hairline text-foreground hover:border-teal"
                        >
                          <FiPlus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <button
                        onClick={() => remove(item.campaignId)}
                        aria-label="Remove item"
                        className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-foreground"
                      >
                        <FiTrash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-serif text-base text-foreground">
                    {money(item.unitPrice * item.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer / checkout */}
        {items.length > 0 && (
          <div className="border-t border-hairline px-7 py-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">Subtotal</span>
              <span className="font-serif text-2xl text-foreground">
                {money(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Final price locks at the lowest tier reached when each drop closes.
            </p>
            {checkout.phase === "error" && (
              <p className="mt-3 text-sm text-red-600">{checkout.message}</p>
            )}
            <button
              onClick={handleCheckout}
              disabled={checkout.phase === "processing"}
              className="mt-4 flex w-full items-center justify-center gap-2 bg-lime py-4 text-sm font-semibold uppercase tracking-wide text-lime-ink transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {checkout.phase === "processing" ? (
                "Committing…"
              ) : (
                <>
                  Commit to these drops
                  <FiArrowRight aria-hidden />
                </>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
