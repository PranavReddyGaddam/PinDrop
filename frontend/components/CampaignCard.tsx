import Link from "next/link";
import { FiUsers, FiClock } from "react-icons/fi";
import type { CampaignSummary } from "@/lib/api";
import { money, hms } from "@/lib/format";

/** Homepage grid tile — large editorial image, serif title, live price + count. */
export function CampaignCard({ summary }: { summary: CampaignSummary }) {
  const { campaign, current_price, floor_price, current_count, seconds_remaining } =
    summary;
  const dropped = current_price < floor_price;
  const closed = seconds_remaining <= 0 || campaign.status !== "open";

  return (
    <Link href={`/campaigns/${campaign.id}`} className="group block">
      {/* Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-soft">
        {campaign.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={campaign.image_url}
            alt={campaign.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="font-script text-3xl text-muted">roasted to order</span>
          </div>
        )}
        {!closed && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-lime px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-lime-ink">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-ink animate-live-dot" />
            Drop live
          </span>
        )}
      </div>

      {/* Meta */}
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">
        {campaign.category}
      </p>
      <h3 className="mt-1 font-serif text-xl leading-snug text-teal group-hover:underline">
        {campaign.title}
      </h3>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-lg font-semibold text-teal">
          {money(current_price)}
        </span>
        {dropped && (
          <span className="text-sm text-muted line-through">
            {money(floor_price)}
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1.5">
          <FiUsers aria-hidden />
          {current_count} committed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FiClock aria-hidden />
          {closed ? "Closed" : `${hms(seconds_remaining)} left`}
        </span>
      </div>
    </Link>
  );
}
