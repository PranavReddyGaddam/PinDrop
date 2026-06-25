"use client";

import { useEffect, useMemo, useState } from "react";
import { getCampaigns, type CampaignSummary } from "@/lib/api";
import { CampaignCard } from "./CampaignCard";

const POLL_MS = 5000;
const ALL = "All";

/**
 * Live, filterable drops browser. Polls the full list every 5s and filters by category
 * on the client, so switching categories is instant and prices stay current.
 */
export function CampaignBrowser({
  initial,
  categories,
}: {
  initial: CampaignSummary[];
  categories: string[];
}) {
  const [items, setItems] = useState(initial);
  const [active, setActive] = useState<string>(ALL);

  useEffect(() => {
    const t = setInterval(async () => {
      try {
        setItems(await getCampaigns());
      } catch {
        /* keep last good list */
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const tabs = [ALL, ...categories];
  const filtered = useMemo(
    () =>
      active === ALL
        ? items
        : items.filter((s) => s.campaign.category === active),
    [items, active],
  );

  return (
    <div>
      {/* Category nav */}
      <nav className="mb-10 flex flex-wrap gap-2">
        {tabs.map((cat) => {
          const isActive = cat === active;
          return (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={
                isActive
                  ? "rounded-full bg-foreground px-4 py-2 text-sm font-medium text-white"
                  : "rounded-full border border-hairline px-4 py-2 text-sm font-medium text-foreground/70 hover:border-teal hover:text-teal"
              }
            >
              {cat}
            </button>
          );
        })}
      </nav>

      {filtered.length === 0 ? (
        <p className="text-muted">No live drops in this category right now.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s) => (
            <CampaignCard key={s.campaign.id} summary={s} />
          ))}
        </div>
      )}
    </div>
  );
}
