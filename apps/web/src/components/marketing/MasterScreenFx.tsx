"use client";

import { useAmbientMotion } from "@/hooks/useAmbientMotion";

// Overlays that make the hero master monitor feel live: moving scanlines,
// a small equalizer, and a viewer tile that keeps getting cued onto the
// screen with a ring pulse. The scanlines and equalizer degrade to a
// static state under reduced motion; the cue-in tile only mounts when
// motion is welcome (a frozen tile in the corner would read as a bug).
export default function MasterScreenFx() {
  const ambient = useAmbientMotion();
  const playState = ambient ? "running" : "paused";

  return (
    <>
      <div
        className="mc-screen-scan pointer-events-none absolute inset-0 z-[5] opacity-50"
        style={{ animationPlayState: playState }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute bottom-3 left-4 z-20 flex h-5 items-end gap-[3px]"
        aria-hidden="true"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="mc-eq-bar block h-full w-[3px] rounded-sm bg-tally"
            style={{ animationDelay: `${i * 0.12}s`, animationPlayState: playState }}
          />
        ))}
      </div>

      {ambient && (
        <div
          className="mc-cuein-tile pointer-events-none absolute bottom-3 right-3 z-30 flex h-10 w-14 flex-col items-center justify-center gap-1 rounded-md border border-tally bg-[#0f0f0c]"
          aria-hidden="true"
        >
          <span className="h-3 w-3 rounded-full bg-[#cfcdc4]" />
          <span className="h-[3px] w-5 rounded-full bg-[#46463c]" />
          <span className="mc-ring absolute -inset-1.5 rounded-lg border border-tally" />
        </div>
      )}
    </>
  );
}
