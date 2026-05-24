"use client";

import { useState } from "react";
import Link from "next/link";

/* ─── Explore card data ──────────────────────────────────────────────── */

const PLATFORMS = [
  { name: "Twitch",  color: "#9146FF", left: "8%",  delay: "0s",   dur: "4.4s" },
  { name: "YouTube", color: "#FF4444", left: "24%", delay: "1.1s", dur: "5.1s" },
  { name: "TikTok",  color: "#00E5D4", left: "44%", delay: "0.5s", dur: "3.9s" },
  { name: "Kick",    color: "#53FC18", left: "64%", delay: "2.0s", dur: "4.7s" },
  { name: "Twitch",  color: "#9146FF", left: "82%", delay: "2.7s", dur: "5.6s" },
  { name: "YouTube", color: "#FF4444", left: "35%", delay: "3.3s", dur: "4.2s" },
];

/* ─── Studio card data ───────────────────────────────────────────────── */

// [minH, maxH, duration, delay] — stable config, no random on render
const EQ_BARS: [number, number, number, number][] = [
  [4, 18, 1.2, 0.00], [6, 32, 0.9, 0.11], [3, 22, 1.4, 0.20], [8, 40, 0.8, 0.05],
  [5, 20, 1.1, 0.16], [4, 34, 1.0, 0.26], [7, 18, 1.3, 0.08], [3, 44, 0.7, 0.18],
  [6, 26, 0.9, 0.30], [5, 36, 1.2, 0.13], [4, 24, 1.1, 0.22], [8, 42, 0.8, 0.04],
  [3, 20, 1.4, 0.28], [6, 30, 1.0, 0.17], [5, 24, 0.9, 0.33], [7, 38, 1.1, 0.06],
  [4, 20, 1.3, 0.24], [8, 46, 0.7, 0.14], [3, 28, 1.2, 0.21], [6, 32, 0.8, 0.09],
];

/* ─── Keyframes ─────────────────────────────────────────────────────── */

const KEYFRAMES = `
  @keyframes orbFloat {
    0%   { transform: translateY(0px) translateX(0px); opacity: 0; }
    8%   { opacity: 1; }
    88%  { opacity: 0.9; }
    100% { transform: translateY(-120px) translateX(6px); opacity: 0; }
  }
  @keyframes rippleOut {
    0%   { transform: scale(0.15); opacity: 0.55; }
    100% { transform: scale(2.2);  opacity: 0; }
  }
  @keyframes eqBounce {
    0%   { height: var(--min-h); }
    100% { height: var(--max-h); }
  }
  @keyframes recBlink {
    0%, 49% { opacity: 1; }
    50%, 100% { opacity: 0.15; }
  }
  @keyframes cornerIn {
    from { opacity: 0; transform: scale(0.6); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes scanline {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(400%); }
  }
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
      className="group relative flex flex-col overflow-hidden rounded-2xl p-7 transition-transform duration-300 hover:scale-[1.015]"
      style={{
        background: "linear-gradient(155deg, #09091c 0%, #0c0c20 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        minHeight: "268px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Multi-platform aurora glow — fades in on hover */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          opacity: hovered ? 1 : 0,
          background: [
            "radial-gradient(ellipse at 15% 90%, rgba(145,70,255,0.13) 0%, transparent 55%)",
            "radial-gradient(ellipse at 50% 95%, rgba(0,229,212,0.11) 0%, transparent 50%)",
            "radial-gradient(ellipse at 85% 90%, rgba(255,68,68,0.09) 0%, transparent 50%)",
            "radial-gradient(ellipse at 65% 85%, rgba(83,252,24,0.07) 0%, transparent 40%)",
          ].join(", "),
        }}
      />

      {/* Floating platform badges — always animating */}
      <div className="absolute inset-x-0 bottom-0 h-full overflow-hidden pointer-events-none">
        {PLATFORMS.map((p, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              bottom: "10px",
              left: p.left,
              animation: `orbFloat ${p.dur} ${p.delay} infinite linear`,
            }}
          >
            <span
              className="block rounded-full px-2 py-0.5 text-[9px] font-bold whitespace-nowrap"
              style={{
                background: `${p.color}15`,
                border: `1px solid ${p.color}38`,
                color: p.color,
                boxShadow: hovered ? `0 0 10px ${p.color}35` : "none",
                transition: "box-shadow 0.4s ease",
              }}
            >
              {p.name}
            </span>
          </div>
        ))}
      </div>

      {/* Broadcast ripples — appear on hover */}
      {hovered && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[0, 0.7, 1.4].map((delay, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: "72px",
                height: "72px",
                border: "1px solid rgba(0,229,212,0.22)",
                animation: `rippleOut 2.1s ${delay}s infinite ease-out`,
              }}
            />
          ))}
        </div>
      )}

      {/* Foreground content */}
      <div className="relative z-10 flex flex-col h-full">
        <div
          className="mb-5 w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300"
          style={{
            background: hovered ? "rgba(0,229,212,0.18)" : "rgba(0,229,212,0.08)",
            border: hovered ? "1px solid rgba(0,229,212,0.35)" : "1px solid rgba(0,229,212,0.13)",
          }}
        >
          <svg className="w-5 h-5" style={{ color: "#00E5D4" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-white mb-1.5">Explore</h2>
        <p className="text-sm text-white/38 leading-relaxed flex-1">
          Watch live streams from creators broadcasting across every platform at once.
        </p>

        <div
          className="mt-6 flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: "#00E5D4" }}
        >
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

/* ─── Studio card ────────────────────────────────────────────────────── */

function StudioCard() {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href="/dashboard"
      className="group relative flex flex-col overflow-hidden rounded-2xl p-7 transition-transform duration-300 hover:scale-[1.015]"
      style={{
        background: "linear-gradient(155deg, #0d0910 0%, #110c15 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        minHeight: "268px",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Deep bottom glow on hover */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-700"
        style={{
          opacity: hovered ? 1 : 0,
          background: "radial-gradient(ellipse at 50% 110%, rgba(255,29,180,0.16) 0%, transparent 65%)",
        }}
      />

      {/* EQ visualizer bars — always running, just opacity changes */}
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

      {/* Scanline sweep on hover */}
      {hovered && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ borderRadius: "inherit" }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(255,29,180,0.18), transparent)",
              animation: "scanline 2.4s linear infinite",
            }}
          />
        </div>
      )}

      {/* Viewfinder corner brackets */}
      {hovered && (
        <>
          {[
            { top: 10, left: 10,  borderTop: true,  borderLeft: true,  br: "2px 0 0 0" },
            { top: 10, right: 10, borderTop: true,  borderRight: true, br: "0 2px 0 0" },
            { bottom: 10, left: 10,  borderBottom: true, borderLeft: true,  br: "0 0 0 2px" },
            { bottom: 10, right: 10, borderBottom: true, borderRight: true, br: "0 0 2px 0" },
          ].map((corner, i) => (
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                width: "18px",
                height: "18px",
                top: corner.top,
                left: corner.left,
                right: corner.right,
                bottom: corner.bottom,
                borderTop:    corner.borderTop    ? "1.5px solid rgba(255,29,180,0.55)" : undefined,
                borderBottom: corner.borderBottom ? "1.5px solid rgba(255,29,180,0.55)" : undefined,
                borderLeft:   corner.borderLeft   ? "1.5px solid rgba(255,29,180,0.55)" : undefined,
                borderRight:  corner.borderRight  ? "1.5px solid rgba(255,29,180,0.55)" : undefined,
                borderRadius: corner.br,
                animation: `cornerIn 0.25s ease-out both`,
              }}
            />
          ))}

          {/* REC indicator */}
          <div
            className="absolute top-3.5 right-10 flex items-center gap-1.5 pointer-events-none"
            style={{ animation: "fadeUp 0.25s ease-out both" }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#FF1DB4", animation: "recBlink 1.1s step-end infinite" }}
            />
            <span className="text-[10px] font-bold tracking-widest" style={{ color: "rgba(255,29,180,0.75)" }}>
              REC
            </span>
          </div>
        </>
      )}

      {/* Foreground content */}
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

/* ─── Export ─────────────────────────────────────────────────────────── */

export default function HomeCards() {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ExploreCard />
        <StudioCard />
      </div>
    </>
  );
}
