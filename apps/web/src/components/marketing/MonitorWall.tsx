import type { CSSProperties } from "react";
import Link from "next/link";
import CueTicker from "./CueTicker";
import HeroVideo from "./HeroVideo";
import WatchingCounter from "./WatchingCounter";
import { SMPTE_GRADIENT } from "./palette";

// Tune-in choreography (CSS-driven, see globals.css): test card fades off
// the master screen, then the channel tallies light in order, lamp last.
const CHANNELS = [
  { id: "ch 01", platform: "twitch", delay: "2s" },
  { id: "ch 02", platform: "youtube", delay: "2.15s" },
  { id: "ch 03", platform: "tiktok", delay: "2.3s" },
  { id: "ch 04", platform: "kick", delay: "2.45s" },
];
const LAMP_DELAY = "2.8s";

function Tally({ delay, lamp = false }: { delay: string; lamp?: boolean }) {
  return (
    <span
      className="relative inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-line"
      aria-hidden="true"
    >
      <span
        className={`mc-tally absolute inset-0 rounded-full bg-tally${lamp ? " mc-lamp" : ""}`}
        style={{ "--mc-delay": delay } as CSSProperties}
      />
    </span>
  );
}

export default function MonitorWall() {
  return (
    <section
      aria-label="the ditch master control panel"
      className="flex flex-col gap-5 rounded-3xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgba(44,44,42,0.05)] sm:gap-6 sm:p-8"
    >
      {/* panel header */}
      <div className="flex items-center justify-between">
        <span className="mc-mono text-[12px] text-label">
          ditch · master control
        </span>
        <span className="flex items-center gap-2.5">
          <Tally delay={LAMP_DELAY} lamp />
          <span className="mc-mono text-[12px] text-ink">on air</span>
        </span>
      </div>

      {/* master monitor */}
      <div className="rounded-xl border border-line bg-panel p-2">
        <div className="overflow-hidden rounded-lg">
          <div className="relative bg-screen">
            <HeroVideo />
            <div className="relative z-10 flex aspect-[4/3] flex-col items-center justify-center px-6 text-center sm:aspect-[21/9]">
              <h1>
                <span className="mc-headline mc-mono block text-[clamp(1.6rem,5vw,3.25rem)] font-medium tracking-[0.3em] text-paper">
                  one stream
                </span>
                <span className="mc-subline mc-mono mt-4 block text-[clamp(0.75rem,1.8vw,1rem)] text-[#B5B3A8] sm:mt-5">
                  every platform · anyone can join
                </span>
              </h1>
            </div>
            {/* test card shown before tune-in, fades out via .mc-test-card */}
            <div className="mc-test-card absolute inset-0 z-20 bg-screen" aria-hidden="true">
              <div
                className="h-full w-full opacity-40"
                style={{ backgroundImage: SMPTE_GRADIENT }}
              />
            </div>
          </div>
          <div
            className="h-[5px] w-full"
            style={{ backgroundImage: SMPTE_GRADIENT }}
            aria-hidden="true"
          />
        </div>
        <div className="mc-mono flex items-center justify-between px-2 pb-1 pt-2.5 text-[11px]">
          <span className="text-label">master</span>
          <span className="text-faint">1080p60 · signal good</span>
        </div>
      </div>

      {/* channel monitors */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {CHANNELS.map((channel) => (
          <div
            key={channel.platform}
            className="rounded-xl border border-line bg-panel p-2 transition-all duration-300 hover:-translate-y-0.5 hover:border-faint sm:p-2.5"
          >
            <div className="flex aspect-[2/1] items-center justify-center rounded-lg bg-screen">
              <Tally delay={channel.delay} />
            </div>
            <p className="mc-mono pb-1 pt-2.5 text-center text-[11px] text-label">
              {channel.id} · {channel.platform}
            </p>
          </div>
        ))}
      </div>

      {/* cue-in row: the differentiator made visible (demo content) */}
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-panel px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <CueTicker />
        <Link
          href="/auth"
          aria-label="get started, cue viewers onto your stream"
          className="mc-mono inline-flex items-center justify-center rounded-lg bg-tally px-7 py-2.5 text-[13px] text-paper transition hover:opacity-90"
        >
          cue in
        </Link>
      </div>

      {/* status line (demo values, part of the panel illustration) */}
      <div className="mc-mono flex items-center justify-between text-[11px] text-faint">
        <WatchingCounter />
        <span>ditch · rome</span>
      </div>
    </section>
  );
}
