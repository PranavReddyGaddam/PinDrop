"use client";

import { useEffect, useState } from "react";
import { hms } from "@/lib/format";

/**
 * Ticking HH:MM:SS countdown to an absolute `deadline` (epoch ms). Deriving from a fixed
 * deadline means render stays pure (no Date.now/refs in render) and the display re-anchors
 * automatically when the parent passes a new deadline after a poll.
 */
export function Countdown({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(deadline); // placeholder; corrected on mount

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick(); // sync to real time once mounted (client only)
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.max(0, Math.floor((deadline - now) / 1000));
  return (
    <span className="tabular-nums font-medium tracking-tight">{hms(remaining)}</span>
  );
}
