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
