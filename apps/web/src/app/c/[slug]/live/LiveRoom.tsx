"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getSocket, type SessionJoinAck } from "@/lib/socket";
import { useAgoraRoom } from "@/hooks/useAgoraRoom";
import { useCompositor } from "@/hooks/useCompositor";
import { useRelayStream } from "@/hooks/useRelayStream";
import { slotToUid, CREATOR_CAM_UID, CREATOR_SCREEN_UID } from "@/lib/agora";
import type { ChatMessage, Participant, ParticipantStatus } from "@ditch/types";

const AgoraVideoTile = dynamic(() => import("@/components/AgoraVideoTile"), { ssr: false });

const MAX_CHAT = 200;
const TOTAL_SLOTS = 4;

const PLATFORM_COLOR: Record<string, string> = {
  twitch: "#9146ff",
  youtube: "#ff0000",
  tiktok: "#ff0050",
  kick: "#53fc18",
  ditch: "var(--accent-primary)",
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconMic() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconMicOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function IconCameraOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06A4 4 0 0 1 8.56 13.1" />
      <polygon points="23 7 16 12 23 17 23 7" />
    </svg>
  );
}

function IconScreen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function IconScreenOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.5 1-2 1-2" />
      <path d="M22 15V5a2 2 0 0 0-2-2H9" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconRadio() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

// ─── Platform badge ───────────────────────────────────────────────────────────

function PlatformDot({ platform }: { platform: string }) {
  const color = PLATFORM_COLOR[platform] ?? "#71717a";
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      title={platform}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LiveRoom({
  sessionId,
  token,
  creatorName,
}: {
  sessionId: string;
  token: string;
  creatorName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket(token);
    socket.connect();

    const onJoin: SessionJoinAck = (err, state) => {
      if (err) return;
      if (state) {
        setParticipants(state.participants);
        setMessages(state.recentMessages.slice(-MAX_CHAT));
      }
    };
    socket.emit("session:join", { session_id: sessionId }, onJoin);

    socket.on("chat:message", ({ message }) => {
      setMessages((prev) => [...prev.slice(-MAX_CHAT + 1), message]);
    });
    socket.on("participant:queue_update", ({ participants: updated }) => {
      setParticipants(updated);
    });
    socket.on("participant:status_change", ({ participant }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === participant.id ? participant : p))
      );
    });

    return () => {
      socket.emit("session:leave", { session_id: sessionId });
      socket.off("chat:message");
      socket.off("participant:queue_update");
      socket.off("participant:status_change");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const liveParticipants = participants.filter((p) => p.status === "live");

  const { stream: compositeStream } = useCompositor({
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    liveParticipants,
    enabled: streamingEnabled,
  });

  const { streaming, error: streamError } = useRelayStream({
    stream: compositeStream,
    sessionId,
    token,
    enabled: streamingEnabled,
  });

  function toggleMic() {
    if (!localAudioTrack) return;
    const next = !micEnabled;
    localAudioTrack.setEnabled(next);
    setMicEnabled(next);
  }

  function toggleCam() {
    if (!localVideoTrack) return;
    const next = !camEnabled;
    localVideoTrack.setEnabled(next);
    setCamEnabled(next);
  }

  function changeParticipantStatus(
    participant_id: string,
    status: ParticipantStatus,
    slot_index?: number
  ) {
    const socket = getSocket(token);
    socket.emit("participant:status_change", {
      session_id: sessionId,
      participant_id,
      status,
      slot_index,
    });
  }

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

  const waiting = participants.filter((p) => p.status === "waiting");
  const approved = participants.filter((p) => p.status === "approved");
  const queueCount = waiting.length + approved.length;

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) =>
    liveParticipants.find((p) => p.slot_index === i) ?? null
  );
  const nextSlot = slots.findIndex((s) => s === null);

  const goLiveLabel = streaming
    ? "End stream"
    : streamingEnabled
    ? "Connecting…"
    : "Go live";

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden bg-[var(--color-surface)]">

      {/* ── Left: Queue ───────────────────────────────────────────────── */}
      <aside className="w-60 border-r border-[var(--color-surface-border)] flex flex-col overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-[var(--color-surface-border)] flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Queue
          </span>
          {queueCount > 0 && (
            <span className="ml-auto text-[10px] font-bold bg-[var(--color-brand)] text-white rounded-full px-1.5 py-0.5 leading-none">
              {queueCount}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {queueCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <span className="text-2xl opacity-20">👥</span>
              <p className="text-xs text-[var(--color-text-muted)]">No one waiting</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-surface-border)]">
              {[...waiting, ...approved].map((p) => (
                <QueueItem
                  key={p.id}
                  participant={p}
                  canGoLive={nextSlot !== -1}
                  nextSlot={nextSlot}
                  onApprove={() => changeParticipantStatus(p.id, "approved")}
                  onSetLive={() => changeParticipantStatus(p.id, "live", nextSlot)}
                  onRemove={() => changeParticipantStatus(p.id, "removed")}
                />
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Center: Stage ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Stage header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-surface-border)] shrink-0">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex-1">
            Stage
          </span>

          {/* Stream status */}
          {streamingEnabled && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)]">
              {streamError ? (
                <span className="text-xs text-red-400">{streamError}</span>
              ) : streaming ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-bold text-red-400 tracking-widest">LIVE</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
                  <span className="text-xs text-[var(--color-text-muted)]">Connecting</span>
                </>
              )}
            </div>
          )}

          {/* Creator cam preview */}
          <div
            className="relative rounded-lg overflow-hidden border border-[var(--color-surface-border)] bg-zinc-900 shrink-0"
            style={{ width: "7rem", height: "3.9375rem" }}
          >
            {localVideoTrack && camEnabled ? (
              <AgoraVideoTile track={localVideoTrack} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  {camEnabled ? "Starting…" : "Cam off"}
                </span>
              </div>
            )}
            <span className="absolute bottom-0.5 left-1 text-[9px] text-white/50 bg-black/50 px-1 rounded leading-none py-0.5">
              You
            </span>
          </div>

          {/* Screen share preview */}
          {localScreenTrack && (
            <div
              className="relative rounded-lg overflow-hidden border border-blue-500/40 bg-zinc-900 shrink-0"
              style={{ width: "10rem", height: "3.9375rem" }}
            >
              <AgoraVideoTile track={localScreenTrack} />
              <span className="absolute bottom-0.5 left-1 text-[9px] text-white/50 bg-black/50 px-1 rounded leading-none py-0.5">
                Screen
              </span>
            </div>
          )}
        </div>

        {/* Slot grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-2 p-3 overflow-hidden">
          {slots.map((participant, i) => {
            const remoteUser = participant
              ? remoteUsers.find((u) => u.uid === slotToUid(i))
              : null;
            const videoTrack = remoteUser?.videoTrack;

            return (
              <div
                key={i}
                className="relative rounded-xl overflow-hidden border border-[var(--color-surface-border)] bg-[var(--bg-deep)] flex items-center justify-center"
              >
                {participant ? (
                  <>
                    {videoTrack ? (
                      <AgoraVideoTile track={videoTrack} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[var(--bg-deep)]">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                          style={{ backgroundColor: "var(--color-brand)" }}
                        >
                          {participant.display_name[0].toUpperCase()}
                        </div>
                        <p className="text-sm font-semibold">{participant.display_name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Waiting for camera…</p>
                      </div>
                    )}

                    {/* Name tag */}
                    <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
                      <span className="text-xs font-semibold text-white truncate">
                        {participant.display_name}
                      </span>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => changeParticipantStatus(participant.id, "removed")}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white text-xs flex items-center justify-center transition-colors z-10"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 opacity-20 select-none">
                    <div className="w-10 h-10 rounded-lg border-2 border-dashed border-current flex items-center justify-center text-lg font-bold">
                      {i + 1}
                    </div>
                    <span className="text-[10px] uppercase tracking-widest">Empty</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-center gap-2 px-6 py-3 border-t border-[var(--color-surface-border)] shrink-0">
          <IconButton
            onClick={toggleMic}
            label={micEnabled ? "Mute" : "Unmute"}
            icon={micEnabled ? <IconMic /> : <IconMicOff />}
            danger={!micEnabled}
          />
          <IconButton
            onClick={toggleCam}
            label={camEnabled ? "Cam off" : "Cam on"}
            icon={camEnabled ? <IconCamera /> : <IconCameraOff />}
            danger={!camEnabled}
          />
          <IconButton
            onClick={toggleScreenShare}
            label={isScreenSharing ? "Stop share" : "Share screen"}
            icon={isScreenSharing ? <IconScreenOff /> : <IconScreen />}
            active={isScreenSharing}
            activeColor="text-blue-400"
          />

          {/* Go Live — center piece */}
          <button
            onClick={() => setStreamingEnabled((v) => !v)}
            className={`mx-4 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all ${
              streaming
                ? "bg-transparent border-2 border-red-500 text-red-400 hover:bg-red-500/10"
                : streamingEnabled
                ? "bg-red-700/60 text-red-200 cursor-wait"
                : "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
            }`}
          >
            <IconRadio />
            {goLiveLabel}
          </button>
        </div>
      </main>

      {/* ── Right: Chat ───────────────────────────────────────────────── */}
      <aside className="w-72 border-l border-[var(--color-surface-border)] flex flex-col overflow-hidden shrink-0">
        <div className="px-4 py-3 border-b border-[var(--color-surface-border)]">
          <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Chat
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-24 gap-2">
              <p className="text-xs text-[var(--color-text-muted)]">No messages yet</p>
            </div>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className="flex gap-2 items-start py-0.5 pl-2 rounded"
              style={{ borderLeft: `2px solid ${PLATFORM_COLOR[m.platform] ?? "var(--border)"}` }}
            >
              <div className="min-w-0">
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: PLATFORM_COLOR[m.platform] ?? "var(--color-text-muted)" }}
                >
                  {m.author_display_name}
                </span>
                <span className="text-xs text-[var(--color-text)] ml-1.5 break-words">
                  {m.body}
                </span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form
          onSubmit={sendChat}
          className="flex gap-2 p-3 border-t border-[var(--color-surface-border)]"
        >
          <input
            type="text"
            value={chatBody}
            onChange={(e) => setChatBody(e.target.value)}
            placeholder="Message…"
            maxLength={500}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-xs focus:outline-none focus:border-[var(--color-brand)] transition-colors"
          />
          <button
            type="submit"
            disabled={!chatBody.trim()}
            className="px-3 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-xs font-semibold disabled:opacity-40 transition-colors shrink-0"
          >
            Send
          </button>
        </form>
      </aside>
    </div>
  );
}

// ─── Queue item ───────────────────────────────────────────────────────────────

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
    <div className="px-3 py-3 space-y-2.5">
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
          style={{ backgroundColor: "var(--color-brand)" }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{participant.display_name}</p>
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
            className="flex-1 py-1 rounded-lg text-xs font-semibold border border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white transition-colors"
          >
            Approve
          </button>
        )}
        {!isWaiting && canGoLive && (
          <button
            onClick={onSetLive}
            className="flex-1 py-1 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-500 text-white transition-colors"
          >
            Set live → {nextSlot + 1}
          </button>
        )}
        <button
          onClick={onRemove}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:border-red-500 hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Icon button ──────────────────────────────────────────────────────────────

function IconButton({
  onClick,
  icon,
  label,
  danger,
  active,
  activeColor = "text-blue-400",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  active?: boolean;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors group ${
        danger
          ? "text-red-400 bg-red-500/10 hover:bg-red-500/20"
          : active
          ? `${activeColor} bg-blue-500/10 hover:bg-blue-500/20`
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
      }`}
      title={label}
    >
      {icon}
      <span className="text-[9px] uppercase tracking-widest leading-none">{label}</span>
    </button>
  );
}
