"use client";

import { useEffect, useRef, useState } from "react";
import { useAgoraRoom } from "@/hooks/useAgoraRoom";
import { useClipBuffer } from "@/hooks/useClipBuffer";
import { useCompositor, getLayout } from "@/hooks/useCompositor";
import { useRecorder } from "@/hooks/useRecorder";
import { useRelayStream } from "@/hooks/useRelayStream";
import type { CamCell, Destination, Layer, Scene } from "@/lib/studio-store";
import { CREATOR_CAM_UID, CREATOR_SCREEN_UID } from "@/lib/agora";
import { getSocket, type SessionJoinAck } from "@/lib/socket";
import { useStudioStore } from "@/lib/studio-store";
import type { ChatMessage, Participant, ParticipantStatus } from "@ditch/types";
import type { ILocalAudioTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";
import { ToastManager } from "./Toast";
import { useStudioShortcuts } from "@/hooks/useStudioShortcuts";

const MAX_CHAT = 200;
const TOTAL_SLOTS = 4;

const PLATFORM_COLOR: Record<string, string> = {
  twitch:  "#9146ff",
  youtube: "#ff0000",
  tiktok:  "#ff0050",
  kick:    "#53fc18",
  ditch:   "#7c3aed",
};

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconLayers() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconScenes() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconTransitions() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M15 6l6 6-6 6" />
      <path d="M9 18l-6-6 6-6" />
    </svg>
  );
}

function IconProperties() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="4" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconStreamInfo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}


function IconRadio() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconScissors() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <line x1="20" y1="4" x2="8.12" y2="15.88" />
      <line x1="14.47" y1="14.48" x2="20" y2="20" />
      <line x1="8.12" y1="8.12" x2="12" y2="12" />
    </svg>
  );
}

function fmtElapsed(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

// ── Stream setup modal ────────────────────────────────────────────────────────

const DEST_PLATFORM_LABEL: Record<Destination["platform"], string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  custom: "Custom RTMP",
};

const DEST_PLATFORM_COLOR: Record<Destination["platform"], string> = {
  twitch: "#9146ff",
  youtube: "#ff0000",
  custom: "#71717a",
};

function GoLiveModal({
  onClose,
  onGoLive,
}: {
  onClose: () => void;
  onGoLive: () => void;
}) {
  const { settings, addDestination, removeDestination, updateSettings } = useStudioStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlatform, setNewPlatform] = useState<Destination["platform"]>("twitch");
  const [newLabel, setNewLabel] = useState("");
  const [newStreamKey, setNewStreamKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  function handleAdd() {
    if (!newLabel.trim() || !newStreamKey.trim()) return;
    addDestination({
      id: crypto.randomUUID(),
      platform: newPlatform,
      label: newLabel.trim(),
      streamKey: newStreamKey.trim(),
    });
    setNewLabel("");
    setNewStreamKey("");
    setNewPlatform("twitch");
    setShowAddForm(false);
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "#00000088", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col gap-5 overflow-y-auto"
        style={{
          width: 480,
          maxHeight: "90vh",
          background: "var(--bg-base, #111122)",
          border: "1px solid var(--border, #1A1A3E)",
          borderRadius: 8,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <h2 className="font-bold text-white" style={{ fontSize: 18 }}>
            Go Live
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Section 1 — Destinations */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Destinations
          </p>

          {settings.destinations.length === 0 && !showAddForm && (
            <p className="text-[12px] text-[var(--color-text-muted)] py-1">
              No destinations yet. Add one below.
            </p>
          )}

          {settings.destinations.map((dest) => (
            <div
              key={dest.id}
              className="flex items-center gap-2 px-3 py-2 rounded bg-[var(--color-surface)] border border-[var(--color-surface-border)]"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: DEST_PLATFORM_COLOR[dest.platform] }}
              />
              <span className="text-[12px] text-[var(--color-text)] flex-1 truncate">{dest.label}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                {DEST_PLATFORM_LABEL[dest.platform]}
              </span>
              <button
                onClick={() => removeDestination(dest.id)}
                className="w-5 h-5 flex items-center justify-center rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors shrink-0"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}

          {showAddForm ? (
            <div className="space-y-2 p-3 rounded border border-[var(--color-surface-border)] bg-[var(--color-surface)]">
              <div className="flex gap-1">
                {(["twitch", "youtube", "custom"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewPlatform(p)}
                    className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-colors ${
                      newPlatform === p
                        ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-white"
                        : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {DEST_PLATFORM_LABEL[p]}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Label (e.g. My Twitch)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-[12px] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
              />
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  placeholder="Stream key"
                  value={newStreamKey}
                  onChange={(e) => setNewStreamKey(e.target.value)}
                  className="w-full px-3 py-1.5 pr-9 rounded bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-[12px] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  {showKey ? <IconEyeOff /> : <IconEye />}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewLabel("");
                    setNewStreamKey("");
                  }}
                  className="flex-1 py-1.5 rounded text-[11px] border border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!newLabel.trim() || !newStreamKey.trim()}
                  className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-[var(--color-brand)] text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-1.5 rounded text-[11px] border border-dashed border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-brand)]/50 transition-colors"
            >
              + Add destination
            </button>
          )}
        </div>

        {/* Section 2 — Stream info */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Stream Info
          </p>
          <input
            type="text"
            placeholder="Stream title"
            value={settings.streamTitle}
            onChange={(e) => updateSettings({ streamTitle: e.target.value })}
            className="w-full px-3 py-1.5 rounded bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-[12px] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
          />
        </div>

        {/* Go Live */}
        <button
          onClick={onGoLive}
          disabled={settings.destinations.length === 0}
          className="w-full py-2.5 rounded-lg text-[13px] font-bold bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Go Live
        </button>
      </div>
    </div>
  );
}

function EndStreamModal({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: "#00000088", zIndex: 50 }}
      onClick={onCancel}
    >
      <div
        className="flex flex-col gap-4"
        style={{
          width: 360,
          background: "var(--bg-base, #111122)",
          border: "1px solid var(--border, #1A1A3E)",
          borderRadius: 8,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-bold text-[var(--color-text)] mb-1" style={{ fontSize: 16 }}>
            End stream?
          </h2>
          <p className="text-[var(--color-text-muted)]" style={{ fontSize: 13 }}>
            Your stream will end for all viewers.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded text-[12px] font-semibold border border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded text-[12px] font-semibold text-white transition-colors"
            style={{ background: "#FF4444" }}
          >
            End Stream
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Top bar ───────────────────────────────────────────────────────────────────

function TopBar({ slug, onRecordClick }: { slug: string; onRecordClick: () => void }) {
  const { streamStatus, streamError, fps, setStreamStatus, settings, isRecording, streamDuration } = useStudioStore();
  const [showGoLiveModal, setShowGoLiveModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);

  function handleGoLiveClick() {
    if (streamStatus === "live") {
      setShowEndModal(true);
    } else if (streamStatus === "offline") {
      if (settings.destinations.length === 0) {
        setShowGoLiveModal(true);
      } else {
        setStreamStatus("connecting");
      }
    }
    // "connecting" — button is pointer-events-none, never fires
  }

  const goLiveLabel = streamStatus === "live"
    ? "End Stream"
    : streamStatus === "connecting"
    ? "Connecting…"
    : "Go Live";

  const goLiveCls = streamStatus === "live"
    ? "border-2 border-red-500 text-red-400 hover:bg-red-500/10"
    : streamStatus === "connecting"
    ? "bg-red-700/60 text-red-200 cursor-wait pointer-events-none"
    : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white";

  return (
    <>
      {showGoLiveModal && (
        <GoLiveModal
          onClose={() => setShowGoLiveModal(false)}
          onGoLive={() => {
            setShowGoLiveModal(false);
            setStreamStatus("connecting");
          }}
        />
      )}
      {showEndModal && (
        <EndStreamModal
          onCancel={() => setShowEndModal(false)}
          onConfirm={() => {
            setShowEndModal(false);
            setStreamStatus("offline");
          }}
        />
      )}
      <div
        className="flex items-center border-b border-[var(--color-surface-border)] bg-[var(--color-surface)] px-3 gap-3"
        style={{ gridArea: "topbar", height: 44 }}
      >
        {/* Logo */}
        <a
          href="/dashboard"
          className="font-bold tracking-tight text-sm text-[var(--color-text)] hover:text-[var(--color-brand)] transition-colors shrink-0"
        >
          DITCH
        </a>

        <span className="text-[var(--color-surface-border)]">|</span>

        {/* Center: status / counters */}
        <div className="flex items-center gap-4 flex-1 justify-center">
          {streamError ? (
            <span className="text-[10px] text-red-400 truncate max-w-xs">{streamError}</span>
          ) : (
            <>
              {streamStatus === "live" && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-red-400 tracking-widest">LIVE</span>
                </div>
              )}
              <span className="text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums">
                FPS <span className="text-[var(--color-text)]">{fps ?? "—"}</span>
              </span>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRecordClick}
            className={`h-7 px-3 rounded text-[11px] font-semibold border transition-colors ${
              isRecording
                ? "border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
            title={isRecording ? "Stop recording" : "Start recording"}
          >
            {isRecording ? (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                {fmtElapsed(streamDuration)}
              </span>
            ) : "Record"}
          </button>
          <button
            onClick={handleGoLiveClick}
            className={`h-7 px-4 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${goLiveCls}`}
            title={goLiveLabel}
          >
            <IconRadio />
            {goLiveLabel}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Left sidebar ──────────────────────────────────────────────────────────────

function layerTypeIcon(type: Layer["type"]) {
  switch (type) {
    case "camera":      return <IconCamera />;
    case "screenshare": return <IconMonitor />;
    case "image":       return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
    );
    case "text":        return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>
      </svg>
    );
    default:            return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
      </svg>
    );
  }
}

function LayerRow({
  layer,
  isActive,
  onToggleVisible,
  onSelect,
}: {
  layer: Layer;
  isActive: boolean;
  onToggleVisible: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-2 px-2 group cursor-pointer transition-colors border-l-2 ${
        isActive
          ? "border-[var(--accent-secondary,#00D4AA)] bg-[var(--bg-mid,#1A1A3E)]"
          : "border-transparent hover:bg-[var(--color-surface-raised)]"
      } ${!layer.visible ? "opacity-40" : ""}`}
      style={{ height: 36 }}
    >
      <span
        className="text-[var(--color-surface-border)] select-none leading-none opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        style={{ fontSize: 14 }}
      >
        ⠿
      </span>
      <span className="text-[var(--color-text-muted)] shrink-0">{layerTypeIcon(layer.type)}</span>
      <span className="flex-1 text-[13px] text-[var(--color-text)] truncate">{layer.name}</span>
      {layer.sourceUnavailable && (
        <span title="Source unavailable" style={{ color: "#FFAA00", fontSize: 13, lineHeight: 1 }} className="shrink-0">⚠</span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}
        className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-text)] shrink-0"
        title={layer.visible ? "Hide" : "Show"}
      >
        {layer.visible ? <IconEye /> : <IconEyeOff />}
      </button>
    </div>
  );
}

function LayersPanel({
  localVideoTrack,
  isScreenSharing,
  toggleScreenShare,
}: {
  localVideoTrack: ILocalVideoTrack | null;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
}) {
  const {
    scenes, activeSceneId,
    setActiveSceneCamCell,
    updateLayer, addLayer, removeLayer,
    selectedLayerId, setSelectedLayerId,
  } = useStudioStore();
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const [menuOpen, setMenuOpen] = useState(false);

  // Track the screenshare layer id so we can remove it when sharing stops.
  // Anchored to the scene that was active when sharing started.
  const screenshareLayerRef = useRef<{ sceneId: string; layerId: string } | null>(null);

  useEffect(() => {
    if (isScreenSharing && !screenshareLayerRef.current) {
      const layerId = crypto.randomUUID();
      screenshareLayerRef.current = { sceneId: activeSceneId, layerId };
      addLayer(activeSceneId, {
        id: layerId,
        type: "screenshare",
        name: "Screen",
        visible: true,
        locked: false,
        opacity: 100,
        transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0 },
        sourceConfig: {},
        effects: [],
      });
    } else if (!isScreenSharing && screenshareLayerRef.current) {
      const { sceneId, layerId } = screenshareLayerRef.current;
      removeLayer(sceneId, layerId);
      screenshareLayerRef.current = null;
    }
  // addLayer/removeLayer/activeSceneId intentionally omitted — only fire on share state change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScreenSharing]);

  function handleToggleVisible(layer: Layer) {
    const next = !layer.visible;
    updateLayer(activeScene.id, layer.id, { visible: next });
    if (layer.type === "camera" && localVideoTrack) {
      localVideoTrack.setEnabled(next).catch(() => {});
    }
  }

  return (
    <div className="flex flex-col overflow-hidden border-r border-[var(--color-surface-border)]" style={{ gridArea: "layers" }}>
      <div
        className="flex items-center gap-2 px-3 border-b border-[var(--color-surface-border)] shrink-0"
        style={{ height: 36 }}
      >
        <IconLayers />
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex-1">
          Layers
        </span>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            title="Add source"
          >
            <IconPlus />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute top-full right-0 mt-1 w-44 bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] rounded shadow-xl z-20 py-1 overflow-hidden">
                <button
                  onClick={() => {
                    addLayer(activeSceneId, {
                      id: crypto.randomUUID(),
                      type: "camera",
                      name: "Camera",
                      visible: true,
                      locked: false,
                      opacity: 100,
                      transform: { x: 0, y: 0, width: 1280, height: 720, rotation: 0 },
                      sourceConfig: {},
                      effects: [],
                    });
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 hover:bg-[var(--color-surface)] transition-colors"
                >
                  <IconCamera />
                  Camera
                </button>
                <button
                  onClick={() => { void toggleScreenShare(); setMenuOpen(false); }}
                  disabled={isScreenSharing}
                  className="w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 hover:bg-[var(--color-surface)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <IconMonitor />
                  Screen Capture
                  {isScreenSharing && (
                    <span className="ml-auto text-[10px] text-[var(--color-brand)]">Active</span>
                  )}
                </button>
                <button
                  disabled
                  className="w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 opacity-30 cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Image
                  <span className="ml-auto text-[10px]">Soon</span>
                </button>
                <button
                  disabled
                  className="w-full text-left px-3 py-2 text-[11px] flex items-center gap-2 opacity-30 cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                  Text
                  <span className="ml-auto text-[10px]">Soon</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Layer list — reversed so index 0 (bottom of stack) appears at bottom of list */}
      <div className="flex-1 overflow-y-auto">
        {[...activeScene.layers].reverse().map((layer) => (
          <div key={layer.id}>
            <LayerRow
              layer={layer}
              isActive={selectedLayerId === layer.id}
              onToggleVisible={() => handleToggleVisible(layer)}
              onSelect={() => setSelectedLayerId(layer.id)}
            />
            {layer.type === "camera" && activeScene.camCell && (
              <div className="px-2 pb-1 flex justify-end">
                <button
                  onClick={() => setActiveSceneCamCell(null)}
                  className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  title="Reset camera to auto-grid layout"
                >
                  ↺ reset to auto
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScenesPanel() {
  const { scenes, activeSceneId, addScene, switchScene } = useStudioStore();

  return (
    <div
      className="flex flex-col overflow-hidden border-b border-r border-[var(--color-surface-border)]"
      style={{ gridArea: "scenes" }}
    >
      <div
        className="flex items-center gap-2 px-3 border-b border-[var(--color-surface-border)] shrink-0"
        style={{ height: 36 }}
      >
        <IconScenes />
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex-1">
          Scenes
        </span>
        <button
          onClick={addScene}
          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          title="Add scene"
        >
          <IconPlus />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {scenes.map((scene) => (
          <button
            key={scene.id}
            onClick={() => switchScene(scene.id)}
            className={`w-full text-left px-3 py-2.5 text-[11px] transition-colors border-l-2 flex items-center gap-2 ${
              scene.id === activeSceneId
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-text)] font-semibold"
                : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
            }`}
          >
            <span className="flex-1 truncate">{scene.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Cam overlay (drag-to-position) ────────────────────────────────────────────

function CamOverlay({
  cell,
  containerRef,
  onLiveChange,
  onCommit,
}: {
  cell: CamCell;
  containerRef: React.RefObject<HTMLDivElement>;
  onLiveChange: (cell: CamCell) => void;
  onCommit: (cell: CamCell) => void;
}) {
  const [localCell, setLocalCell] = useState<CamCell>(cell);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!draggingRef.current) setLocalCell(cell);
  }, [cell]);

  const startRef = useRef<{
    type: "move" | "resize";
    corner?: "nw" | "ne" | "sw" | "se";
    cx: number;
    cy: number;
    cell: CamCell;
  } | null>(null);

  useEffect(() => {
    function computeNext(cx: number, cy: number): CamCell {
      const s = startRef.current!;
      const r = containerRef.current?.getBoundingClientRect();
      if (!r) return s.cell;
      const fx = (cx - s.cx) / r.width;
      const fy = (cy - s.cy) / r.height;
      const sc = s.cell;

      if (s.type === "move") {
        return {
          x: Math.max(0, Math.min(1 - sc.w, sc.x + fx)),
          y: Math.max(0, Math.min(1 - sc.h, sc.y + fy)),
          w: sc.w,
          h: sc.h,
        };
      }

      let nx = sc.x, ny = sc.y, nw = sc.w, nh = sc.h;
      if (s.corner === "nw" || s.corner === "sw") { nx = sc.x + fx; nw = sc.w - fx; }
      if (s.corner === "ne" || s.corner === "se") { nw = sc.w + fx; }
      if (s.corner === "nw" || s.corner === "ne") { ny = sc.y + fy; nh = sc.h - fy; }
      if (s.corner === "sw" || s.corner === "se") { nh = sc.h + fy; }
      nw = Math.max(0.08, nw);
      nh = Math.max(0.05, nh);
      nx = Math.max(0, Math.min(1 - nw, nx));
      ny = Math.max(0, Math.min(1 - nh, ny));
      return { x: nx, y: ny, w: nw, h: nh };
    }

    function onMove(e: PointerEvent) {
      if (!startRef.current) return;
      const next = computeNext(e.clientX, e.clientY);
      setLocalCell(next);
      onLiveChange(next);
    }

    function onUp(e: PointerEvent) {
      if (!startRef.current) return;
      const next = computeNext(e.clientX, e.clientY);
      startRef.current = null;
      draggingRef.current = false;
      setLocalCell(next);
      onCommit(next);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onLiveChange, onCommit, containerRef]);

  function onBodyDown(e: React.PointerEvent) {
    e.stopPropagation();
    startRef.current = { type: "move", cx: e.clientX, cy: e.clientY, cell: localCell };
    draggingRef.current = true;
  }

  function onCornerDown(e: React.PointerEvent, corner: "nw" | "ne" | "sw" | "se") {
    e.stopPropagation();
    startRef.current = { type: "resize", corner, cx: e.clientX, cy: e.clientY, cell: localCell };
    draggingRef.current = true;
  }

  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  const H = 8;
  const cursorMap: Record<string, string> = { nw: "nw-resize", ne: "ne-resize", sw: "sw-resize", se: "se-resize" };

  return (
    <div className="absolute inset-0 pointer-events-none select-none" style={{ zIndex: 10 }}>
      <div
        className="absolute pointer-events-auto"
        style={{
          left: pct(localCell.x),
          top: pct(localCell.y),
          width: pct(localCell.w),
          height: pct(localCell.h),
          border: "1.5px solid rgba(255,255,255,0.65)",
          cursor: "move",
          boxSizing: "border-box",
        }}
        onPointerDown={onBodyDown}
      >
        <span
          className="absolute top-1 left-1.5 text-[9px] font-bold uppercase tracking-widest pointer-events-none"
          style={{ color: "rgba(255,255,255,0.5)", textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
        >
          Camera
        </span>
        {(["nw", "ne", "sw", "se"] as const).map((corner) => (
          <div
            key={corner}
            className="absolute pointer-events-auto bg-white rounded-sm"
            style={{
              width: H, height: H,
              cursor: cursorMap[corner],
              left:   corner.includes("w") ? -(H / 2) : undefined,
              right:  corner.includes("e") ? -(H / 2) : undefined,
              top:    corner.includes("n") ? -(H / 2) : undefined,
              bottom: corner.includes("s") ? -(H / 2) : undefined,
            }}
            onPointerDown={(e) => onCornerDown(e, corner)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Preview canvas ────────────────────────────────────────────────────────────

function PreviewCanvas({
  stream,
  overlayCell,
  onCamLiveChange,
  onCamCommit,
}: {
  stream: MediaStream | null;
  overlayCell?: CamCell | null;
  onCamLiveChange?: (cell: CamCell) => void;
  onCamCommit?: (cell: CamCell) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) v.play().catch(() => {});
  }, [stream]);

  return (
    <div className="flex-1 flex items-center justify-center bg-black overflow-hidden min-w-0">
      <div
        ref={containerRef}
        className="relative bg-[#0a0a0a] overflow-hidden"
        style={{ aspectRatio: "16/9", maxWidth: "100%", maxHeight: "100%", width: "100%" }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full"
        />
        {!stream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 select-none opacity-20 pointer-events-none">
            <div className="w-12 h-12 rounded-lg border-2 border-dashed border-current flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <span className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)]">
              Starting camera…
            </span>
          </div>
        )}
        {overlayCell && onCamLiveChange && onCamCommit && (
          <CamOverlay
            cell={overlayCell}
            containerRef={containerRef as React.RefObject<HTMLDivElement>}
            onLiveChange={onCamLiveChange}
            onCommit={onCamCommit}
          />
        )}
      </div>
    </div>
  );
}

// ── Right icon strip ──────────────────────────────────────────────────────────

type RightPanelId = "transitions" | "source-props" | "chat" | "stream-info" | "settings";

function RightIconStrip({
  active,
  onSelect,
}: {
  active: RightPanelId | null;
  onSelect: (id: RightPanelId) => void;
}) {
  const topButtons: { id: RightPanelId; icon: React.ReactNode; label: string }[] = [
    { id: "transitions",  icon: <IconTransitions />,  label: "Transitions" },
    { id: "source-props", icon: <IconProperties />,   label: "Source properties" },
    { id: "chat",         icon: <IconChat />,          label: "Chat" },
    { id: "stream-info",  icon: <IconStreamInfo />,    label: "Stream info" },
  ];

  return (
    <div
      className="flex flex-col shrink-0 border-l border-[var(--color-surface-border)] bg-[var(--color-surface)]"
      style={{ width: 44 }}
    >
      <div className="flex flex-col flex-1 items-center pt-1 gap-0.5">
        {topButtons.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            title={label}
            className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${
              active === id
                ? "bg-[var(--color-brand)]/20 text-[var(--color-brand)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
            }`}
          >
            {icon}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center pb-1">
        <button
          onClick={() => onSelect("settings")}
          title="Settings"
          className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${
            active === "settings"
              ? "bg-[var(--color-brand)]/20 text-[var(--color-brand)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
          }`}
        >
          <IconSettings />
        </button>
      </div>
    </div>
  );
}

// ── Chat panel ────────────────────────────────────────────────────────────────

function ChatPanel({
  messages,
  chatBody,
  onChange,
  onSend,
}: {
  messages: ChatMessage[];
  chatBody: string;
  onChange: (v: string) => void;
  onSend: (e: React.FormEvent) => void;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-24">
            <p className="text-[11px] text-[var(--color-text-muted)]">No messages yet</p>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className="flex gap-2 items-start py-0.5 pl-2 rounded"
            style={{ borderLeft: `2px solid ${PLATFORM_COLOR[m.platform] ?? "#2a2a2e"}` }}
          >
            <div className="min-w-0">
              <span
                className="text-[11px] font-semibold"
                style={{ color: PLATFORM_COLOR[m.platform] ?? "var(--color-text-muted)" }}
              >
                {m.author_display_name}
              </span>
              <span className="text-[11px] text-[var(--color-text)] ml-1.5 break-words">
                {m.body}
              </span>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form
        onSubmit={onSend}
        className="flex gap-2 p-3 border-t border-[var(--color-surface-border)] shrink-0"
      >
        <input
          type="text"
          value={chatBody}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Message…"
          maxLength={500}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-[11px] focus:outline-none focus:border-[var(--color-brand)] transition-colors"
        />
        <button
          type="submit"
          disabled={!chatBody.trim()}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-[11px] font-semibold disabled:opacity-40 transition-colors shrink-0"
        >
          Send
        </button>
      </form>
    </>
  );
}

// ── Queue panel ───────────────────────────────────────────────────────────────

function QueueItem({
  participant,
  canGoLive,
  nextSlot,
  onApprove,
  onSetLive,
  onRemove,
}: {
  participant: Participant;
  canGoLive: boolean;
  nextSlot: number;
  onApprove: () => void;
  onSetLive: () => void;
  onRemove: () => void;
}) {
  const initial = participant.display_name[0].toUpperCase();
  const isWaiting = participant.status === "waiting";

  return (
    <div className="px-3 py-3 space-y-2.5 border-b border-[var(--color-surface-border)]">
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold truncate">{participant.display_name}</p>
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${
            isWaiting
              ? "bg-amber-500/15 text-amber-400"
              : "bg-blue-500/15 text-blue-400"
          }`}
        >
          {participant.status}
        </span>
      </div>

      <div className="flex gap-1.5">
        {isWaiting && (
          <button
            onClick={onApprove}
            className="flex-1 py-1 rounded text-[10px] font-semibold border border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white transition-colors"
          >
            Approve
          </button>
        )}
        {!isWaiting && canGoLive && (
          <button
            onClick={onSetLive}
            className="flex-1 py-1 rounded text-[10px] font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            Set live → {nextSlot + 1}
          </button>
        )}
        <button
          onClick={onRemove}
          className="px-2.5 py-1 rounded text-[10px] font-semibold border border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-red-500 hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function QueuePanel({
  waiting,
  approved,
  nextSlot,
  onChangeStatus,
}: {
  waiting: Participant[];
  approved: Participant[];
  nextSlot: number;
  onChangeStatus: (id: string, status: ParticipantStatus, slot?: number) => void;
}) {
  const queue = [...waiting, ...approved];

  return (
    <div className="flex-1 overflow-y-auto min-h-0">
      {queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <span className="text-2xl opacity-20">👥</span>
          <p className="text-[11px] text-[var(--color-text-muted)]">No one waiting</p>
        </div>
      ) : (
        queue.map((p) => (
          <QueueItem
            key={p.id}
            participant={p}
            canGoLive={nextSlot !== -1}
            nextSlot={nextSlot}
            onApprove={() => onChangeStatus(p.id, "approved")}
            onSetLive={() => onChangeStatus(p.id, "live", nextSlot)}
            onRemove={() => onChangeStatus(p.id, "removed")}
          />
        ))
      )}
    </div>
  );
}

// ── Settings panel ────────────────────────────────────────────────────────────

function SettingsPanel({
  targetFps,
  onSetTargetFps,
}: {
  targetFps: 30 | 60;
  onSetTargetFps: (v: 30 | 60) => void;
}) {
  return (
    <div className="p-4 space-y-5">
      <div>
        <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Frame Rate
        </p>
        <div className="flex gap-1">
          {([30, 60] as const).map((fps) => (
            <button
              key={fps}
              onClick={() => onSetTargetFps(fps)}
              className={`flex-1 py-1.5 rounded text-[11px] font-semibold border transition-colors ${
                targetFps === fps
                  ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-white"
                  : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
              }`}
            >
              {fps} fps
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
          60 fps uses more CPU and bandwidth
        </p>
      </div>
    </div>
  );
}

// ── Right panel ───────────────────────────────────────────────────────────────

function RightPanel({
  panel,
  chatProps,
  queueProps,
  settingsProps,
}: {
  panel: RightPanelId | null;
  chatProps: {
    messages: ChatMessage[];
    chatBody: string;
    onChange: (v: string) => void;
    onSend: (e: React.FormEvent) => void;
  };
  queueProps: {
    waiting: Participant[];
    approved: Participant[];
    nextSlot: number;
    onChangeStatus: (id: string, status: ParticipantStatus, slot?: number) => void;
  };
  settingsProps: {
    targetFps: 30 | 60;
    onSetTargetFps: (v: 30 | 60) => void;
  };
}) {
  if (!panel) return null;

  const labels: Record<RightPanelId, string> = {
    "transitions":  "Transitions",
    "source-props": "Source Properties",
    "chat":         "Chat",
    "stream-info":  "Queue",
    "settings":     "Settings",
  };

  return (
    <div
      className="flex flex-col shrink-0 border-l border-[var(--color-surface-border)] bg-[var(--color-surface-raised)] overflow-hidden"
      style={{ width: 280 }}
    >
      <div
        className="flex items-center px-4 border-b border-[var(--color-surface-border)] shrink-0"
        style={{ height: 36 }}
      >
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex-1">
          {labels[panel]}
        </span>
        {panel === "stream-info" && queueProps.waiting.length + queueProps.approved.length > 0 && (
          <span className="text-[10px] font-bold bg-[var(--color-brand)] text-white rounded-full px-1.5 py-0.5 leading-none">
            {queueProps.waiting.length + queueProps.approved.length}
          </span>
        )}
      </div>
      {panel === "chat" ? (
        <ChatPanel {...chatProps} />
      ) : panel === "stream-info" ? (
        <QueuePanel {...queueProps} />
      ) : panel === "settings" ? (
        <SettingsPanel {...settingsProps} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[11px] text-[var(--color-text-muted)] select-none">{labels[panel]} panel</p>
        </div>
      )}
    </div>
  );
}


// ── Inspector panel ──────────────────────────────────────────────────────────

function TransformSection({
  sceneId,
  layer,
  onUpdateLayer,
}: {
  sceneId: string;
  layer: Layer;
  onUpdateLayer: (patch: Partial<Layer>) => void;
}) {
  const t = layer.transform;

  function patchTransform(field: keyof typeof t, raw: string) {
    const v = parseFloat(raw);
    if (isNaN(v)) return;
    onUpdateLayer({ transform: { ...t, [field]: v } });
  }

  return (
    <div className="px-3 py-3 space-y-3 border-t border-[var(--color-surface-border)]">
      <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Transform</p>

      <div className="space-y-1">
        <div className="flex justify-between">
          <label className="text-[10px] text-[var(--color-text-muted)]">Opacity</label>
          <span className="text-[10px] font-mono text-[var(--color-text)]">{layer.opacity}%</span>
        </div>
        <input
          type="range" min={0} max={100} value={layer.opacity}
          onChange={(e) => onUpdateLayer({ opacity: Number(e.target.value) })}
          className="w-full h-1 cursor-pointer accent-[var(--color-brand)]"
          data-scene-id={sceneId}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["x", "y"] as const).map((field) => (
          <div key={field}>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5 uppercase">{field}</label>
            <input
              type="number" value={t[field]}
              onChange={(e) => patchTransform(field, e.target.value)}
              className="w-full px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-[11px] font-mono focus:outline-none focus:border-[var(--color-brand)] transition-colors"
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["width", "height"] as const).map((field) => (
          <div key={field}>
            <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">
              {field === "width" ? "W" : "H"}
            </label>
            <input
              type="number" value={t[field]}
              onChange={(e) => patchTransform(field, e.target.value)}
              className="w-full px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-[11px] font-mono focus:outline-none focus:border-[var(--color-brand)] transition-colors"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-[10px] text-[var(--color-text-muted)] block mb-0.5">Rotation °</label>
        <input
          type="number" value={t.rotation} step={1}
          onChange={(e) => patchTransform("rotation", e.target.value)}
          className="w-full px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-[11px] font-mono focus:outline-none focus:border-[var(--color-brand)] transition-colors"
        />
      </div>
    </div>
  );
}

function Inspector({
  chatProps,
  queueProps,
}: {
  chatProps: {
    messages: ChatMessage[];
    chatBody: string;
    onChange: (v: string) => void;
    onSend: (e: React.FormEvent) => void;
  };
  queueProps: {
    waiting: Participant[];
    approved: Participant[];
    nextSlot: number;
    onChangeStatus: (id: string, status: ParticipantStatus, slot?: number) => void;
  };
}) {
  const [tab, setTab] = useState<"properties" | "chat" | "queue">("properties");
  const {
    scenes, activeSceneId,
    selectedLayerId, setSelectedLayerId,
    updateLayer, updateScene,
  } = useStudioStore();
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const selectedLayer = selectedLayerId
    ? (activeScene.layers.find((l) => l.id === selectedLayerId) ?? null)
    : null;

  return (
    <div
      className="flex flex-col overflow-hidden border-l border-[var(--color-surface-border)]"
      style={{ gridArea: "inspector", background: "var(--bg-base, #111122)" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 border-b border-[var(--color-surface-border)] shrink-0"
        style={{ height: 36 }}
      >
        <IconProperties />
        <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex-1">
          Inspector
        </span>
        {tab === "properties" && selectedLayer && (
          <button
            onClick={() => setSelectedLayerId(null)}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            title="Deselect"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tab strip */}
      <div className="flex shrink-0 border-b border-[var(--color-surface-border)]">
        {(["properties", "chat", "queue"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[var(--color-brand)] text-[var(--color-text)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {t}
            {t === "queue" && queueProps.waiting.length > 0 && (
              <span className="absolute top-1 right-2 w-3.5 h-3.5 flex items-center justify-center rounded-full bg-[var(--color-brand)] text-white text-[8px] font-bold leading-none">
                {queueProps.waiting.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {tab === "properties" && (
          <div className="flex-1 overflow-y-auto">
            {!selectedLayer ? (
              /* No selection — scene properties */
              <div className="px-3 py-3 space-y-4">
                <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Scene</p>

                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Name</label>
                  <p className="px-2 py-1 rounded bg-[var(--color-surface)] border border-[var(--color-surface-border)] text-[11px] text-[var(--color-text)]">
                    {activeScene.name}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] block mb-1">Background</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={activeScene.bgColor}
                      onChange={(e) => updateScene(activeScene.id, { bgColor: e.target.value })}
                      className="w-8 h-8 rounded border border-[var(--color-surface-border)] bg-transparent cursor-pointer p-0.5"
                    />
                    <span className="text-[11px] font-mono text-[var(--color-text-muted)]">{activeScene.bgColor}</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--color-text-muted)] block mb-1.5">Transition</label>
                  <div className="flex gap-1">
                    {(["cut", "fade", "slide"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          updateScene(activeScene.id, {
                            transition: { ...activeScene.transition, type },
                          })
                        }
                        className={`flex-1 py-1 rounded text-[10px] font-semibold border transition-colors capitalize ${
                          activeScene.transition.type === type
                            ? "bg-[var(--color-brand)] border-[var(--color-brand)] text-white"
                            : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Layer selected — source header + transform */
              <>
                <div className="px-3 py-3">
                  <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                    {selectedLayer.type === "camera"
                      ? "Camera"
                      : selectedLayer.type === "screenshare"
                      ? "Screen Capture"
                      : "Layer"}
                  </p>
                  <div className="flex items-center gap-2 px-2 py-2 rounded bg-[var(--color-surface)] border border-[var(--color-surface-border)]">
                    <span className="text-[var(--color-text-muted)] shrink-0">
                      {layerTypeIcon(selectedLayer.type)}
                    </span>
                    <span className="text-[11px] text-[var(--color-text)] truncate">{selectedLayer.name}</span>
                  </div>
                </div>
                {selectedLayer.sourceUnavailable && (
                  <div
                    className="mx-3 mb-3 flex items-center gap-2 px-3 py-2 rounded border text-[11px]"
                    style={{
                      background: "rgba(255,170,0,0.08)",
                      borderColor: "#FFAA00",
                      color: "#FFAA00",
                    }}
                  >
                    <span style={{ fontSize: 13 }}>⚠</span>
                    Source unavailable — check device connection
                  </div>
                )}
                <TransformSection
                  sceneId={activeScene.id}
                  layer={selectedLayer}
                  onUpdateLayer={(patch) => updateLayer(activeScene.id, selectedLayer.id, patch)}
                />
              </>
            )}
          </div>
        )}
        {tab === "chat" && <ChatPanel {...chatProps} />}
        {tab === "queue" && <QueuePanel {...queueProps} />}
      </div>
    </div>
  );
}

// ── Stream pulse bar ──────────────────────────────────────────────────────────

function BitrateSparkline({ data }: { data: number[] }) {
  const W = 64, H = 20;
  if (data.length < 2) return <svg width={W} height={H} />;
  const peak = Math.max(...data, 1000);
  const pts = data
    .map((v, i) => `${((i / (data.length - 1)) * W).toFixed(1)},${(H - (v / peak) * H).toFixed(1)}`)
    .join(" ");
  const latest = data[data.length - 1] ?? 0;
  const stroke = latest > 2000 ? "#22c55e" : latest > 500 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StreamPulse({ localAudioTrack, onClipClick }: { localAudioTrack: ILocalAudioTrack | null; onClipClick: () => void }) {
  const { scenes, activeSceneId, switchScene, streamStatus, fps, bitrateKbps, updateLayer } = useStudioStore();
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const cameraLayer = activeScene.layers.find((l) => l.type === "camera") ?? null;

  const [micMuted, setMicMuted] = useState(false);
  const [bitrateHistory, setBitrateHistory] = useState<number[]>([]);

  useEffect(() => {
    setBitrateHistory((prev) => {
      const next = [...prev, bitrateKbps];
      return next.length > 30 ? next.slice(-30) : next;
    });
  }, [bitrateKbps]);

  function toggleMic() {
    if (!localAudioTrack) return;
    const next = !micMuted;
    localAudioTrack.setEnabled(!next).catch(() => {});
    setMicMuted(next);
  }

  function toggleCamera() {
    if (!cameraLayer) return;
    updateLayer(activeScene.id, cameraLayer.id, { visible: !cameraLayer.visible });
  }

  const statusColor =
    streamStatus === "live" ? "#ef4444" :
    streamStatus === "connecting" ? "#f59e0b" :
    "#3f3f46";
  const statusLabel =
    streamStatus === "live" ? "LIVE" :
    streamStatus === "connecting" ? "CONNECTING" :
    "OFFLINE";

  return (
    <div
      className="flex items-center gap-4 px-4 border-t border-[var(--color-surface-border)]"
      style={{ gridArea: "mixer", background: "var(--bg-deep, #0A0A18)" }}
    >
      {/* Scene filmstrip */}
      <div className="flex items-center gap-1.5 overflow-x-auto shrink-0" style={{ maxWidth: 260 }}>
        {scenes.map((scene: Scene) => (
          <button
            key={scene.id}
            onClick={() => switchScene(scene.id)}
            className={`shrink-0 flex items-center justify-center rounded text-[9px] font-bold tracking-wide transition-all ${
              scene.id === activeSceneId
                ? "ring-1 ring-[var(--color-brand)] bg-[var(--color-brand)]/15 text-[var(--color-text)]"
                : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
            }`}
            style={{ width: 48, height: 28 }}
            title={scene.name}
          >
            {scene.name.replace("Scene ", "S").slice(0, 3)}
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-[var(--color-surface-border)] shrink-0" />

      {/* Stream health */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${streamStatus === "live" ? "animate-pulse" : ""}`}
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-[10px] font-bold tracking-widest tabular-nums" style={{ color: statusColor }}>
            {statusLabel}
          </span>
        </div>
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums shrink-0">
          FPS <span className="text-[var(--color-text)]">{fps ?? "—"}</span>
        </span>
        <BitrateSparkline data={bitrateHistory} />
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] tabular-nums shrink-0">
          {streamStatus === "live" && bitrateKbps > 0
            ? `${bitrateKbps.toLocaleString()} kbps`
            : "— kbps"}
        </span>
      </div>

      {/* Quick actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={toggleMic}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            micMuted
              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
          }`}
          title={micMuted ? "Unmute mic" : "Mute mic"}
        >
          {micMuted ? <IconMicOff /> : <IconMic />}
        </button>
        <button
          onClick={toggleCamera}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
            cameraLayer && !cameraLayer.visible
              ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
          }`}
          title={cameraLayer?.visible ? "Hide camera" : "Show camera"}
        >
          <IconCamera />
        </button>
        <button
          onClick={onClipClick}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
          title="Save clip (last ~60s)"
        >
          <IconScissors />
        </button>
        <div className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--color-surface)] text-[var(--color-text-muted)]">
          <IconUsers />
          <span className="text-[10px] font-mono tabular-nums">0</span>
        </div>
      </div>
    </div>
  );
}

// ── Studio root ───────────────────────────────────────────────────────────────

export default function Studio({
  sessionId,
  token,
  creatorName,
  channelName,
  slug,
}: {
  sessionId: string;
  token: string;
  creatorName: string;
  channelName: string;
  slug: string;
}) {
  const [activePanel, setActivePanel] = useState<RightPanelId | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);

  const {
    streamStatus, setStreamStatus, setStreamError, setFps,
    targetFps, setTargetFps,
    setBitrateKbps,
    setIsRecording: storeSetIsRecording,
    setStreamDuration,
    scenes, activeSceneId,
    isTransitioning,
    setActiveSceneCamCell,
    addToast,
  } = useStudioStore();
  const activeScene = scenes.find((s) => s.id === activeSceneId) ?? scenes[0];
  const cameraLayer = activeScene?.layers.find((l) => l.type === "camera");
  const cameraVisible = cameraLayer?.visible ?? false;

  // Stable ref so the relay sync effect can read current streamStatus without a stale closure
  const streamStatusRef = useRef(streamStatus);
  streamStatusRef.current = streamStatus;

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket(token);
    socket.connect();

    const onJoin: SessionJoinAck = (err, state) => {
      if (err || !state) return;
      setMessages(state.recentMessages.slice(-MAX_CHAT));
      setParticipants(state.participants);
    };
    socket.emit("session:join", { session_id: sessionId }, onJoin);

    socket.on("chat:message", ({ message }: { message: ChatMessage }) => {
      setMessages((prev) => [...prev.slice(-MAX_CHAT + 1), message]);
    });
    socket.on("participant:queue_update", ({ participants: updated }: { participants: Participant[] }) => {
      setParticipants(updated);
    });
    socket.on("participant:status_change", ({ participant }: { participant: Participant }) => {
      setParticipants((prev) => prev.map((p) => (p.id === participant.id ? participant : p)));
    });

    return () => {
      socket.emit("session:leave", { session_id: sessionId });
      socket.off("chat:message");
      socket.off("participant:queue_update");
      socket.off("participant:status_change");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatBody.trim()) return;
    const socket = getSocket(token);
    socket.emit("chat:message", {
      session_id: sessionId,
      body: chatBody.trim(),
      display_name: creatorName,
      platform_origin: "ditch",
    });
    setChatBody("");
  }

  function changeParticipantStatus(id: string, status: ParticipantStatus, slot_index?: number) {
    const socket = getSocket(token);
    socket.emit("participant:status_change", { session_id: sessionId, participant_id: id, status, slot_index });
  }

  // ── Derived queue state ──────────────────────────────────────────────────────
  const liveParticipants = participants.filter((p) => p.status === "live");
  const waiting          = participants.filter((p) => p.status === "waiting");
  const approved         = participants.filter((p) => p.status === "approved");
  const slots            = Array.from({ length: TOTAL_SLOTS }, (_, i) => liveParticipants.find((p) => p.slot_index === i) ?? null);
  const nextSlot         = slots.findIndex((s) => s === null);

  // ── Media hooks ─────────────────────────────────────────────────────────────
  const {
    localVideoTrack,
    localScreenTrack,
    localAudioTrack,
    remoteUsers,
    isScreenSharing,
    toggleScreenShare,
  } = useAgoraRoom({
    channelName: sessionId,
    uid: CREATOR_CAM_UID,
    role: "host",
    publish: true,
    enabled: true,
    screenShareUid: CREATOR_SCREEN_UID,
  });

  useStudioShortcuts({ localAudioTrack });

  // Auto-name camera layers using real device label + mark unavailable if no camera found.
  // Re-runs when localVideoTrack changes (permissions may have just been granted).
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const cameras = devices.filter((d) => d.kind === "videoinput");
      const unavailable = cameras.length === 0;
      const label = cameras[0]?.label || "";
      const s = useStudioStore.getState();
      s.scenes.forEach((sc) => {
        sc.layers.forEach((l) => {
          if (l.type !== "camera") return;
          const name = label || l.name;
          if (name !== l.name || unavailable !== !!l.sourceUnavailable) {
            s.updateLayer(sc.id, l.id, { name, sourceUnavailable: unavailable });
          }
        });
      });
    });
  }, [localVideoTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync Agora track enabled state with the camera layer's visible field.
  // The cancelled flag prevents stale async rejections from racing.
  useEffect(() => {
    if (!localVideoTrack) return;
    let cancelled = false;
    localVideoTrack.setEnabled(cameraVisible).catch(() => {
      if (!cancelled) console.warn("setEnabled skipped — track not ready");
    });
    return () => { cancelled = true; };
  }, [cameraVisible, localVideoTrack]);

  // Compositor always runs so the preview canvas is live regardless of stream state.
  const { stream: compositeStream, setCamCellLive } = useCompositor({
    localVideoTrack,
    localScreenTrack,
    localAudioTrack,
    remoteUsers,
    liveParticipants,
    enabled: true,
    creatorVisible: cameraVisible,
    camCell: activeScene.camCell,
    targetFps,
    onFps: setFps,
  });

  // Relay stream — only active when streamStatus !== 'offline'.
  const { streaming: relayStreaming, error: relayError } = useRelayStream({
    stream: compositeStream,
    sessionId,
    token,
    enabled: streamStatus !== "offline",
    onBitrate: setBitrateKbps,
  });

  // Sync relay connection state into store.
  // When relay connects → 'live'. When relay drops → 'connecting' (keeps enabled=true for auto-reconnect).
  // When user clicks End Stream, streamStatus is already 'offline' so the else-if never fires.
  useEffect(() => {
    if (relayStreaming) {
      setStreamStatus("live");
    } else if (streamStatusRef.current === "live") {
      setStreamStatus("connecting");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relayStreaming, setStreamStatus]);
  useEffect(() => { setStreamError(relayError); }, [relayError, setStreamError]);

  // Recording + clip buffer
  const { isRecording: localIsRecording, elapsed, startRecording, stopRecording } = useRecorder(compositeStream);
  const { saveClip } = useClipBuffer(compositeStream);

  // Sync recording state into store so TopBar can read it
  useEffect(() => { storeSetIsRecording(localIsRecording); }, [localIsRecording, storeSetIsRecording]);
  useEffect(() => { setStreamDuration(elapsed); }, [elapsed, setStreamDuration]);

  // Stream event toasts
  const prevRelayStreaming = useRef(false);
  useEffect(() => {
    if (relayStreaming && !prevRelayStreaming.current) {
      addToast("Stream started", "success");
    } else if (!relayStreaming && prevRelayStreaming.current) {
      addToast("Stream ended", "info");
    }
    prevRelayStreaming.current = relayStreaming;
  }, [relayStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (relayError) addToast(relayError, "error");
  }, [relayError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera unavailable toast (once, if no track after 4 s)
  const cameraWarnedRef = useRef(false);
  useEffect(() => {
    if (localVideoTrack || cameraWarnedRef.current) return;
    const t = setTimeout(() => {
      if (!localVideoTrack && !cameraWarnedRef.current) {
        cameraWarnedRef.current = true;
        addToast("Camera not found", "warning");
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [localVideoTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRecordClick() {
    if (localIsRecording) {
      stopRecording();
      addToast("Recording saved to downloads", "success");
    } else {
      startRecording();
      addToast("Recording started", "success");
    }
  }

  function handleClipClick() {
    saveClip();
    addToast("Clip saved", "success");
  }

  // Overlay cell: where to show the cam drag handle in the preview.
  // When camCell is null (auto), compute from getLayout so the handle sits on the real camera position.
  const autoRect = getLayout(cameraVisible, liveParticipants.length)[0];
  const autoCell = autoRect
    ? { x: autoRect.x / 1280, y: autoRect.y / 720, w: autoRect.w / 1280, h: autoRect.h / 720 }
    : null;
  const overlayCell = cameraVisible
    ? (activeScene.camCell ?? autoCell)
    : null;

  function togglePanel(id: RightPanelId) {
    setActivePanel((prev) => (prev === id ? null : id));
  }

  return (
    <>
      <div
        className="text-[var(--color-text)]"
        style={{
          display: "grid",
          gridTemplateAreas: `"topbar topbar topbar" "scenes canvas inspector" "layers canvas inspector" "mixer mixer mixer"`,
          gridTemplateColumns: "220px 1fr 280px",
          gridTemplateRows: "48px 1fr 1fr 64px",
          height: "100vh",
          overflow: "hidden",
          background: "var(--bg-deep, #0A0A18)",
        }}
      >
        <TopBar slug={slug} onRecordClick={handleRecordClick} />
        <ScenesPanel />
        <LayersPanel
          localVideoTrack={localVideoTrack}
          isScreenSharing={isScreenSharing}
          toggleScreenShare={toggleScreenShare}
        />
        <div
          style={{
            gridArea: "canvas",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            ...(isTransitioning && activeScene.transition.type !== "cut"
              ? {
                  animation: `${activeScene.transition.type === "fade" ? "sceneFadeIn" : "sceneSlideIn"} ${activeScene.transition.durationMs}ms ease both`,
                }
              : {}),
          }}
        >
          <PreviewCanvas
            stream={compositeStream}
            overlayCell={overlayCell}
            onCamLiveChange={setCamCellLive}
            onCamCommit={setActiveSceneCamCell}
          />
        </div>
        <Inspector
          chatProps={{ messages, chatBody, onChange: setChatBody, onSend: sendChat }}
          queueProps={{ waiting, approved, nextSlot, onChangeStatus: changeParticipantStatus }}
        />
        <StreamPulse localAudioTrack={localAudioTrack} onClipClick={handleClipClick} />
      </div>
      <style>{`
        @keyframes sceneFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes sceneSlideIn {
          from { transform: translateX(-24px); opacity: 0; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
      <ToastManager />
    </>
  );
}
