import Link from "next/link";
import { FiUsers, FiClock } from "react-icons/fi";
import type { CampaignSummary } from "@/lib/api";
import { money, hms } from "@/lib/format";

/** Homepage grid tile — uniform image area, clamped title, emphasized savings. */
export function CampaignCard({ summary }: { summary: CampaignSummary }) {
  const { campaign, current_price, floor_price, current_count, seconds_remaining } =
    summary;
  const dropped = current_price < floor_price;
  const closed = seconds_remaining <= 0 || campaign.status !== "open";
  const pctOff =
    dropped && floor_price > 0
      ? Math.round(((floor_price - current_price) / floor_price) * 100)
      : 0;

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="group relative flex h-full flex-col bg-background ring-1 ring-hairline transition-all duration-300 hover:ring-2 hover:ring-teal"
    >
      {/* Image — product photos on the soft brand neutral so they read as a set, with
          padding + object-contain so varied Amazon aspect ratios never crop badly. */}
      <div className="relative aspect-square w-full overflow-hidden bg-soft p-6">
        {campaign.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.image_url}
            alt={campaign.title}
            loading="lazy"
            className="h-full w-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-script text-3xl text-muted">pindrop</span>
          </div>
        )}

        {/* DROP LIVE — squared lime tag */}
        {!closed && (
          <span className="absolute left-0 top-4 inline-flex items-center gap-1.5 bg-lime px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.12em] text-lime-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-ink animate-live-dot" />
            Drop live
          </span>
        )}
        {/* % off — squared teal tag, top right */}
        {pctOff > 0 && (
          <span className="absolute right-0 top-4 bg-teal px-3 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.08em] text-white">
            {pctOff}% off
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="flex flex-1 flex-col border-t-2 border-foreground/90 p-5">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
          {campaign.category}
        </p>
        <h3 className="mt-2 line-clamp-2 font-serif text-lg leading-snug text-foreground transition-colors group-hover:text-teal">
          {campaign.title}
        </h3>

        <div className="mt-auto pt-4">
          {/* Price line — teal price, struck floor, prominent */}
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

          {/* Stats row sits on a hairline divider for structure */}
          <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3 text-xs font-medium text-muted">
            <span className="inline-flex items-center gap-1.5">
              <FiUsers aria-hidden className="text-teal" />
              {current_count} in
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiClock aria-hidden className="text-teal" />
              {closed ? "Closed" : `${hms(seconds_remaining)} left`}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
