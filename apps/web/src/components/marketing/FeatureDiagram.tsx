// Tiny live diagrams that illustrate each feature instead of a static
// icon. CSS-only, so they animate under prefers-reduced-motion: no-pref
// and sit as a clear static shape otherwise. Decorative (aria-hidden).
//   fanout: one source splitting to four platform dots (simulcast)
//   cuein:  a viewer tile sliding into a slot (studio floor)
//   loop:   a signal looping back on itself (the growth loop)
export type DiagramKind = "fanout" | "cuein" | "loop";

const PLATFORM_DOTS = ["#9146FF", "#FF0000", "#2C2C2A", "#00C853"];

function Fanout() {
  return (
    <svg viewBox="0 0 132 64" className="h-16 w-[150px]" aria-hidden="true">
      <g className="mc-flow" stroke="#FF2D92" strokeWidth="1.4" fill="none" strokeDasharray="3 6" opacity="0.5">
        <line x1="20" y1="32" x2="112" y2="12" />
        <line x1="20" y1="32" x2="112" y2="28" />
        <line x1="20" y1="32" x2="112" y2="40" />
        <line x1="20" y1="32" x2="112" y2="56" />
      </g>
      <circle cx="20" cy="32" r="5" fill="#FF2D92" />
      {[12, 28, 40, 56].map((y, i) => (
        <circle key={y} cx="112" cy={y} r="4" fill={PLATFORM_DOTS[i]} />
      ))}
    </svg>
  );
}

function CueIn() {
  return (
    <div className="flex h-16 items-center gap-2" aria-hidden="true">
      <div className="flex h-10 w-14 items-center justify-center rounded-md bg-screen">
        <span className="mc-slot-tile flex h-7 w-9 flex-col items-center justify-center gap-1 rounded bg-[#0f0f0c]">
          <span className="h-2 w-2 rounded-full bg-[#cfcdc4]" />
          <span className="h-[2px] w-3.5 rounded-full bg-[#46463c]" />
        </span>
      </div>
      <div className="h-10 w-9 rounded-md bg-screen opacity-40" />
      <div className="h-10 w-9 rounded-md bg-screen opacity-25" />
    </div>
  );
}

function Loop() {
  return (
    <div className="flex h-16 items-center" aria-hidden="true">
      <div className="relative h-12 w-12">
        <div className="mc-orbit absolute inset-0 rounded-full border border-dashed border-tally/60" />
        <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-screen" />
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-tally" />
      </div>
    </div>
  );
}

export default function FeatureDiagram({ kind }: { kind: DiagramKind }) {
  if (kind === "fanout") return <Fanout />;
  if (kind === "cuein") return <CueIn />;
  return <Loop />;
}
