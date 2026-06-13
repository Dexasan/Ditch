"use client";

import { useAmbientMotion } from "@/hooks/useAmbientMotion";

// A broadcast-style news crawl for the social-proof strip. Every item is a
// true brand statement, no invented stats. When motion is welcome the row
// scrolls seamlessly (the items are duplicated so the loop has no seam);
// under reduced motion or a hidden tab it sits still as a plain centered
// line.
const ITEMS = [
  "built in rome",
  "selected for start cup lazio 2026",
  "free during public beta",
  "one signal, every platform",
  "anyone can join",
];

function Row({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden={ariaHidden ? "true" : undefined}
    >
      {ITEMS.map((item) => (
        <span key={item} className="mc-mono flex items-center text-[12px] text-label">
          <span className="mx-5 h-1.5 w-1.5 rounded-full bg-tally" aria-hidden="true" />
          {item}
        </span>
      ))}
    </div>
  );
}

export default function NewsTicker() {
  const ambient = useAmbientMotion();

  if (!ambient) {
    return (
      <p className="mc-mono text-center text-[12px] text-label">
        built in rome · selected for start cup lazio 2026
      </p>
    );
  }

  return (
    <div className="flex overflow-hidden whitespace-nowrap">
      <div className="mc-marquee flex shrink-0">
        <Row />
        <Row ariaHidden />
      </div>
    </div>
  );
}
