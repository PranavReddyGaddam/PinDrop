import Link from "next/link";
import { FiClock } from "react-icons/fi";
import type { CampaignSummary } from "@/lib/api";
import { money, humanTime } from "@/lib/format";

/**
 * Drops-grid tile. Reading order is title -> price -> scarcity/time (the decision
 * drivers); the category is de-emphasized reference text.
 *
 * Accent roles are kept distinct so they stop competing:
 *   lime   = urgency / live signal  (the "ending soon / almost gone" badge)
 *   teal   = price & deal           (the % off badge, the price, the struck price)
 *
 * Badges only appear when they say something the neighbouring card doesn't:
 *   - status badge only for ENDING SOON / ALMOST GONE (no constant "DROP LIVE")
 *   - % off only when the discount is meaningful (>= 10%)
 */

const SOON_SECONDS = 24 * 3600; // "ending soon" threshold
const LOW_STOCK_RATIO = 0.1; // <=10% of the batch left -> "almost gone"
const MIN_BADGE_DISCOUNT = 10; // don't shout small discounts

export function CampaignCard({ summary }: { summary: CampaignSummary }) {
  const { campaign, current_price, floor_price, current_count, seconds_remaining } =
    summary;

  const dropped = current_price < floor_price;
  const closed = seconds_remaining <= 0 || campaign.status !== "open";
  const pctOff =
    dropped && floor_price > 0
      ? Math.round(((floor_price - current_price) / floor_price) * 100)
      : 0;

  const unitsLeft = Math.max(0, campaign.batch_cap - current_count);
  const lowStock =
    !closed && unitsLeft > 0 && unitsLeft <= campaign.batch_cap * LOW_STOCK_RATIO;
  const endingSoon = !closed && seconds_remaining <= SOON_SECONDS;

  // One status badge max, urgency-first. Lime is the urgency accent.
  const statusBadge = lowStock
    ? `Only ${unitsLeft} left`
    : endingSoon
      ? "Ending soon"
      : null;

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group relative flex h-full flex-col bg-background ring-1 ring-hairline transition-all duration-200 hover:-translate-y-0.5 hover:ring-2 hover:ring-teal hover:shadow-[0_12px_30px_-12px_rgba(8,81,76,0.25)]"
    >
      {/* Image — every product on the same soft neutral, same padding + object-contain,
          so they sit at comparable visual weight regardless of source aspect/background. */}
      <div className="relative aspect-square w-full overflow-hidden bg-soft p-6">
        {campaign.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.image_url}
            alt={campaign.title}
            loading="lazy"
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-script text-3xl text-muted">pindrop</span>
          </div>
        )}

        {/* Urgency badge (lime) — only when differentiated. */}
        {statusBadge && (
          <span className="absolute left-0 top-4 bg-lime px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.1em] text-lime-ink">
            {statusBadge}
          </span>
        )}

        {/* Discount badge (teal) — only when the discount is worth shouting. */}
        {pctOff >= MIN_BADGE_DISCOUNT && (
          <span className="absolute right-0 top-4 bg-teal px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-white">
            {pctOff}% off
          </span>
        )}
      </div>

      {/* Meta — title and price lead; category is small, muted, single-line reference. */}
      <div className="flex flex-1 flex-col border-t-2 border-foreground/90 p-5">
        <p className="truncate text-[0.62rem] font-medium uppercase tracking-[0.12em] text-muted">
          {campaign.category}
        </p>
        <h3 className="mt-1.5 line-clamp-2 font-serif text-lg leading-[1.3] text-foreground transition-colors group-hover:text-teal">
          {campaign.title}
        </h3>

        <div className="mt-auto pt-4">
          {/* Price — teal leads, struck floor sits quietly beside it. */}
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold text-teal">
              {money(current_price)}
            </span>
            {dropped && (
              <span className="text-sm text-muted line-through">
                {money(floor_price)}
              </span>
            )}
          </div>

          {/* Scarcity + time, spelled out. "N left" when stock is the urgent signal,
              else "N claimed" as social proof. Time in human units. */}
          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-xs font-medium text-muted">
            <span className={lowStock ? "text-teal" : undefined}>
              {lowStock ? `${unitsLeft} left` : `${current_count} claimed`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiClock aria-hidden className={endingSoon ? "text-teal" : "text-muted"} />
              {closed ? "Closed" : `${humanTime(seconds_remaining)} left`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
