export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** HH:MM:SS from a seconds count. */
export function hms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

/**
 * Human-readable time remaining for cards/lists. Nobody parses "62:05:07" in their head,
 * so we use coarse units when there's lots of time and only fall to a ticking clock when
 * it's genuinely urgent:
 *   >= 1 day   -> "2d 14h"
 *   >= 1 hour  -> "5h 12m"
 *   < 1 hour   -> "08:05" (mm:ss — the seconds now create real urgency)
 */
export function humanTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s >= 86400) {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    return `${d}d ${h}h`;
  }
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * A stable per-browser demo identity. The backend doesn't require real auth for the
 * hackathon; each browser commits as one synthetic user. UUID v4 via crypto.
 */
function stableId(key: string): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000000";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getDemoUserId(): string {
  return stableId("pindrop_demo_user_id");
}

/** Per-browser synthetic seller identity for the create-campaign flow (no auth in scope). */
export function getDemoSellerId(): string {
  return stableId("pindrop_demo_seller_id");
}
