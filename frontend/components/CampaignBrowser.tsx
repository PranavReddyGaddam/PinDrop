"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiChevronDown } from "react-icons/fi";
import { getCampaigns, type CampaignSummary } from "@/lib/api";
import { CampaignGrid } from "./CampaignGrid";

const POLL_MS = 5000;
const PAGE_SIZE = 24;
const ALL = "All";

/**
 * Full drops browser for the /drops page: category dropdown + header search (?q=) +
 * pagination, so the 200-drop catalog is never one endless scroll. Polls the full list
 * every 5s and filters client-side.
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
  const [page, setPage] = useState(1);
  const params = useSearchParams();
  const query = (params.get("q") ?? "").trim().toLowerCase();

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

  const filtered = useMemo(() => {
    return items.filter((s) => {
      const okCat = active === ALL || s.campaign.category === active;
      const okQuery =
        !query ||
        s.campaign.title.toLowerCase().includes(query) ||
        s.campaign.category.toLowerCase().includes(query);
      return okCat && okQuery;
    });
  }, [items, active, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div>
      {/* Controls: category dropdown + result count */}
      <div className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="relative">
          <select
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by category"
            className="appearance-none rounded-full border border-hairline bg-background py-2.5 pl-5 pr-11 text-sm font-medium text-foreground outline-none transition-colors hover:border-teal focus:border-teal"
          >
            <option value={ALL}>All categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <FiChevronDown
            aria-hidden
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
        </div>

        <p className="text-sm text-muted">
          {filtered.length} {filtered.length === 1 ? "drop" : "drops"}
          {query && (
            <>
              {" "}
              for <span className="text-foreground">&ldquo;{query}&rdquo;</span>
            </>
          )}
          {active !== ALL && <> in {active}</>}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-muted">
          No live drops match
          {query ? ` “${query}”` : ""}
          {active !== ALL ? ` in ${active}` : ""}.
        </p>
      ) : (
        <>
          <CampaignGrid items={pageItems} />

          {totalPages > 1 && (
            <div className="mt-14 flex items-center justify-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={current === 1}
                className="rounded-full border border-hairline px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-teal hover:text-teal disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-sm tabular-nums text-muted">
                Page {current} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={current === totalPages}
                className="rounded-full border border-hairline px-5 py-2 text-sm font-medium text-foreground transition-colors hover:border-teal hover:text-teal disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
