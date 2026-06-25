import { FiCheck, FiChevronLeft, FiCircle } from "react-icons/fi";
import { money } from "@/lib/format";
import type { Tier } from "@/lib/api";

/**
 * The price ladder: check icon = unlocked tiers, chevron = the current one,
 * hollow circle = locked future tiers.
 * Tiers aren't returned by the stats endpoint directly, so the page derives the
 * current/next markers from current_count.
 */
export function TierLadder({
  tiers,
  currentCount,
}: {
  tiers: Tier[];
  currentCount: number;
}) {
  // Index of the highest tier already unlocked.
  let currentIdx = 0;
  tiers.forEach((t, i) => {
    if (currentCount >= t.min_quantity) currentIdx = i;
  });

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {tiers.map((t, i) => {
        const unlocked = currentCount >= t.min_quantity;
        const isCurrent = i === currentIdx;
        return (
          <div
            key={t.min_quantity}
            className={
              isCurrent
                ? "flex items-center gap-1.5 font-semibold text-teal"
                : unlocked
                  ? "flex items-center gap-1.5 text-teal/70"
                  : "flex items-center gap-1.5 text-muted"
            }
          >
            {isCurrent ? (
              <FiChevronLeft aria-hidden />
            ) : unlocked ? (
              <FiCheck aria-hidden />
            ) : (
              <FiCircle aria-hidden className="text-[0.7em]" />
            )}
            {t.min_quantity}+ {money(t.unit_price)}
            {isCurrent && (
              <span className="ml-1 text-xs font-normal text-muted">
                you&apos;re here
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
