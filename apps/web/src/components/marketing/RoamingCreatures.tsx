"use client";

import type { CSSProperties } from "react";
import { useAmbientMotion } from "@/hooks/useAmbientMotion";

// Little participant tiles that bob in the page gutters: DITCH's mascot is
// the viewer who steps on screen, so the "creatures" are tiny on-screen
// guests. They live in the side margins (shown only on wide screens where
// there is room beside the content) and never sit over text. Decorative
// and non-interactive; static under reduced motion or a hidden tab.
const CREATURES = [
  { side: "left", top: "20%", anim: "mc-roam-a", dur: "9s", delay: "0s" },
  { side: "right", top: "36%", anim: "mc-roam-b", dur: "11s", delay: "-3s" },
  { side: "left", top: "60%", anim: "mc-roam-c", dur: "10s", delay: "-5s" },
  { side: "right", top: "76%", anim: "mc-roam-a", dur: "12s", delay: "-2s" },
] as const;

function Creature() {
  return (
    <div className="flex h-9 w-9 flex-col items-center justify-center gap-1 rounded-lg bg-screen">
      <div className="flex gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-[#cfcdc4]" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#cfcdc4]" />
      </div>
      <span className="h-[3px] w-3 rounded-full bg-[#46463c]" />
    </div>
  );
}

export default function RoamingCreatures() {
  const ambient = useAmbientMotion();

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] hidden xl:block">
      {CREATURES.map((creature, i) => {
        const style: CSSProperties = {
          top: creature.top,
          animation: ambient
            ? `${creature.anim} ${creature.dur} ease-in-out infinite`
            : undefined,
          animationDelay: ambient ? creature.delay : undefined,
        };
        if (creature.side === "left") style.left = "14px";
        else style.right = "14px";
        return (
          <div key={i} className="absolute" style={style}>
            <Creature />
          </div>
        );
      })}
    </div>
  );
}
