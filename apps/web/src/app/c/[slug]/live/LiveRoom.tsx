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

  const slots = Array.from({ length: TOTAL_SLOTS }, (_, i) =>
    liveParticipants.find((p) => p.slot_index === i) ?? null
  );
  const nextSlot = slots.findIndex((s) => s === null);

  return (
    <div className="flex h-[calc(100vh-57px)] overflow-hidden">
      {/* ── Left: Queue ── */}
      <aside className="w-64 border-r border-[var(--color-surface-border)] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-surface-border)]">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Queue
          </p>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-surface-border)]">
          {waiting.length === 0 && approved.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] p-4">No one in queue.</p>
          ) : null}

          {[...waiting, ...approved].map((p) => (
            <div key={p.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{p.display_name}</span>
                <span className={`text-xs capitalize ml-1 shrink-0 ${
                  p.status === "waiting" ? "text-yellow-400" : "text-blue-400"
                }`}>
                  {p.status}
                </span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {p.status === "waiting" && (
                  <button
                    onClick={() => changeParticipantStatus(p.id, "approved")}
                    className="px-2 py-1 rounded text-xs bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white transition-colors"
                  >
                    Approve
                  </button>
                )}
                {p.status === "approved" && nextSlot !== -1 && (
                  <button
                    onClick={() => changeParticipantStatus(p.id, "live", nextSlot)}
                    className="px-2 py-1 rounded text-xs bg-green-600 hover:bg-green-500 text-white transition-colors"
                  >
                    Set live →{nextSlot + 1}
                  </button>
                )}
                <button
                  onClick={() => changeParticipantStatus(p.id, "removed")}
                  className="px-2 py-1 rounded text-xs border border-[var(--color-surface-border)] hover:border-red-500 text-red-400 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Center: Slots + Toolbar ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header: title + creator previews */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-surface-border)]">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider flex-1">
            Live slots
          </p>

          {/* Streaming status */}
          {streamingEnabled && (
            <div className="flex items-center gap-1.5">
              {streamError ? (
                <span className="text-xs text-red-400">{streamError}</span>
              ) : streaming ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-semibold text-red-400">LIVE</span>
                </>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]">Connecting...</span>
              )}
            </div>
          )}

          {/* Camera preview — always present */}
          <div className="relative w-32 rounded-lg overflow-hidden border border-[var(--color-surface-border)] bg-zinc-900 flex items-center justify-center"
               style={{ height: "4.5rem" }}>
            {localVideoTrack && camEnabled ? (
              <AgoraVideoTile track={localVideoTrack} />
            ) : (
              <span className="text-xs text-[var(--color-text-muted)]">
                {camEnabled ? "Starting..." : "Cam off"}
              </span>
            )}
            <span className="absolute bottom-0.5 left-1 text-[10px] text-white/60 bg-black/40 px-1 rounded">
              You
            </span>
          </div>

          {/* Screen preview — only when screensharing */}
          {localScreenTrack && (
            <div className="relative w-48 rounded-lg overflow-hidden border border-blue-500/50 bg-zinc-900"
                 style={{ height: "4.5rem" }}>
              <AgoraVideoTile track={localScreenTrack} />
              <span className="absolute bottom-0.5 left-1 text-[10px] text-white/60 bg-black/40 px-1 rounded">
                Screen
              </span>
            </div>
          )}
        </div>

        {/* Participant slot grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-4">
          {slots.map((participant, i) => (
            <div
              key={i}
              className="relative rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-raised)] flex flex-col items-center justify-center overflow-hidden"
            >
              {participant ? (
                <>
                  {(() => {
                    const remoteUser = remoteUsers.find((u) => u.uid === slotToUid(i));
                    const videoTrack = remoteUser?.videoTrack;
                    return videoTrack ? (
                      <AgoraVideoTile track={videoTrack} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                        <div className="text-center space-y-1">
                          <div className="w-12 h-12 rounded-full bg-[var(--color-brand)] flex items-center justify-center text-lg font-bold mx-auto">
                            {participant.display_name[0].toUpperCase()}
                          </div>
                          <p className="text-sm font-medium">{participant.display_name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Waiting for camera...</p>
                        </div>
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => changeParticipantStatus(participant.id, "removed")}
                    className="absolute top-2 right-2 px-2 py-1 rounded text-xs bg-black/60 hover:bg-red-600 text-white transition-colors z-10"
                  >
                    Remove
                  </button>
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 text-xs text-green-400 bg-black/60 px-1.5 py-0.5 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Live
                  </span>
                </>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">Slot {i + 1} — empty</p>
              )}
            </div>
          ))}
        </div>

        {/* Creator toolbar */}
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-[var(--color-surface-border)]">
          <ToolbarButton
            onClick={toggleMic}
            active={!micEnabled}
            label={micEnabled ? "Mute" : "Unmute"}
          />
          <ToolbarButton
            onClick={toggleCam}
            active={!camEnabled}
            label={camEnabled ? "Cam off" : "Cam on"}
          />
          <ToolbarButton
            onClick={toggleScreenShare}
            active={isScreenSharing}
            activeColor="text-blue-400 border-blue-500"
            label={isScreenSharing ? "Stop share" : "Share screen"}
          />
          <ToolbarButton
            onClick={() => setStreamingEnabled((v) => !v)}
            active={streamingEnabled}
            activeColor="text-red-400 border-red-500"
            label={streaming ? "● Stop stream" : streamingEnabled ? "Starting..." : "Go live →"}
          />
        </div>
      </main>

      {/* ── Right: Chat ── */}
      <aside className="w-72 border-l border-[var(--color-surface-border)] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-surface-border)]">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
            Chat
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
          {messages.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)] text-center pt-4">
              No messages yet.
            </p>
          )}
          {messages.map((m) => (
            <div key={m.id} className="text-xs">
              <span className="font-semibold text-[var(--color-brand-light)]">{m.author_display_name}</span>
              <span className="text-[var(--color-text-muted)] ml-1 capitalize">[{m.platform}]</span>
              <span className="ml-1 text-[var(--color-text)]">{m.body}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form onSubmit={sendChat} className="flex gap-2 p-3 border-t border-[var(--color-surface-border)]">
          <input
            type="text"
            value={chatBody}
            onChange={(e) => setChatBody(e.target.value)}
            placeholder="Message..."
            maxLength={500}
            className="flex-1 min-w-0 px-2 py-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-xs focus:outline-none focus:border-[var(--color-brand)]"
          />
          <button
            type="submit"
            disabled={!chatBody.trim()}
            className="px-3 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </form>
      </aside>
    </div>
  );
}

function ToolbarButton({
  onClick,
  label,
  active,
  activeColor = "text-red-400 border-red-500",
  disabled,
}: {
  onClick: () => void;
  label: string;
  active: boolean;
  activeColor?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? activeColor
          : "border-[var(--color-surface-border)] text-[var(--color-text)] hover:border-[var(--color-brand)]"
      }`}
    >
      {label}
    </button>
  );
}
