import { getCampaignHistory } from "@/lib/api";
import { money } from "@/lib/format";

/** A finished date like "Jun 9, 2026". */
function closedDate(iso: string): string {
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * History of finished drops for this product (grouped by title on the backend).
 * Server-rendered: history doesn't change live, so no polling.
 */
export async function PreviousDrops({ campaignId }: { campaignId: string }) {
  let history;
  try {
    history = await getCampaignHistory(campaignId);
  } catch {
    return null; // history is non-critical; never block the page on it
  }
  if (history.length === 0) return null;

  return (
    <div className="mt-10 border-t border-hairline pt-6">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted">
        Previous drops for this product
      </p>
      <ul className="divide-y divide-hairline">
        {history.map((d) => {
          const dropped = d.final_price < d.floor_price;
          return (
            <li
              key={d.campaign_id}
              className="flex items-center justify-between py-3"
            >
              <div>
                <p className="text-sm text-foreground">
                  Closed {closedDate(d.closed_at)}
                </p>
                <p className="text-sm text-muted">{d.committed} committed</p>
              </div>
              <div className="text-right">
                <span className="font-serif text-lg text-teal">
                  {money(d.final_price)}
                </span>
                {dropped && (
                  <span className="ml-2 text-sm text-muted line-through">
                    {money(d.floor_price)}
                  </span>
                )}
                <p className="text-xs text-muted">final price</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
