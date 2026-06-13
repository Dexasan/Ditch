"use client";

import { useAmbientMotion } from "@/hooks/useAmbientMotion";

// The shared "powered on" backdrop for every marketing page. Three fixed,
// non-interactive layers behind the content:
//   1. a faint ink dot-grid that slowly drifts (keeps the page from
//      reading as a flat document),
//   2. static hairline scanlines for broadcast texture,
//   3. a slow pink signal sweep that travels down the viewport.
// The dot-grid texture stays even under reduced motion (texture is not
// motion); the drift and sweep only run when motion is welcome and the
// tab is in front. Everything is transform/opacity only.
export default function LiveBackground() {
  const ambient = useAmbientMotion();
  const playState = ambient ? "running" : "paused";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="mc-bg-dots absolute inset-[-40px]"
        style={{ animationPlayState: playState }}
      />
      <div className="mc-bg-scanlines absolute inset-0" />
      {ambient && <div className="mc-bg-sweep absolute inset-x-0 top-0 h-28" />}
    </div>
  );
}
