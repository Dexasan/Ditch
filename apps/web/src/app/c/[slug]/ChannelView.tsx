"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { getSocket, type SessionJoinAck } from "@/lib/socket";
import { useRtcRoom } from "@/hooks/useRtcRoom";
import { slotToUid, CREATOR_CAM_UID, CREATOR_SCREEN_UID, CREATOR_COMPOSITE_UID, AGORA_APP_ID } from "@/lib/agora";
import { api } from "@/lib/api";
import type { ChatMessage, Participant } from "@ditch/types";
import type { ILocalVideoTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";
import SignInModal from "@/components/SignInModal";

const AgoraVideoTile = dynamic(() => import("@/components/AgoraVideoTile"), { ssr: false });
const HlsPlayer = dynamic(() => import("@/components/HlsPlayer"), { ssr: false });

const MAX_CHAT = 200;

const PLATFORM_COLOR: Record<string, string> = {
  twitch:  "#9146ff",
  youtube: "#ff0000",
  tiktok:  "#ff0050",
  kick:    "#53fc18",
  ditch:   "#FF1DB4",
};

// ── Icons ─────────────────────────────────────────────────────────────────────

function MicIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CamIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34m-7.72-2.06a4 4 0 1 1-5.56-5.56" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

// ── Participant tile (secondary strip) ────────────────────────────────────────

function ParticipantTile({
  participant,
  videoTrack,
  isMe,
}: {
  participant: Participant;
  videoTrack: ILocalVideoTrack | IRemoteVideoTrack | null;
  isMe: boolean;
}) {
  return (
    <div
      className="relative flex-shrink-0 rounded-lg overflow-hidden"
      style={{ width: 112, height: 63, background: "#111120" }}
    >
      {videoTrack ? (
        <AgoraVideoTile track={videoTrack} fit="cover" mirror={isMe} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            {(participant.display_name?.[0] ?? "?").toUpperCase()}
          </div>
        </div>
      )}
      <div
        className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 flex items-center gap-1"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)" }}
      >
        {isMe && (
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 animate-pulse" />
        )}
        <span className="text-[10px] text-white/80 truncate leading-none">
          {participant.display_name}
        </span>
      </div>
    </div>
  );
}

// ── Join panel - full state machine ───────────────────────────────────────────

function JoinPanel({
  isOwner,
  channelSlug,
  myParticipant,
  agoraError,
  localVideoTrack,
  goingLive,
  micEnabled,
  camEnabled,
  requesting,
  requestError,
  requestName,
  onNameChange,
  onRequest,
  onGoLive,
  onToggleMic,
  onToggleCam,
}: {
  isOwner: boolean;
  channelSlug: string;
  myParticipant: Participant | null;
  agoraError: string | null;
  localVideoTrack: ILocalVideoTrack | null;
  goingLive: boolean;
  micEnabled: boolean;
  camEnabled: boolean;
  requesting: boolean;
  requestError: string | null;
  requestName: string;
  onNameChange: (v: string) => void;
  onRequest: (e: React.FormEvent) => void;
  onGoLive: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
}) {
  if (isOwner) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--color-brand)" }} />
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--color-text-muted)" }}>
            Your Stream
          </span>
        </div>
        <a
          href={`/c/${channelSlug}/live`}
          className="block w-full py-2.5 min-h-[44px] flex items-center justify-center rounded-xl text-sm font-bold text-center text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--color-brand)" }}
        >
          Open Studio →
        </a>
      </div>
    );
  }

  const status = myParticipant?.status;

  // ── Not yet requested / removed ──────────────────────────────────────────────
  if (!myParticipant || status === "removed") {
    return (
      <form onSubmit={onRequest} className="audience-join-card p-4 flex flex-col gap-3">
        <div>
          <h3 className="audience-join-title text-[15px] font-bold text-white leading-tight">Get on the stream</h3>
          <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            Send your name to the creator. You stay in control of your camera and mic.
          </p>
        </div>
        <input
          type="text"
          name="displayName"
          autoComplete="name"
          enterKeyHint="send"
          required
          value={requestName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Your display name"
          maxLength={64}
          className="audience-name-input audience-text-input w-full rounded-xl px-3.5 py-2.5 text-base transition-colors focus:outline-none"
          style={{
            background: "#111120",
            border: "1px solid var(--color-surface-border)",
          }}
          onFocus={(e) => { e.target.style.borderColor = "var(--color-brand)"; }}
          onBlur={(e)  => { e.target.style.borderColor = "var(--color-surface-border)"; }}
        />
        {requestError && (
          <p className="text-xs text-red-400">{requestError}</p>
        )}
        <button
          type="submit"
          disabled={requesting || !requestName.trim()}
          className="audience-request-button relative w-full py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white transition-all overflow-hidden disabled:opacity-50"
          style={{ background: "var(--color-brand)" }}
        >
          {requesting ? "Sending…" : "Request to join"}
          {!requesting && (
            <span
              className="absolute inset-0 rounded-xl animate-ping opacity-25 pointer-events-none"
              style={{ boxShadow: "0 0 0 4px var(--color-brand)" }}
            />
          )}
        </button>
        <p className="audience-join-trust">
          <span aria-hidden="true">&#10003;</span>
          No account or download needed
        </p>
      </form>
    );
  }

  // ── Waiting ──────────────────────────────────────────────────────────────────
  if (status === "waiting") {
    return (
      <div className="p-4 flex flex-col items-center gap-5 py-7">
        <div className="relative w-14 h-14 flex items-center justify-center">
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-20"
            style={{ border: "2px solid var(--color-brand)", animationDuration: "2.2s" }}
          />
          <span
            className="absolute inset-2 rounded-full animate-ping opacity-30"
            style={{ border: "2px solid var(--color-brand)", animationDuration: "2.2s", animationDelay: "0.7s" }}
          />
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,29,180,0.12)", border: "1.5px solid var(--color-brand)" }}
          >
            <span
              className="w-3 h-3 rounded-full animate-pulse"
              style={{ background: "var(--color-brand)" }}
            />
          </span>
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-white">Request sent!</p>
          <p className="text-xs leading-relaxed mt-1" style={{ color: "var(--color-text-muted)" }}>
            Waiting for the creator<br />to approve your spot.
          </p>
        </div>
      </div>
    );
  }

  // ── Approved ─────────────────────────────────────────────────────────────────
  if (status === "approved") {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}
        >
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-xs font-semibold text-green-400">You're approved!</span>
        </div>
        <p className="text-xs px-0.5 leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
          Ready to go on air. Tap below to start your camera.
        </p>
        <button
          onClick={onGoLive}
          disabled={goingLive}
          className="relative w-full py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white overflow-hidden transition-all disabled:opacity-50"
          style={{ background: "#16a34a" }}
        >
          {goingLive ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Starting camera…
            </span>
          ) : (
            <>
              Go live now →
              <span className="absolute inset-0 rounded-xl animate-ping opacity-20 pointer-events-none"
                    style={{ boxShadow: "0 0 0 4px #16a34a" }} />
            </>
          )}
        </button>
      </div>
    );
  }

  // ── Live ─────────────────────────────────────────────────────────────────────
  if (status === "live") {
    if (agoraError) {
      return (
        <div className="p-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest text-red-400">Camera error</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {agoraError}
          </p>
          <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            Check browser camera permissions and reload.
          </p>
        </div>
      );
    }

    if (!localVideoTrack) {
      return (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest text-white">You&apos;re live</span>
          </div>
          <button
            onClick={onGoLive}
            disabled={goingLive}
            className="w-full py-2.5 min-h-[44px] rounded-xl text-sm font-bold text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {goingLive ? "Starting…" : "Start your camera"}
          </button>
        </div>
      );
    }

    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-xs font-bold uppercase tracking-widest text-white">You&apos;re live</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleMic}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors ${
              micEnabled
                ? "text-[var(--color-text)] hover:border-red-500/40"
                : "bg-red-500/10 text-red-400 border-red-500/40"
            }`}
            style={{ borderColor: micEnabled ? "var(--color-surface-border)" : undefined }}
          >
            <MicIcon muted={!micEnabled} />
            {micEnabled ? "Mute" : "Unmute"}
          </button>
          <button
            onClick={onToggleCam}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold border transition-colors ${
              camEnabled
                ? "text-[var(--color-text)] hover:border-red-500/40"
                : "bg-red-500/10 text-red-400 border-red-500/40"
            }`}
            style={{ borderColor: camEnabled ? "var(--color-surface-border)" : undefined }}
          >
            <CamIcon off={!camEnabled} />
            {camEnabled ? "Cam off" : "Cam on"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Chat panel ────────────────────────────────────────────────────────────────

function ChatPanel({
  messages,
  chatBody,
  chatDraft,
  connected,
  tokenState,
  chatEndRef,
  chatScrollRef,
  chatInputRef,
  onSend,
  onBodyChange,
  onDraftChange,
  onSignInClick,
}: {
  messages: ChatMessage[];
  chatBody: string;
  chatDraft: string;
  connected: boolean;
  tokenState: string | null;
  chatEndRef: React.RefObject<HTMLDivElement>;
  chatScrollRef: React.RefObject<HTMLDivElement>;
  chatInputRef: React.RefObject<HTMLInputElement>;
  onSend: (e: React.FormEvent) => void;
  onBodyChange: (v: string) => void;
  onDraftChange: (v: string) => void;
  onSignInClick: () => void;
}) {
  return (
    <>
      <div
        ref={chatScrollRef}
        className="min-h-0 min-w-0 flex-1 space-y-2 overflow-y-auto overflow-x-hidden px-3 py-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 gap-1.5 opacity-30 select-none">
            <span className="text-xl">💬</span>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {connected ? "No messages yet" : "Connecting…"}
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="min-w-0 text-[12px] leading-relaxed"
              style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
            >
              <span
                className="font-semibold"
                style={{ color: PLATFORM_COLOR[m.platform] ?? "var(--color-brand-light)" }}
              >
                {m.author_display_name}
              </span>
              <span className="ml-1.5" style={{ color: "var(--color-text)" }}>
                {m.body}
              </span>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {tokenState ? (
        <form
          onSubmit={onSend}
          className="audience-chat-composer flex shrink-0 gap-2 border-t p-3"
          style={{ borderColor: "var(--color-surface-border)" }}
        >
          <input
            ref={chatInputRef}
            type="text"
            value={chatBody}
            onChange={(e) => onBodyChange(e.target.value)}
            placeholder="Say something…"
            maxLength={500}
            className="audience-text-input min-w-0 flex-1 rounded-lg px-3 py-2 text-base transition-colors focus:outline-none"
            style={{
              background: "#111120",
              border: "1px solid var(--color-surface-border)",
            }}
            onFocus={(e) => { e.target.style.borderColor = "var(--color-brand)"; }}
            onBlur={(e)  => { e.target.style.borderColor = "var(--color-surface-border)"; }}
          />
          <button
            type="submit"
            disabled={!chatBody.trim()}
            className="px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-colors shrink-0"
            style={{ background: "var(--color-brand)" }}
          >
            Send
          </button>
        </form>
      ) : (
        <div
          className="audience-chat-composer flex shrink-0 gap-2 border-t p-3"
          style={{ borderColor: "var(--color-surface-border)" }}
        >
          <input
            type="text"
            value={chatDraft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder="Sign in to chat…"
            maxLength={500}
            className="audience-text-input min-w-0 flex-1 cursor-text rounded-lg px-3 py-2 text-base focus:outline-none"
            style={{
              background: "#111120",
              border: "1px solid var(--color-surface-border)",
            }}
          />
          <button
            type="button"
            onClick={onSignInClick}
            className="px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
            style={{ background: "var(--color-brand)" }}
          >
            Sign in
          </button>
        </div>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [tokenState, setTokenState]           = useState<string | null>(token);
  const [viewerNameState, setViewerNameState] = useState<string | null>(viewerName);
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [participants, setParticipants]       = useState<Participant[]>([]);
  const [myParticipant, setMyParticipant]     = useState<Participant | null>(null);
  // Proves which participant row is ours when asking for an RTC publish token.
  // Guests without an account have no Supabase identity to present, and this is
  // the only thing that lets them reach a slot. Held in state, not storage, to
  // match myParticipant: a reload already drops the participant entirely.
  const [participantToken, setParticipantToken] = useState<string | null>(null);
  const [chatBody, setChatBody]               = useState("");
  const [chatDraft, setChatDraft]             = useState("");
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [requestName, setRequestName]         = useState(viewerName ?? "");
  const [requesting, setRequesting]           = useState(false);
  const [requestError, setRequestError]       = useState<string | null>(null);
  const [connected, setConnected]             = useState(false);
  const [sessionError, setSessionError]       = useState<string | null>(null);
  const [micEnabled, setMicEnabled]           = useState(true);
  const [camEnabled, setCamEnabled]           = useState(true);
  const [goingLive, setGoingLive]             = useState(false);
  const [mobileTab, setMobileTab]             = useState<"chat" | "join">("join");
  const [isDesktopAudience, setIsDesktopAudience] = useState(false);
  const [soundPlaying, setSoundPlaying]       = useState(false);
  const [expandedVideo, setExpandedVideo]     = useState(false);

  const audienceRootRef = useRef<HTMLDivElement>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);


  const scrollChatToLatest = useCallback((behavior: ScrollBehavior = "auto") => {
    const list = chatScrollRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior });
  }, []);

  // A phone in "Desktop site" mode can report a wide CSS viewport. Require a
  // desktop-class pointer as well as width before mounting the desktop sidebar.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
    const update = () => setIsDesktopAudience(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  // Resize the live region to the visible viewport, not the layout viewport.
  // On iOS this is what keeps the composer above the software keyboard.
  useEffect(() => {
    const root = audienceRootRef.current;
    if (!root) return;
    const viewport = window.visualViewport;
    let frame = 0;

    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rootTop = Math.max(0, root.getBoundingClientRect().top);
        const viewportHeight = viewport?.height ?? window.innerHeight;
        root.style.setProperty("--audience-viewport-height", `${Math.max(0, viewportHeight - rootTop)}px`);
        scrollChatToLatest();
      });
    };

    update();
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
    };
  }, [scrollChatToLatest]);

  useEffect(() => {
    const onAutoplayFailed = () => setSoundPlaying(false);
    window.addEventListener("ditch:autoplay-failed", onAutoplayFailed);
    return () => window.removeEventListener("ditch:autoplay-failed", onAutoplayFailed);
  }, []);

  // Release Android's orientation lock when native fullscreen closes. iOS does
  // not expose orientation lock, so this remains a harmless no-op there.
  useEffect(() => {
    const onFullscreenChange = () => {
      if (document.fullscreenElement) return;
      try { screen.orientation?.unlock?.(); } catch {}
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);
  useEffect(() => {
    if (sessionError) setShowSignInModal(false);
  }, [sessionError]);

  // Switch mobile tab to show controls the moment they're approved
  useEffect(() => {
    if (myParticipant?.status === "approved" || myParticipant?.status === "live") {
      setMobileTab("join");
    }
  }, [myParticipant?.status]);

  // Socket
  useEffect(() => {
    const socket = getSocket(tokenState ?? undefined);
    socket.connect();
    socket.on("connect", () => setConnected(true));
    socket.on("connect_error", () => setConnected(false));

    const onJoin: SessionJoinAck = (err, state) => {
      if (err) { setSessionError(err); return; }
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
      setParticipants((prev) => prev.map((p) => (p.id === participant.id ? participant : p)));
      setMyParticipant((prev) => (prev?.id === participant.id ? participant : prev));
    });
    socket.on("session:ended", () => {
      setSessionError("Session has ended");
    });

    return () => {
      socket.emit("session:leave", { session_id: sessionId });
      socket.off("connect");
      socket.off("connect_error");
      socket.off("chat:message");
      socket.off("participant:queue_update");
      socket.off("participant:status_change");
      socket.off("session:ended");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, tokenState]);

  useEffect(() => {
    scrollChatToLatest("smooth");
  }, [messages, scrollChatToLatest]);

  const isLiveParticipant = myParticipant?.status === "live";
  const [hlsFailed, setHlsFailed] = useState(false);
  const hlsBase = process.env.NEXT_PUBLIC_HLS_BASE_URL?.replace(/\/$/, "");
  const hlsUrl = hlsBase ? `${hlsBase}/live/${sessionId}/index.m3u8` : null;
  const useHlsPlayback = Boolean(hlsUrl) && !isLiveParticipant && !hlsFailed;
  const handleHlsFatal = useCallback(() => setHlsFailed(true), []);


  const { localVideoTrack, localAudioTrack, remoteUsers, joined: agoraJoined, connectionState: agoraConn, error: agoraError, goLiveAsHost, demoteToAudience } = useRtcRoom({
    channelName: sessionId,
    uid: 0,
    role: "audience",
    publish: false,
    // Tear down the Agora connection once the session ends so viewers don't sit
    // on a frozen "live" stream.
    enabled: !sessionError && (!hlsUrl || Boolean(myParticipant) || hlsFailed),
    authToken: tokenState ?? undefined,
    participantToken: participantToken ?? undefined,
  });

  // The uid we last published under. Slot uids (slot_index + 1) are how the
  // studio compositor finds a guest's video - publishing under any other uid
  // renders an empty guest tile on stream.
  const hostUidRef = useRef<number | null>(null);

  // When the creator removes a live participant, drop their published camera and
  // return them to audience so they keep watching instead of hanging on screen.
  const wasLiveHostRef = useRef(false);
  useEffect(() => {
    if (myParticipant?.status === "live") wasLiveHostRef.current = true;
    if (myParticipant?.status === "removed") {
      if (wasLiveHostRef.current) {
        wasLiveHostRef.current = false;
        hostUidRef.current = null;
        demoteToAudience();
      }
      setMyParticipant(null);
    }
  }, [myParticipant?.status, demoteToAudience]);

  // An approved guest can start their camera before the creator assigns a slot
  // ("Go live now"); at that point there is no slot yet, so the publish happens
  // under a placeholder uid the compositor can't map. The moment the slot
  // arrives, rejoin under the correct slot uid so the guest appears on stream.
  useEffect(() => {
    if (myParticipant?.status !== "live" || myParticipant.slot_index == null) return;
    const wantUid = slotToUid(myParticipant.slot_index);
    if (hostUidRef.current !== null && hostUidRef.current !== wantUid) {
      hostUidRef.current = wantUid;
      goLiveAsHost(wantUid).catch(() => {});
    }
  }, [myParticipant?.status, myParticipant?.slot_index, goLiveAsHost]);

  // Opt-in on-screen diagnostics: open the channel with ?debug to see Agora state
  // on devices with no dev console (e.g. iPhone). Set in an effect to avoid SSR
  // hydration mismatch.
  const [showDebug, setShowDebug] = useState(false);
  useEffect(() => {
    try { setShowDebug(new URLSearchParams(window.location.search).has("debug")); } catch {}
  }, []);

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
    getSocket(tokenState ?? undefined).emit("chat:message", {
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
      const { participant, participant_token } = await api.post<{
        participant: Participant;
        participant_token?: string;
      }>("/participants", {
        token: tokenState ?? undefined,
        body: { session_id: sessionId, display_name: requestName.trim(), platform_origin: "ditch" },
      });
      setMyParticipant(participant);
      setParticipantToken(participant_token ?? null);
      getSocket(tokenState ?? undefined).emit("participant:notify_new", { session_id: sessionId });
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Failed to request.");
    }
    setRequesting(false);
  }

  function handleSignInSuccess(newToken: string, displayName: string) {
    setTokenState(newToken);
    setViewerNameState(displayName);
    setShowSignInModal(false);
    setChatBody(chatDraft);
    setChatDraft("");
    setTimeout(() => {
      chatInputRef.current?.focus();
      const len = chatInputRef.current?.value.length ?? 0;
      chatInputRef.current?.setSelectionRange(len, len);
    }, 0);
  }

  function handleGoLive() {
    setGoingLive(true);
    // Read the slot at call time - mySlotUid can be stale if the creator
    // assigned the slot in the same tick the guest clicked.
    const uid = myParticipant?.slot_index != null ? slotToUid(myParticipant.slot_index) : 0;
    hostUidRef.current = uid;
    goLiveAsHost(uid).finally(() => setGoingLive(false));
  }

  // Derived

  async function handleVideoExpansion() {
    const frame = videoFrameRef.current;
    if (!frame) return;

    if (expandedVideo) {
      setExpandedVideo(false);
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }

    if (frame.requestFullscreen) {
      try {
        await frame.requestFullscreen();
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (value: "landscape") => Promise<void>;
        };
        await orientation.lock?.("landscape").catch(() => {});
        return;
      } catch {}
    }

    // iPhone Safari only exposes fullscreen on the video element created by
    // Agora. If that API is absent too, expand the stage in-page.
    const video = frame.querySelector("video") as (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
    }) | null;
    if (video?.webkitEnterFullscreen) {
      try {
        video.webkitEnterFullscreen();
        return;
      } catch {}
    }

    setExpandedVideo(true);
  }
  const creatorVideo   = remoteUsers.find((u) => u.uid === CREATOR_CAM_UID)?.videoTrack ?? null;
  const screenVideo    = remoteUsers.find((u) => u.uid === CREATOR_SCREEN_UID)?.videoTrack ?? null;
  const compositeVideo = remoteUsers.find((u) => u.uid === CREATOR_COMPOSITE_UID)?.videoTrack ?? null;
  const liveSlots    = participants.filter((p) => p.status === "live");
  const onStreamCount = liveSlots.length + 1; // +1 for creator

  // Everyone watches the studio's PROGRAM feed as the main video (the full
  // composed canvas: layers, guests, overlays - identical to what
  // Twitch/YouTube receive). Only the AUDIO differs: on-stage guests keep
  // per-track audio because the program mix would echo their own voice back.
  const mainVideo = compositeVideo ?? creatorVideo;
  // The thumbnail strip only matters for on-stage guests (self-monitoring)
  // or as a fallback when no program feed is being published.
  const hasStrip  = (isLiveParticipant || !compositeVideo) && !!(screenVideo || liveSlots.length > 0);

  // Audio routing follows the same rule: passive viewers hear ONLY the program
  // mix; on-stage guests hear per-track audio and never their delayed program mix.
  const playableAudioTracks = remoteUsers
    .filter((u) => isLiveParticipant ? u.uid !== CREATOR_COMPOSITE_UID : u.uid === CREATOR_COMPOSITE_UID)
    .flatMap((u) => u.audioTrack ? [u.audioTrack] : []);

  useEffect(() => {
    const desired = remoteUsers
      .filter((u) => isLiveParticipant ? u.uid !== CREATOR_COMPOSITE_UID : u.uid === CREATOR_COMPOSITE_UID)
      .flatMap((u) => u.audioTrack ? [u.audioTrack] : []);
    for (const u of remoteUsers) {
      if (!u.audioTrack) continue;
      const shouldPlay = desired.includes(u.audioTrack);
      try {
        if (shouldPlay && !u.audioTrack.isPlaying) u.audioTrack.play();
        if (!shouldPlay && u.audioTrack.isPlaying) u.audioTrack.stop();
      } catch {}
    }
    const timer = window.setTimeout(() => {
      setSoundPlaying(desired.length > 0 && desired.every((track) => track.isPlaying));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [remoteUsers, isLiveParticipant]);

  function enableSound(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    for (const track of playableAudioTracks) {
      try { track.play(); } catch {}
    }
    requestAnimationFrame(() => {
      setSoundPlaying(
        playableAudioTracks.length > 0 && playableAudioTracks.every((track) => track.isPlaying),
      );
    });
  }

  // ── Error state ───────────────────────────────────────────────────────────────
  const chatPanel = (
    <ChatPanel
      messages={messages}
      chatBody={chatBody}
      chatDraft={chatDraft}
      connected={connected}
      tokenState={tokenState}
      chatEndRef={chatEndRef}
      chatScrollRef={chatScrollRef}
      chatInputRef={chatInputRef}
      onSend={sendChat}
      onBodyChange={setChatBody}
      onDraftChange={setChatDraft}
      onSignInClick={() => setShowSignInModal(true)}
    />
  );

  if (sessionError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5" style={{ background: "#0A0A14" }}>
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
          style={{ background: "rgba(255,29,180,0.08)", border: "1px solid rgba(255,29,180,0.2)" }}
        >
          📡
        </div>
        <div className="text-center space-y-1">
          <p className="font-semibold text-white">
            {sessionError === "Session has ended" ? "Stream ended" : "Connection lost"}
          </p>
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            {sessionError === "Session has ended"
              ? "Thanks for watching. The stream has ended."
              : "Unable to connect. Try reloading the page."}
          </p>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <>
      {showDebug && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.85)", color: "#0f0", font: "11px/1.4 monospace",
            padding: "6px 8px", whiteSpace: "pre-wrap", wordBreak: "break-all",
          }}
        >
          {[
            `appId:${AGORA_APP_ID ? "set" : "MISSING"} joined:${agoraJoined} conn:${agoraConn}`,
            `err:${agoraError ?? "none"}`,
            `creatorVideo(uid ${CREATOR_CAM_UID}):${remoteUsers.some((u) => u.uid === CREATOR_CAM_UID && u.videoTrack) ? "YES" : "no"}`,
            `remoteUsers[${remoteUsers.length}]: ${remoteUsers.map((u) => `${u.uid}(v:${u.hasVideo ? 1 : 0}/${u.videoTrack ? "sub" : "x"} a:${u.hasAudio ? 1 : 0})`).join(" ") || "none"}`,
            `ua:${typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 70) : ""}`,
          ].join("\n")}
        </div>
      )}
      <div
        ref={audienceRootRef}
        className={`audience-shell flex min-h-0 w-full min-w-0 max-w-full flex-1 overflow-hidden ${
          isDesktopAudience ? "flex-row" : "flex-col"
        }`}
        style={{
          height: "var(--audience-viewport-height, 100%)",
          maxHeight: "var(--audience-viewport-height, 100%)",
          background: "#0A0A14",
        }}
      >

        {/* ── LEFT: video + chat ────────────────────────────────────────────── */}
        <div className="audience-main flex min-h-0 w-full min-w-0 max-w-full flex-1 flex-col">

          {/* Main video */}
          <div
            ref={videoFrameRef}
            role="button"
            tabIndex={0}
            aria-label={expandedVideo ? "Close expanded video" : "Expand video"}
            aria-pressed={expandedVideo}
            onClick={handleVideoExpansion}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") handleVideoExpansion();
            }}
            className={`audience-video-stage relative w-full max-w-full flex-shrink-0 cursor-pointer overflow-hidden bg-black ${
              expandedVideo ? "audience-video-stage-expanded" : ""
            }`}
            style={{ aspectRatio: "16/9" }}
          >
            {useHlsPlayback && hlsUrl ? (
              <HlsPlayer src={hlsUrl} onFatalError={handleHlsFatal} />
            ) : mainVideo ? (
              <AgoraVideoTile track={mainVideo} fit="contain" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 select-none"
                   style={{ opacity: 0.25 }}>
                <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                <span className="text-xs uppercase tracking-widest">Starting stream…</span>
              </div>
            )}
            {!isDesktopAudience && playableAudioTracks.length > 0 && !soundPlaying && (
              <button
                type="button"
                onClick={enableSound}
                className="absolute left-1/2 top-1/2 z-20 flex min-h-[44px] -translate-x-1/2 -translate-y-1/2 items-center rounded-full bg-black/80 px-5 py-2.5 text-sm font-bold text-white shadow-xl backdrop-blur-md"
                style={{ border: "1px solid rgba(255,255,255,0.35)" }}
              >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                </svg>
                <span className="ml-2">Tap for sound</span>
              </button>
            )}


            {/* LIVE pill */}
            <div
              className="audience-video-top-left absolute flex items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold text-white tracking-widest">LIVE</span>
            </div>

            {/* On-stream count */}
            {onStreamCount > 1 && (
              <div
                className="audience-video-top-right absolute flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--color-brand)" }} />
                <span className="text-[10px] font-semibold text-white">{onStreamCount} on stream</span>
              </div>
            )}
            <div className="audience-video-bottom-right pointer-events-none absolute z-10 flex items-center rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-semibold text-white/85 backdrop-blur-sm">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
              </svg>
              <span className="ml-1.5">{expandedVideo ? "Close" : "Fullscreen"}</span>
            </div>

          </div>

          {/* Secondary strip - screenshare + live participants */}
          {hasStrip && (
            <div
              className="audience-participant-strip flex min-w-0 max-w-full flex-shrink-0 items-center gap-2 overflow-x-auto px-3 py-2"
              style={{ background: "#0D0D1A", borderBottom: "1px solid var(--color-surface-border)" }}
            >
              {screenVideo && (
                <div
                  className="relative flex-shrink-0 rounded-lg overflow-hidden"
                  style={{ width: 130, height: 73, background: "#111120" }}
                >
                  <AgoraVideoTile track={screenVideo} />
                  <div
                    className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5"
                    style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}
                  >
                    <span className="text-[10px] text-white/70">Screen</span>
                  </div>
                </div>
              )}
              {liveSlots.map((p) => {
                const uid   = slotToUid(p.slot_index ?? 0);
                const isMe  = myParticipant?.id === p.id;
                const track = isMe
                  ? localVideoTrack
                  : (remoteUsers.find((u) => u.uid === uid)?.videoTrack ?? null);
                return (
                  <ParticipantTile
                    key={p.id}
                    participant={p}
                    videoTrack={track}
                    isMe={isMe}
                  />
                );
              })}
            </div>
          )}

          {/* Mobile tabs */}
          {!isDesktopAudience && (
          <div className="audience-mobile-panel flex min-h-0 flex-1 flex-col">
            <div
              className="audience-mobile-tabs flex shrink-0 border-b"
              style={{ borderColor: "var(--color-surface-border)" }}
            >
              {(["join", "chat"] as const).map((t) => {
                const label = t === "join"
                  ? (myParticipant?.status === "live" ? "Controls" : "Join stream")
                  : "Live chat";
                const isActive = mobileTab === t;
                return (
                  <button
                    key={t}
                    onClick={() => setMobileTab(t)}
                    aria-selected={isActive}
                    className="audience-mobile-tab flex-1 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 -mb-px"
                    style={{
                      borderColor: isActive ? "var(--color-brand)" : "transparent",
                      color: isActive ? "white" : "var(--color-text-muted)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className={`audience-mobile-content flex min-h-0 flex-1 flex-col ${mobileTab === "join" ? "overflow-y-auto" : "overflow-hidden"}`}>
              {mobileTab === "join" ? (
                <JoinPanel
                  isOwner={isOwner}
                  channelSlug={channelSlug}
                  myParticipant={myParticipant}
                  agoraError={agoraError}
                  localVideoTrack={localVideoTrack}
                  goingLive={goingLive}
                  micEnabled={micEnabled}
                  camEnabled={camEnabled}
                  requesting={requesting}
                  requestError={requestError}
                  requestName={requestName}
                  onNameChange={setRequestName}
                  onRequest={requestJoin}
                  onGoLive={handleGoLive}
                  onToggleMic={toggleMic}
                  onToggleCam={toggleCam}
                />
              ) : (
                chatPanel
              )}
            </div>
          </div>
          )}
        </div>

        {/* ── RIGHT SIDEBAR (desktop only) ──────────────────────────────────── */}
        {isDesktopAudience && (
        <div
          className="audience-sidebar flex w-[300px] min-w-0 shrink-0 flex-col overflow-hidden border-l"
          style={{
            width: 300,
            borderColor: "var(--color-surface-border)",
            background: "#0D0D1A",
          }}
        >
          {/* Join panel */}
          <div className="shrink-0 border-b" style={{ borderColor: "var(--color-surface-border)" }}>
            <JoinPanel
              isOwner={isOwner}
              channelSlug={channelSlug}
              myParticipant={myParticipant}
              agoraError={agoraError}
              localVideoTrack={localVideoTrack}
              goingLive={goingLive}
              micEnabled={micEnabled}
              camEnabled={camEnabled}
              requesting={requesting}
              requestError={requestError}
              requestName={requestName}
              onNameChange={setRequestName}
              onRequest={requestJoin}
              onGoLive={handleGoLive}
              onToggleMic={toggleMic}
              onToggleCam={toggleCam}
            />
          </div>

          {/* Live participants list */}
          {liveSlots.length > 0 && (
            <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: "var(--color-surface-border)" }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2.5"
                 style={{ color: "var(--color-text-muted)" }}>
                On air
              </p>
              <div className="flex flex-col gap-1.5">
                {liveSlots.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                    <span className="text-[12px] text-white truncate">{p.display_name}</span>
                    {myParticipant?.id === p.id && (
                      <span
                        className="ml-auto text-xs font-bold shrink-0 uppercase tracking-wide"
                        style={{ color: "var(--color-brand)" }}
                      >
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Waiting count teaser */}
          {participants.filter((p) => p.status === "waiting").length > 0 && (
            <div className="shrink-0 px-4 py-2.5">
              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                {participants.filter((p) => p.status === "waiting").length} waiting to join
              </p>
            </div>
          )}

          {/* Chat - fills rest of sidebar */}
          <div
            className="flex-1 flex flex-col min-h-0 border-t"
            style={{ borderColor: "var(--color-surface-border)" }}
          >
            <div
              className="px-4 py-2 shrink-0 border-b"
              style={{ borderColor: "var(--color-surface-border)" }}
            >
              <span className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--color-text-muted)" }}>
                Chat
              </span>
            </div>
            {chatPanel}
          </div>
        </div>
        )}
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
