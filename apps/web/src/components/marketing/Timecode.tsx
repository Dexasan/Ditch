"use client";

import { useEffect, useRef, useState } from "react";
import { useAmbientMotion } from "@/hooks/useAmbientMotion";

// A running broadcast timecode (hh:mm:ss:ff) that ticks while the tab is
// open and motion is allowed. It is the page heartbeat: a small constant
// signal that the studio is live. Ticks at 12fps (cheap) and pauses with
// the tab. Under reduced motion it stays at the start value.
export default function Timecode() {
  const ambient = useAmbientMotion();
  const start = useRef(Date.now());
  const [tc, setTc] = useState("00:00:00:00");

  useEffect(() => {
    if (!ambient) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const elapsed = Date.now() - start.current;
      const frames = Math.floor(elapsed / (1000 / 30)) % 30;
      const totalSec = Math.floor(elapsed / 1000);
      setTc(
        `${pad(Math.floor(totalSec / 3600) % 24)}:${pad(
          Math.floor(totalSec / 60) % 60,
        )}:${pad(totalSec % 60)}:${pad(frames)}`,
      );
    };
    tick();
    const id = setInterval(tick, 1000 / 12);
    return () => clearInterval(id);
  }, [ambient]);

  return <span className="tabular-nums">{tc}</span>;
}
