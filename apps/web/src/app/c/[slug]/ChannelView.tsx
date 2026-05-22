"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getSocket, type SessionJoinAck } from "@/lib/socket";
import { useAgoraRoom } from "@/hooks/useAgoraRoom";
import { slotToUid, CREATOR_CAM_UID, CREATOR_SCREEN_UID } from "@/lib/agora";
import { api } from "@/lib/api";
import type { ChatMessage, Participant } from "@ditch/types";
import SignInModal from "@/components/SignInModal";

const AgoraVideoTile = dynamic(() => import("@/components/AgoraVideoTile"), { ssr: false });

const MAX_CHAT = 200;

export default function ChannelView({
  sessionId,
  token,
  viewerName,
  isOwner,
  channelSlug,
}: {
  sessionId: string;
  token: string | null;
  viewerName: string | null;
  isOwner: boolean;
  channelSlug: string;
}) {
  // tokenState / viewerNameState are mutable — updated after sign-in so the
  // socket reconnects with auth and the display name is correct in chat.
  const [tokenState, setTokenState] = useState<string | null>(token);
  const [viewerNameState, setViewerNameState] = useState<string | null>(viewerName);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [chatBody, setChatBody] = useState("");
  const [chatDraft, setChatDraft] = useState(""); // anon draft preserved through sign-in
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [requestName, setRequestName] = useState(viewerName ?? "");
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Close sign-in modal if the stream ends while it's open.
  useEffect(() => {
    if (sessionError) setShowSignInModal(false);
  }, [sessionError]);

  useEffect(() => {
    const socket = getSocket(tokenState ?? undefined);

    socket.connect();

    socket.on("connect", () => setConnected(true));
    socket.on("connect_error", () => setConnected(false));

    const onJoin: SessionJoinAck = (err, state) => {
      if (err) {
        setSessionError(err);
        return;
      }
      if (state) {
        setParticipants(state.participants);
        setMessages(state.recentMessages.slice(-MAX_CHAT));
        setConnected(true);
      }
    };
    socket.emit("session:join", { session_id: sessionId }, onJoin);

    socket.on("chat:message", ({ message }) => {
      setMessages((prev) => [...prev.slice(-MAX_CHAT + 1), message]);
    });

    socket.on("participant:queue_update", ({ participants: updated }) => {
      setParticipants(updated);
      setMyParticipant((prev) => {
        if (!prev) return prev;
        return updated.find((p: Participant) => p.id === prev.id) ?? prev;
      });
    });

    socket.on("participant:status_change", ({ participant }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === participant.id ? participant : p))
      );
      setMyParticipant((prev) => (prev?.id === participant.id ? participant : prev));
    });

    return () => {
      socket.emit("session:leave", { session_id: sessionId });
      socket.off("connect");
      socket.off("connect_error");
      socket.off("chat:message");
      socket.off("participant:queue_update");
      socket.off("participant:status_change");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, tokenState]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isLiveParticipant = myParticipant?.status === "live";
  const mySlotUid = isLiveParticipant ? slotToUid(myParticipant!.slot_index ?? 0) : 0;

  const { localVideoTrack, localAudioTrack, remoteUsers, error: agoraError } = useAgoraRoom({
    channelName: sessionId,
    uid: isLiveParticipant ? mySlotUid : 0,
    role: isLiveParticipant ? "host" : "audience",
    publish: isLiveParticipant,
    enabled: true,
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

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatBody.trim()) return;
    const socket = getSocket(tokenState ?? undefined);
    socket.emit("chat:message", {
      session_id: sessionId,
      body: chatBody.trim(),
      display_name: viewerNameState ?? "Viewer",
      platform_origin: "ditch",
    });
    setChatBody("");
  }

  async function requestJoin(e: React.FormEvent) {
    e.preventDefault();
    setRequesting(true);
    setRequestError(null);
    try {
      const { participant } = await api.post<{ participant: Participant }>("/participants", {
        token: tokenState ?? undefined,
        body: { session_id: sessionId, display_name: requestName.trim(), platform_origin: "ditch" },
      });
      setMyParticipant(participant);
      getSocket(tokenState ?? undefined).emit("participant:notify_new", { session_id: sessionId });
    } catch (err: unknown) {
      setRequestError(err instanceof Error ? err.message : "Failed to request.");
    }
    setRequesting(false);
  }

  function handleSignInSuccess(newToken: string, displayName: string) {
    setTokenState(newToken);
    setViewerNameState(displayName);
    setShowSignInModal(false);
    // Prefill chat with the draft and focus the input.
    setChatBody(chatDraft);
    setChatDraft("");
    // Focus happens after the authed input mounts (next tick).
    setTimeout(() => {
      chatInputRef.current?.focus();
      const len = chatInputRef.current?.value.length ?? 0;
      chatInputRef.current?.setSelectionRange(len, len);
    }, 0);
  }

  const liveSlots = participants.filter((p) => p.status === "live");

  if (sessionError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-[var(--color-text-muted)]">
            {sessionError === "Session has ended"
              ? "This stream has ended."
              : "Unable to connect to stream."}
          </p>
          {sessionError !== "Session has ended" && (
            <p className="text-xs text-[var(--color-text-muted)]">{sessionError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Feeds row: creator camera + screen share (if active) + live participants */}
      <div className="flex flex-wrap gap-3 p-4 bg-[var(--color-surface-raised)] border-b border-[var(--color-surface-border)]">
        {/* Creator camera — always shown */}
        {(() => {
          const creatorVideo = remoteUsers.find((u) => u.uid === CREATOR_CAM_UID)?.videoTrack ?? null;
          return (
            <div className="relative w-48 h-28 rounded-lg bg-zinc-900 border-2 border-[var(--color-brand)]/40 overflow-hidden">
              {creatorVideo ? (
                <AgoraVideoTile track={creatorVideo} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-[var(--color-text-muted)]">Host</span>
                </div>
              )}
              <span className="absolute bottom-1 left-2 text-xs text-white/70 bg-black/40 px-1 rounded">
                Host
              </span>
            </div>
          );
        })()}

        {/* Creator screen share — shown only when active */}
        {(() => {
          const screenVideo = remoteUsers.find((u) => u.uid === CREATOR_SCREEN_UID)?.videoTrack ?? null;
          if (!screenVideo) return null;
          return (
            <div className="relative w-64 h-28 rounded-lg bg-zinc-900 border border-blue-500/50 overflow-hidden">
              <AgoraVideoTile track={screenVideo} />
              <span className="absolute bottom-1 left-2 text-xs text-white/70 bg-black/40 px-1 rounded">
                Screen
              </span>
            </div>
          );
        })()}

        {/* Live participants */}
        {liveSlots.map((p) => {
          const uid = slotToUid(p.slot_index ?? 0);
          const isMe = myParticipant?.id === p.id;
          const videoTrack = isMe
            ? localVideoTrack
            : remoteUsers.find((u) => u.uid === uid)?.videoTrack ?? null;
          return (
            <div
              key={p.id}
              className="relative w-48 h-28 rounded-lg bg-[var(--color-surface)] border border-[var(--color-surface-border)] overflow-hidden"
            >
              {videoTrack ? (
                <AgoraVideoTile track={videoTrack} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-medium truncate px-2 w-full text-center">
                    {p.display_name}
                  </span>
                </div>
              )}
              <span className="absolute bottom-1 left-2 text-xs text-white/70 bg-black/40 px-1 rounded">
                {p.display_name}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chat */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {tokenState ? (
            // ── Authenticated: full chat ──────────────────────────────────────
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-sm text-[var(--color-text-muted)] text-center pt-8">
                    {connected ? "Chat is empty. Say something!" : "Connecting..."}
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-semibold text-[var(--color-brand-light)]">{m.author_display_name}</span>
                    <span className="text-[var(--color-text-muted)] text-xs ml-1 capitalize">[{m.platform}]</span>
                    <span className="ml-2 text-[var(--color-text)]">{m.body}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={sendChat} className="flex gap-2 p-3 border-t border-[var(--color-surface-border)]">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatBody}
                  onChange={(e) => setChatBody(e.target.value)}
                  placeholder="Say something..."
                  maxLength={500}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                />
                <button
                  type="submit"
                  disabled={!chatBody.trim()}
                  className="px-4 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  Send
                </button>
              </form>
            </>
          ) : (
            // ── Anonymous: no chat list, locked input ─────────────────────────
            <div className="flex flex-col flex-1 justify-end">
              <div className="flex gap-2 p-3 border-t border-[var(--color-surface-border)]">
                <input
                  type="text"
                  value={chatDraft}
                  onChange={(e) => setChatDraft(e.target.value)}
                  placeholder="Sign in to chat…"
                  maxLength={500}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowSignInModal(true)}
                  className="px-4 py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold transition-colors"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Join / control room panel */}
        <div className="w-64 border-l border-[var(--color-surface-border)] p-4 flex flex-col gap-4 overflow-y-auto">
          {isOwner ? (
            <>
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Your Stream
              </p>
              <a
                href={`/c/${channelSlug}/live`}
                className="w-full py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold text-center transition-colors"
              >
                Go to Control Room →
              </a>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Join Stream
              </p>
              {!myParticipant ? (
                <form onSubmit={requestJoin} className="space-y-3">
                  <input
                    type="text"
                    required
                    value={requestName}
                    onChange={(e) => setRequestName(e.target.value)}
                    placeholder="Your name"
                    maxLength={64}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                  />
                  {requestError && <p className="text-red-400 text-xs">{requestError}</p>}
                  <button
                    type="submit"
                    disabled={requesting || !requestName.trim()}
                    className="w-full py-2 rounded-lg bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold disabled:opacity-50 transition-colors"
                  >
                    {requesting ? "Requesting..." : "Request to join"}
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <StatusBadge status={myParticipant.status} />
                  {isLiveParticipant && agoraError && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 space-y-1">
                      <p className="text-xs font-semibold text-red-400">Camera failed to start</p>
                      <p className="text-[11px] text-red-400/80 leading-snug">{agoraError}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Check that your browser has camera and microphone permission for this site, then reload.
                      </p>
                    </div>
                  )}
                  {isLiveParticipant && !agoraError && !localVideoTrack && (
                    <p className="text-xs text-[var(--color-text-muted)]">Starting camera…</p>
                  )}
                  {isLiveParticipant && !agoraError && localVideoTrack && (
                    <div className="flex gap-2">
                      <button
                        onClick={toggleMic}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          micEnabled
                            ? "border-[var(--color-surface-border)] text-[var(--color-text)] hover:border-red-500"
                            : "border-red-500 text-red-400 hover:border-[var(--color-surface-border)] hover:text-[var(--color-text)]"
                        }`}
                      >
                        {micEnabled ? "Mute" : "Unmute"}
                      </button>
                      <button
                        onClick={toggleCam}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          camEnabled
                            ? "border-[var(--color-surface-border)] text-[var(--color-text)] hover:border-red-500"
                            : "border-red-500 text-red-400 hover:border-[var(--color-surface-border)] hover:text-[var(--color-text)]"
                        }`}
                      >
                        {camEnabled ? "Cam off" : "Cam on"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Viewer count */}
          <div className="mt-auto text-xs text-[var(--color-text-muted)]">
            {participants.filter((p) => p.status !== "removed").length} participant
            {participants.length !== 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>

    {showSignInModal && (
      <SignInModal
        onSuccess={handleSignInSuccess}
        onClose={() => setShowSignInModal(false)}
        initialDraft={chatDraft}
        onDraftChange={setChatDraft}
      />
    )}
    </>
  );
}

function StatusBadge({ status }: { status: Participant["status"] }) {
  const config = {
    waiting:  { label: "Waiting for approval...", color: "text-yellow-400" },
    approved: { label: "Approved! Joining soon...", color: "text-blue-400" },
    live:     { label: "You're live!", color: "text-green-400" },
    removed:  { label: "Removed from stream", color: "text-zinc-500" },
  };
  const { label, color } = config[status];
  return <p className={`text-sm font-medium ${color}`}>{label}</p>;
}
