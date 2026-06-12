"use client";

import { useEffect, useState } from "react";

// Demo content for the cue-in row: fictional handles rotating through the
// queue. Deliberately no "from <platform>" claim: viewers join through the
// creator's DITCH channel, they are not pulled off another platform.
const REQUESTS = [
  "@martina_rm wants to join",
  "@kvn_clips wants to join",
  "@aleexgrm wants to join",
  "@nightfeed_ wants to join",
];

const ROTATE_MS = 5000;
const FADE_MS = 300;

export default function CueTicker() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((current) => (current + 1) % REQUESTS.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <p
      className="mc-mono text-[13px] text-ink transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      {REQUESTS[index]}
    </p>
  );
}
