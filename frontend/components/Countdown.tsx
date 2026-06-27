"use client";

import { useEffect, useRef, useState } from "react";
import { hms } from "@/lib/format";

/**
 * Ticking HH:MM:SS countdown driven by the SERVER's `secondsRemaining` snapshot rather
 * than an absolute deadline parsed against the browser clock. This makes it immune to
 * clock skew between the viewer's machine and the backend (which is what caused drops to
 * show 00:00:00 even when the API reported hours left).
 *
 * We capture the server value + the local timestamp at the moment we received it, then
 * only ever subtract *elapsed* local time from it — never compare absolute dates. When a
 * poll passes a fresh `secondsRemaining`, the anchor re-syncs automatically.
 */
export function Countdown({ secondsRemaining }: { secondsRemaining: number }) {
  // Anchor (server seconds + local epoch ms when received). Seeded lazily in the effect
  // so Date.now() is never called during render.
  const anchor = useRef<{ seconds: number; at: number } | null>(null);
  const [remaining, setRemaining] = useState(Math.max(0, secondsRemaining));

  // Re-anchor + tick. Re-runs when the parent hands us a fresh server value (poll).
  useEffect(() => {
    anchor.current = { seconds: secondsRemaining, at: Date.now() };

    const tick = () => {
      const a = anchor.current;
      if (!a) return;
      const elapsed = (Date.now() - a.at) / 1000;
      setRemaining(Math.max(0, Math.round(a.seconds - elapsed)));
    };
    tick(); // sync immediately to the new anchor
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [secondsRemaining]);

  return (
    <span className="tabular-nums font-medium tracking-tight">{hms(remaining)}</span>
  );
}
