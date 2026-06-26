import type { CampaignSummary } from "@/lib/api";
import { CampaignCard } from "./CampaignCard";

/** Plain responsive grid of campaign cards. Shared by the homepage and /drops. */
export function CampaignGrid({ items }: { items: CampaignSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((s) => (
        <CampaignCard key={s.campaign.id} summary={s} />
      ))}
    </div>
  );
}
