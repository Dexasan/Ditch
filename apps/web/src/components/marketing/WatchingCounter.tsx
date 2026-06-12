"use client";

import { useEffect, useState } from "react";

// Demo value for the panel status line: drifts gently so the panel feels
// live. Part of the product illustration, like the cue-in queue.
const BASE = 2418;
const MIN = 2380;
const MAX = 2460;

export default function WatchingCounter() {
  const [count, setCount] = useState(BASE);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = setInterval(() => {
      setCount((current) => {
        const step = Math.floor(Math.random() * 5) - 2;
        const next = current + (step === 0 ? 1 : step);
        return Math.min(MAX, Math.max(MIN, next));
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return <span>{count.toLocaleString("en-US")} watching · 4 channels</span>;
}
