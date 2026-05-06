"use client";

import { useEffect, useRef, useState } from "react";
import { useAgoraRoom } from "@/hooks/useAgoraRoom";
import { useCompositor } from "@/hooks/useCompositor";
import { useRelayStream } from "@/hooks/useRelayStream";
import { CREATOR_CAM_UID, CREATOR_SCREEN_UID } from "@/lib/agora";
import { getSocket, type SessionJoinAck } from "@/lib/socket";
import { useStudioStore } from "@/lib/studio-store";
import type { ChatMessage, Participant, ParticipantStatus } from "@ditch/types";
import type { ILocalVideoTrack } from "agora-rtc-sdk-ng";

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

// ── Top bar ───────────────────────────────────────────────────────────────────

function TopBar({ slug }: { slug: string }) {
  const { streamingEnabled, streaming, streamError, fps, setStreamingEnabled } = useStudioStore();

  const goLiveLabel = streaming
    ? "End Stream"
    : streamingEnabled
    ? "Connecting…"
    : "Go Live";

  const goLiveCls = streaming
    ? "border-2 border-red-500 text-red-400 hover:bg-red-500/10"
    : streamingEnabled
    ? "bg-red-700/60 text-red-200 cursor-wait pointer-events-none"
    : "bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white";

  return (
    <div
      className="flex items-center shrink-0 border-b border-[var(--color-surface-border)] bg-[var(--color-surface)] px-3 gap-3"
      style={{ height: 44 }}
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
            {streaming && (
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
          className="h-7 px-3 rounded text-[11px] font-semibold border border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          title="Clip (coming soon)"
        >
          Clip
        </button>
        <button
          className="h-7 px-3 rounded text-[11px] font-semibold border border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          title="Record (coming soon)"
        >
          Record
        </button>
        <button
          onClick={() => setStreamingEnabled((v) => !v)}
          className={`h-7 px-4 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all ${goLiveCls}`}
          title={goLiveLabel}
        >
          <IconRadio />
          {goLiveLabel}
        </button>
      </div>
    </div>
  );
}

// ── Left sidebar ──────────────────────────────────────────────────────────────

function LayerRow({
  icon,
  name,
  visible,
  dimmed,
  onToggle,
}: {
  icon: React.ReactNode;
  name: string;
  visible: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-2 py-2 group hover:bg-[var(--color-surface-raised)] transition-colors ${dimmed ? "opacity-40" : ""}`}
    >
      <span className="text-[var(--color-surface-border)] select-none leading-none" style={{ fontSize: 16 }}>
        ⠿
      </span>
      <span className="text-[var(--color-text-muted)] shrink-0">{icon}</span>
      <span className="flex-1 text-[11px] text-[var(--color-text)] truncate">{name}</span>
      <button
        onClick={onToggle}
        className="w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        title={visible ? "Hide" : "Show"}
      >
        {visible ? <IconEye /> : <IconEyeOff />}
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
  const { camVisible, setCamVisible } = useStudioStore();
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleCam() {
    if (!localVideoTrack) return;
    const next = !camVisible;
    localVideoTrack.setEnabled(next);
    setCamVisible(next);
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
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

      <div className="flex-1 overflow-y-auto">
        <LayerRow
          icon={<IconCamera />}
          name="Camera"
          visible={camVisible}
          dimmed={!camVisible}
          onToggle={toggleCam}
        />
        {isScreenSharing && (
          <LayerRow
            icon={<IconMonitor />}
            name="Screen Capture"
            visible={true}
            onToggle={() => void toggleScreenShare()}
          />
        )}
        {!localVideoTrack && !isScreenSharing && (
          <div className="flex items-center justify-center h-16">
            <p className="text-[11px] text-[var(--color-text-muted)] select-none">Starting camera…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScenesPanel() {
  const { scenes, activeSceneId, addScene, switchScene } = useStudioStore();

  return (
    <div
      className="flex flex-col shrink-0 border-t border-[var(--color-surface-border)]"
      style={{ height: 180 }}
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
            className={`w-full text-left px-3 py-2.5 text-[11px] transition-colors border-l-2 ${
              scene.id === activeSceneId
                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-text)] font-semibold"
                : "border-transparent text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
            }`}
          >
            {scene.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function LeftSidebar({
  localVideoTrack,
  isScreenSharing,
  toggleScreenShare,
}: {
  localVideoTrack: ILocalVideoTrack | null;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
}) {
  return (
    <div
      className="flex flex-col shrink-0 border-r border-[var(--color-surface-border)] overflow-hidden"
      style={{ width: 220 }}
    >
      <LayersPanel
        localVideoTrack={localVideoTrack}
        isScreenSharing={isScreenSharing}
        toggleScreenShare={toggleScreenShare}
      />
      <ScenesPanel />
    </div>
  );
}

// ── Preview canvas ────────────────────────────────────────────────────────────

function PreviewCanvas({ stream }: { stream: MediaStream | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) v.play().catch(() => {});
  }, [stream]);

  return (
    <div className="flex-1 flex items-center justify-center bg-black overflow-hidden min-w-0">
      <div
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

// ── Right panel ───────────────────────────────────────────────────────────────

function RightPanel({
  panel,
  chatProps,
  queueProps,
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
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[11px] text-[var(--color-text-muted)] select-none">{labels[panel]} panel</p>
        </div>
      )}
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

  const { streamingEnabled, setStreaming, setStreamError, setFps } = useStudioStore();

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

  // Compositor always runs so the preview canvas is live regardless of stream state.
  const { stream: compositeStream } = useCompositor({
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    liveParticipants,
    enabled: true,
    onFps: setFps,
  });

  // Relay stream — only active when Go Live is clicked.
  const { streaming, error: streamError } = useRelayStream({
    stream: compositeStream,
    sessionId,
    token,
    enabled: streamingEnabled,
  });

  // Sync relay state into the store so TopBar can read it.
  useEffect(() => { setStreaming(streaming); }, [streaming, setStreaming]);
  useEffect(() => { setStreamError(streamError); }, [streamError, setStreamError]);

  function togglePanel(id: RightPanelId) {
    setActivePanel((prev) => (prev === id ? null : id));
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--color-surface)] text-[var(--color-text)]">
      <TopBar slug={slug} />

      <div className="flex flex-1 overflow-hidden min-h-0">
        <LeftSidebar
          localVideoTrack={localVideoTrack}
          isScreenSharing={isScreenSharing}
          toggleScreenShare={toggleScreenShare}
        />
        <PreviewCanvas stream={compositeStream} />
        {activePanel && (
          <RightPanel
            panel={activePanel}
            chatProps={{ messages, chatBody, onChange: setChatBody, onSend: sendChat }}
            queueProps={{ waiting, approved, nextSlot, onChangeStatus: changeParticipantStatus }}
          />
        )}
        <RightIconStrip active={activePanel} onSelect={togglePanel} />
      </div>
    </div>
  );
}
