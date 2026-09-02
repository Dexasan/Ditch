"use client";

import { useState } from "react";
import Link from "next/link";

/* ─── Studio EQ bars (unchanged) ────────────────────────────────────── */

const EQ_BARS: [number, number, number, number][] = [
  [4, 18, 1.2, 0.00], [6, 32, 0.9, 0.11], [3, 22, 1.4, 0.20], [8, 40, 0.8, 0.05],
  [5, 20, 1.1, 0.16], [4, 34, 1.0, 0.26], [7, 18, 1.3, 0.08], [3, 44, 0.7, 0.18],
  [6, 26, 0.9, 0.30], [5, 36, 1.2, 0.13], [4, 24, 1.1, 0.22], [8, 42, 0.8, 0.04],
  [3, 20, 1.4, 0.28], [6, 30, 1.0, 0.17], [5, 24, 0.9, 0.33], [7, 38, 1.1, 0.06],
  [4, 20, 1.3, 0.24], [8, 46, 0.7, 0.14], [3, 28, 1.2, 0.21], [6, 32, 0.8, 0.09],
];

/* ─── Explore: large blurred orbs wandering like an aurora ───────────── */

// Pure light - no text. Four platform colors drifting slowly.
const ORBS = [
  { color: "#9146FF", w: 200, h: 180, blur: 80, top: "2%",  left: "0%",  anim: "wander1", dur: "16s" },
  { color: "#FF3333", w: 170, h: 160, blur: 70, top: "5%",  left: "52%", anim: "wander2", dur: "20s" },
  { color: "#00E5D4", w: 190, h: 170, blur: 75, top: "48%", left: "42%", anim: "wander3", dur: "13s" },
  { color: "#53FC18", w: 160, h: 150, blur: 65, top: "45%", left: "2%",  anim: "wander4", dur: "17s" },
];

/* ─── Keyframes ─────────────────────────────────────────────────────── */

const KEYFRAMES = `
  /* Explore: orb drift paths */
  @keyframes wander1 {
    0%   { transform: translate(0px,   0px); }
    25%  { transform: translate(32px, -22px); }
    50%  { transform: translate(-14px, 28px); }
    75%  { transform: translate(22px,  12px); }
    100% { transform: translate(0px,   0px); }
  }
  @keyframes wander2 {
    0%   { transform: translate(0px,   0px); }
    33%  { transform: translate(-28px, 18px); }
    66%  { transform: translate(20px, -24px); }
    100% { transform: translate(0px,   0px); }
  }
  @keyframes wander3 {
    0%   { transform: translate(0px,   0px); }
    25%  { transform: translate(24px,  14px); }
    50%  { transform: translate(-20px, -10px); }
    75%  { transform: translate(10px,  24px); }
    100% { transform: translate(0px,   0px); }
  }
  @keyframes wander4 {
    0%   { transform: translate(0px,   0px); }
    20%  { transform: translate(-18px, -26px); }
    40%  { transform: translate(26px,  12px); }
    60%  { transform: translate(-12px, 20px); }
    80%  { transform: translate(18px, -14px); }
    100% { transform: translate(0px,   0px); }
  }

  /* Explore: broadcast ripple on hover */
  @keyframes rippleOut {
    0%   { transform: scale(0.1); opacity: 0.5; }
    100% { transform: scale(2.6); opacity: 0; }
  }

  /* Studio: EQ bars */
  @keyframes eqBounce {
    0%   { height: var(--min-h); }
    100% { height: var(--max-h); }
  }

  /* Studio: scanline sweep */
  @keyframes scanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(500%); }
  }

  /* Studio: REC blink */
  @keyframes recBlink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0.12; }
  }

  /* Studio: corner brackets */
  @keyframes cornerIn {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* Shared */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

/* ─── Explore card ───────────────────────────────────────────────────── */

function ExploreCard() {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href="/explore"
      className="group relative flex flex-col overflow-hidden rounded-2xl transition-transform duration-300 hover:scale-[1.012]"
      style={{
        background: "#07070f",
        border: "none",
        minHeight: "380px",
        width: "100%",
        padding: "28px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Wandering aurora orbs - always running */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {ORBS.map((orb, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: orb.w,
              height: orb.h,
              top: orb.top,
              left: orb.left,
              background: orb.color,
              filter: `blur(${orb.blur}px)`,
              opacity: hovered ? 0.42 : 0.20,
              animation: `${orb.anim} ${orb.dur} ease-in-out infinite`,
              transition: "opacity 0.8s ease",
              willChange: "transform",
            }}
          />
        ))}

        {/* Noise vignette so orbs don't bleed to edges */}
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 50%, transparent 30%, #07070f 90%)",
          }}
        />
      </div>

      {/* Broadcast ripples - center, on hover */}
      {hovered && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 0.8, 1.6].map((delay, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: "60px",
                height: "60px",
                border: "1px solid rgba(255,255,255,0.15)",
                animation: `rippleOut 2.4s ${delay}s infinite ease-out`,
              }}
            />
          ))}
        </div>
      )}

      {/* Content - sits above the orbs */}
      <div className="relative z-10 flex flex-col h-full">
        <div
          className="mb-6 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-400"
          style={{
            background: hovered ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <svg className="w-4.5 h-4.5 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-white mb-2">Explore</h2>
        <p className="text-sm text-white/35 leading-relaxed max-w-xs">
          Watch live streams from creators broadcasting to Twitch, YouTube, TikTok and Kick.
        </p>

        <div className="mt-auto pt-10 flex items-center gap-1.5 text-sm font-semibold text-white/50 group-hover:text-white transition-colors duration-300">
          Browse live streams
          <svg
            className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── Studio card (unchanged) ────────────────────────────────────────── */

function StudioCard() {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href="/dashboard"
      className="group relative flex flex-col overflow-hidden rounded-2xl p-7 transition-transform duration-300 hover:scale-[1.015]"
      style={{
        background: "linear-gradient(155deg, #0d0910 0%, #110c15 100%)",
        border: "none",
        minHeight: "380px",
        width: "100%",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          opacity: hovered ? 1 : 0,
          background: "radial-gradient(ellipse at 50% 110%, rgba(255,29,180,0.16) 0%, transparent 65%)",
        }}
      />

      <div
        className="absolute bottom-0 left-0 right-0 flex items-end justify-center gap-[2.5px] px-5 pointer-events-none transition-opacity duration-500"
        style={{ height: "68px", opacity: hovered ? 0.75 : 0.14 }}
      >
        {EQ_BARS.map(([min, max, dur, delay], i) => (
          <div
            key={i}
            style={{
              width: "4px",
              borderRadius: "2px 2px 0 0",
              background: `rgba(255,29,180,${0.55 + (i % 4) * 0.11})`,
              "--min-h": `${min}px`,
              "--max-h": `${max}px`,
              animation: `eqBounce ${dur}s ${delay}s infinite ease-in-out alternate`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {hovered && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ borderRadius: "inherit" }}>
          <div style={{
            position: "absolute", left: 0, right: 0, height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(255,29,180,0.18), transparent)",
            animation: "scanline 2.4s linear infinite",
          }} />
        </div>
      )}

      {hovered && (
        <>
          {[
            { top: 10, left: 10,   borderTop: true,  borderLeft: true,  br: "2px 0 0 0" },
            { top: 10, right: 10,  borderTop: true,  borderRight: true, br: "0 2px 0 0" },
            { bottom: 10, left: 10,  borderBottom: true, borderLeft: true,  br: "0 0 0 2px" },
            { bottom: 10, right: 10, borderBottom: true, borderRight: true, br: "0 0 2px 0" },
          ].map((c, i) => (
            <div key={i} className="absolute pointer-events-none" style={{
              width: "18px", height: "18px",
              top: c.top, left: c.left, right: c.right, bottom: c.bottom,
              borderTop:    c.borderTop    ? "1.5px solid rgba(255,29,180,0.55)" : undefined,
              borderBottom: c.borderBottom ? "1.5px solid rgba(255,29,180,0.55)" : undefined,
              borderLeft:   c.borderLeft   ? "1.5px solid rgba(255,29,180,0.55)" : undefined,
              borderRight:  c.borderRight  ? "1.5px solid rgba(255,29,180,0.55)" : undefined,
              borderRadius: c.br,
              animation: "cornerIn 0.25s ease-out both",
            }} />
          ))}

          <div className="absolute top-3.5 right-10 flex items-center gap-1.5 pointer-events-none"
            style={{ animation: "fadeUp 0.25s ease-out both" }}>
            <span className="w-2 h-2 rounded-full" style={{ background: "#FF1DB4", animation: "recBlink 1.1s step-end infinite" }} />
            <span className="text-[11px] font-bold tracking-widest" style={{ color: "rgba(255,29,180,0.75)" }}>REC</span>
          </div>
        </>
      )}

      <div className="relative z-10 flex flex-col h-full">
        <div
          className="mb-5 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
          style={{
            background: hovered ? "rgba(255,29,180,0.18)" : "rgba(255,29,180,0.08)",
            border: hovered ? "1px solid rgba(255,29,180,0.35)" : "1px solid rgba(255,29,180,0.13)",
          }}
        >
          <svg className="w-5 h-5 text-[#FF1DB4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M8.464 15.536a5 5 0 010-7.072m7.072 0a5 5 0 010 7.072M12 12h.01" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-white mb-1.5">Studio</h2>
        <p className="text-sm text-white/38 leading-relaxed flex-1">
          Go live, manage your stream destinations, and bring viewers on screen.
        </p>

        <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-[#FF1DB4]">
          Open your studio
          <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

/* ─── Layout ─────────────────────────────────────────────────────────── */

export default function HomeCards() {
  return (
    <>
      <style>{KEYFRAMES}</style>
      {/* Explore: wider (3/5), Studio: narrower (2/5) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        <div className="flex">
          <ExploreCard />
        </div>
        <div className="flex">
          <StudioCard />
        </div>
      </div>
    </>
  );
}
