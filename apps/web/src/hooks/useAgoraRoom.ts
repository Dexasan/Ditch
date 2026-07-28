"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  ILocalAudioTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { AGORA_APP_ID, CREATOR_COMPOSITE_UID, getAgoraRTC } from "@/lib/agora";
import type { ContentMode } from "@/lib/studio-store";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

// Encode codec for this client's published stream. Default H.264 (iOS decodes it
// fine, which fixed iPhone viewing). But iOS Safari's H.264 *encoder* is broken
// and publishes a black stream, so iOS guests need to publish VP8 instead while
// still decoding H.264 from others. ?codec=vp8 / ?codec=h264 forces it for testing.
function chosenCodec(): "h264" | "vp8" {
  try {
    const c = new URLSearchParams(window.location.search).get("codec");
    if (c === "vp8" || c === "h264") return c;
  } catch {}
  return "h264";
}

// Cloud Proxy: some networks (seen on iOS over both cellular and Wi-Fi) block
// Agora's default gateway path while TLS/443 still works. Once a direct join
// stalls we flip this tab to Cloud Proxy and route every later client (go-live,
// screen-share) through it too. ?proxy forces it on (?proxy=5 forces TCP/443).
let agoraNeedsProxy = false;

function readProxyMode(): 3 | 5 {
  try { return new URLSearchParams(window.location.search).get("proxy") === "5" ? 5 : 3; }
  catch { return 3; }
}
function proxyForced(): boolean {
  try { return new URLSearchParams(window.location.search).has("proxy"); }
  catch { return false; }
}
function applyProxyIfNeeded(client: IAgoraRTCClient) {
  if (agoraNeedsProxy || proxyForced()) {
    try { client.startProxyServer(readProxyMode()); } catch {}
  }
}
// Joins, rejecting if the connection stalls past `ms` (iOS can hang in CONNECTING
// forever with no error otherwise).
function joinWithTimeout(
  client: IAgoraRTCClient,
  appId: string,
  channel: string,
  token: string | null,
  uid: number,
  ms: number,
): Promise<void> {
  const jp = client.join(appId, channel, token, uid).then(() => undefined);
  jp.catch(() => {}); // swallow the late rejection if the timeout wins
  return Promise.race([
    jp,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`join stalled @ ${client.connectionState}`)), ms),
    ),
  ]);
}

/**
 * Fetches an Agora RTC token, throwing on any failure.
 *
 * A refused token and a testing-mode token used to be indistinguishable here:
 * both came back as `null`, and a `null` token joins fine while the Agora
 * project is in App-ID-only mode. That means a 503 (certificate missing) or a
 * 403 (not your session) silently degraded into a working-but-unauthenticated
 * join, and would turn into an opaque join failure the moment token auth is
 * enforced. Failures now throw with the status and body so the cause is visible
 * in the UI instead of being swallowed.
 *
 * Returns `null` only for the one legitimate case: the server answered 200 and
 * explicitly reported no token, i.e. AGORA_APP_CERTIFICATE is not configured.
 */
async function fetchAgoraToken(
  sessionId: string,
  uid: number,
  authToken?: string,
  participantToken?: string,
): Promise<string | null> {
  // A guest with no account has no Authorization header to send; the
  // participant credential is what identifies them to the token route.
  const url = `${API_BASE}/agora/token?session_id=${encodeURIComponent(sessionId)}&uid=${uid}`
    + (participantToken ? `&participant_token=${encodeURIComponent(participantToken)}` : "");
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch (err) {
    throw new Error(`Agora token request failed (uid ${uid}): ${String(err)}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Agora token refused (uid ${uid}): HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const { token } = await res.json();
  if (token == null) {
    console.warn(
      `[agora] server issued no token for uid ${uid}. AGORA_APP_CERTIFICATE is not set, ` +
        `so this join is unauthenticated. This will fail once token auth is enforced.`,
    );
  }
  return token as string | null;
}

export interface AgoraRoomState {
  localVideoTrack: ILocalVideoTrack | null;   // camera
  localScreenTrack: ILocalVideoTrack | null;  // screen share (second client)
  /** Desktop/tab audio captured alongside the screen share, if the user opted
   *  to share audio in the browser picker. Null when not sharing audio. */
  localScreenAudioTrack: ILocalAudioTrack | null;
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  joined: boolean;
  error: string | null;
  /** Diagnostic: Agora connection state + last reason (for the ?debug overlay). */
  connectionState: string;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
  /** Hot-switch the active microphone without dropping the channel. */
  switchMicDevice: (deviceId: string) => Promise<void>;
  /** Hot-switch the published camera without dropping the channel. */
  switchCamDevice: (deviceId: string) => Promise<void>;
  /** Leaves the current audience client and re-joins as host, then creates and
   *  publishes mic+camera tracks - all in one call meant to be invoked directly
   *  from an onClick handler. iOS Safari requires getUserMedia (and setClientRole)
   *  to be triggered within a user gesture; this keeps the entire promotion flow
   *  inside that gesture context. */
  goLiveAsHost: (hostUid: number) => Promise<void>;
  /** Inverse of goLiveAsHost: drops published tracks and rejoins as audience.
   *  Called when a live participant is removed from the stream by the creator. */
  demoteToAudience: () => Promise<void>;
}

export function useAgoraRoom(options: {
  channelName: string;
  uid: number;
  role: "host" | "audience";
  publish: boolean;
  /** Publish the microphone independently of the camera. Defaults to `publish`.
   *  The studio sets this true so a graphics-only scene still has audio. */
  publishAudio?: boolean;
  enabled: boolean;
  /** Enables screenshare capture (formerly the screen-share client UID). */
  screenShareUid?: number;
  /** Supabase access token forwarded to the Agora token endpoint. Required when App Certificate is configured. */
  authToken?: string;
  participantToken?: string;
  /** Drives capture frame rate + optimization: "detail" (30fps) or "motion" (60fps). */
  contentMode?: ContentMode;
  /** When the composite program feed is publishing to Agora, the raw creator
   *  camera video is NOT published (guests watch the composite). It publishes
   *  only as a fallback while this is false. */
  compositeVideoLive?: boolean;
  /** Reports the actual capture frame rate of an active source, so the caller can
   *  drop a nominal 60fps target to 30 when the device can't sustain it. */
  onCaptureFps?: (info: { source: "camera" | "screen"; frameRate: number | undefined }) => void;
}): AgoraRoomState {
  const { channelName, uid, role, publish, publishAudio, enabled, screenShareUid, authToken, participantToken } = options;
  const contentMode: ContentMode = options.contentMode ?? "detail";
  // Fail-safe default false ⇒ publish the fallback camera. Any uncertainty
  // degrades to today's always-publish behavior, never "guest sees nothing".
  const compositeVideoLive = options.compositeVideoLive ?? false;
  const onCaptureFps = options.onCaptureFps;
  const captureFrameRate = contentMode === "motion" ? 60 : 30;

  const [state, setState] = useState<Omit<AgoraRoomState, "localScreenTrack" | "localScreenAudioTrack" | "toggleScreenShare" | "switchMicDevice" | "switchCamDevice" | "goLiveAsHost" | "demoteToAudience">>({
    localVideoTrack: null,
    localAudioTrack: null,
    remoteUsers: [],
    joined: false,
    error: null,
    connectionState: "init",
    isScreenSharing: false,
  });
  const [localScreenTrack, setLocalScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [localScreenAudioTrack, setLocalScreenAudioTrack] = useState<ILocalAudioTrack | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const joinedRef = useRef(false);
  const camTrackRef = useRef<ILocalVideoTrack | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  // True only while the publish-toggle effect owns camTrackRef/localAudioTrackRef.
  // goLiveAsHost never sets it, so its tracks are never auto-unpublished.
  const effectOwnsTracksRef = useRef(false);
  // Publication state of the camera VIDEO, tracked separately from the track
  // itself: the compositor keeps consuming camTrackRef even when the video is
  // unpublished (composite feed live), so unpublish must never close the track.
  const camVideoPublishedRef = useRef(false);
  const publishBusyRef = useRef(false);
  // Second client + track used exclusively for screen share
  const screenClientRef = useRef<IAgoraRTCClient | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  const screenAudioTrackRef = useRef<ILocalAudioTrack | null>(null);
  // Stable ref so toggleScreenShare closure can read current channelName
  const channelNameRef = useRef(channelName);
  useEffect(() => { channelNameRef.current = channelName; }, [channelName]);
  const authTokenRef = useRef(authToken);
  useEffect(() => { authTokenRef.current = authToken; }, [authToken]);
  const participantTokenRef = useRef(participantToken);
  useEffect(() => { participantTokenRef.current = participantToken; }, [participantToken]);

  useEffect(() => {
    if (!enabled || !AGORA_APP_ID) return;

    let mounted = true;

    async function setup() {
      const AgoraRTC = await getAgoraRTC();
      if (!mounted) return;

      // Diagnostic: does the SDK consider this browser supported at all?
      let sysOk: boolean | undefined;
      try { sysOk = AgoraRTC.checkSystemRequirements?.(); } catch {}
      setState((prev) => ({ ...prev, connectionState: `sysReq:${sysOk}` }));

      const client = AgoraRTC.createClient({ mode: "live", codec: chosenCodec() });
      clientRef.current = client;

      // Surface every connection transition (and its reason) for the ?debug overlay.
      // A join that stalls in CONNECTING here = the gateway is unreachable.
      client.on("connection-state-change", (cur, _prev, reason) => {
        setState((prev) => ({ ...prev, connectionState: reason ? `${cur} (${reason})` : cur }));
      });

      const syncRemote = () =>
        setState((prev) => ({ ...prev, remoteUsers: [...client.remoteUsers] }));

      client.on("user-published", async (user, mediaType) => {
        // Hosts (creator studio / legacy control room) never consume the
        // composite program feed - it's their own output coming back (echo
        // risk + wasted downlink). Audience clients subscribe so viewers can
        // watch the full program.
        if (user.uid === CREATOR_COMPOSITE_UID && role === "host") return;
        await client.subscribe(user, mediaType);
        // Composite audio is played (or not) by the viewer page, which knows
        // whether this user is a passive viewer or an on-stage guest.
        if (mediaType === "audio" && user.audioTrack && user.uid !== CREATOR_COMPOSITE_UID) {
          user.audioTrack.play();
        }
        syncRemote();
      });
      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio") user.audioTrack?.stop();
        syncRemote();
      });
      client.on("user-left", syncRemote);

      await client.setClientRole(role);
      const agoraToken = await fetchAgoraToken(channelName, uid, authTokenRef.current, participantTokenRef.current);
      if (!mounted) return;
      // Repeat visits on a known-restrictive network skip the ~8s direct-stall wait.
      if (!agoraNeedsProxy) {
        try { if (localStorage.getItem("ditch_agora_proxy") === "1") agoraNeedsProxy = true; } catch {}
      }
      applyProxyIfNeeded(client);
      try {
        // Good networks connect in 1-3s; 5s headroom. On iOS the join can hang in
        // CONNECTING forever with no error, so the timeout is what catches it.
        await joinWithTimeout(client, AGORA_APP_ID, channelName, agoraToken, uid, 5000);
      } catch (stallErr) {
        if (agoraNeedsProxy || proxyForced() || !mounted) throw stallErr;
        // Direct connection stalled = restrictive network. Flip this tab to Cloud
        // Proxy and retry; remembered so go-live/screen-share use it too.
        agoraNeedsProxy = true;
        try { localStorage.setItem("ditch_agora_proxy", "1"); } catch {}
        setState((prev) => ({ ...prev, connectionState: "retry via proxy" }));
        try { await client.leave(); } catch {}
        try { client.startProxyServer(readProxyMode()); } catch {}
        await client.join(AGORA_APP_ID, channelName, agoraToken, uid);
      }
      if (!mounted) return;
      client.on("token-privilege-will-expire", async () => {
        // Renewal runs in an event handler, so a throw here would surface as an
        // unhandled rejection and the session would silently expire instead.
        try {
          const newToken = await fetchAgoraToken(channelNameRef.current, uid, authTokenRef.current, participantTokenRef.current);
          if (newToken) await client.renewToken(newToken);
        } catch (err) {
          setState((prev) => ({ ...prev, error: `Token renewal failed: ${String(err)}` }));
        }
      });

      joinedRef.current = true;
      setState((prev) => ({ ...prev, joined: true, remoteUsers: [...client.remoteUsers] }));
    }

    setup().catch((err) => {
      if (mounted) setState((prev) => ({ ...prev, error: String(err) }));
    });

    return () => {
      mounted = false;
      joinedRef.current = false;
      camTrackRef.current?.close();
      camTrackRef.current = null;
      localAudioTrackRef.current?.close();
      localAudioTrackRef.current = null;
      effectOwnsTracksRef.current = false;
      // Clean up screen client if still active
      screenTrackRef.current?.close();
      screenTrackRef.current = null;
      screenClientRef.current?.leave().catch(() => {});
      screenClientRef.current = null;
      clientRef.current?.leave().catch(() => {});
      clientRef.current = null;
      setState({
        localVideoTrack: null,
        localAudioTrack: null,
        remoteUsers: [],
        joined: false,
        error: null,
        connectionState: "init",
        isScreenSharing: false,
      });
      setLocalScreenTrack(null);
    };
  // Role/uid changes cause a full leave+rejoin - intentional. publish is handled
  // by the dedicated effect below so toggling it does NOT drop the channel.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName, uid, role]);

  // ── Publish toggle ────────────────────────────────────────────────────────────
  // Publishes/unpublishes mic and camera independently. A graphics-only or
  // screen-share scene still needs microphone audio, while changing scenes can
  // add or remove the camera without reconnecting the Agora room.
  useEffect(() => {
    const client = clientRef.current;
    if (!enabled || !client || !state.joined) return;
    let cancelled = false;

    const wantVideo = publish;
    const wantAudio = publishAudio ?? publish;
    // Camera VIDEO is published only as a fallback: when the composite feed is
    // NOT live. When it is live, guests watch the composite and we keep the
    // camera captured-but-unpublished (no redundant encode).
    const wantCamVideoPublished = wantVideo && !compositeVideoLive;
    const needsWork =
      (wantVideo && !camTrackRef.current) ||
      (wantAudio && !localAudioTrackRef.current) ||
      (wantVideo && camTrackRef.current && wantCamVideoPublished !== camVideoPublishedRef.current) ||
      (!wantVideo && camTrackRef.current && effectOwnsTracksRef.current) ||
      (!wantAudio && localAudioTrackRef.current && effectOwnsTracksRef.current);

    if (needsWork && !publishBusyRef.current) {
      publishBusyRef.current = true;
      (async () => {
        const AgoraRTC = await getAgoraRTC();

        if (wantAudio && !localAudioTrackRef.current) {
          const audioTrack = await AgoraRTC.createMicrophoneAudioTrack({
            // 48kHz stereo @ 192kbps, matching the AudioContext rate so nothing
            // resamples on the way into the compositor mixer.
            encoderConfig: "high_quality_stereo",
            // Keep echo cancellation on: some creators/participants monitor
            // through speakers, and AEC prevents feedback there. But disable
            // auto-gain (AGC) and noise suppression (ANS): both are aggressive
            // DSP passes that muffle the signal and cause level pumping.
            AEC: true,
            AGC: false,
            ANS: false,
          });
          if (cancelled || clientRef.current !== client) {
            audioTrack.close();
          } else {
            await client.publish(audioTrack);
            localAudioTrackRef.current = audioTrack;
            effectOwnsTracksRef.current = true;
            setState((prev) => ({ ...prev, localAudioTrack: audioTrack }));
          }
        }
        if (wantVideo && !camTrackRef.current) {
          // Capture at 1080p (30 or 60fps per content mode). Agora's default is
          // 480p, which the compositor would stretch across the canvas: more
          // pixels, no real detail. This track is the COMPOSITOR source and is
          // created (captured) here but NOT published - the composite feed
          // carries the camera to viewers. It publishes only as a fallback,
          // reconciled just below.
          const videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: 1920,
              height: 1080,
              frameRate: captureFrameRate,
              bitrateMin: 1500,
              bitrateMax: 5000,
            },
          });
          if (cancelled || clientRef.current !== client) {
            videoTrack.close();
          } else {
            camTrackRef.current = videoTrack;
            camVideoPublishedRef.current = false;
            effectOwnsTracksRef.current = true;
            setState((prev) => ({ ...prev, localVideoTrack: videoTrack }));
            try {
              const s = videoTrack.getMediaStreamTrack().getSettings();
              console.info("[diag] camera capture", { width: s.width, height: s.height, frameRate: s.frameRate });
              onCaptureFps?.({ source: "camera", frameRate: s.frameRate });
            } catch {}
          }
        }

        // Reconcile camera VIDEO publication (fallback only). Never closes the
        // track - the compositor keeps consuming it either way.
        if (wantVideo && camTrackRef.current) {
          if (wantCamVideoPublished && !camVideoPublishedRef.current) {
            await client.publish(camTrackRef.current).catch(() => {});
            camVideoPublishedRef.current = true;
          } else if (!wantCamVideoPublished && camVideoPublishedRef.current) {
            await client.unpublish(camTrackRef.current).catch(() => {});
            camVideoPublishedRef.current = false;
          }
        }

        if (!wantVideo && camTrackRef.current && effectOwnsTracksRef.current) {
          const camera = camTrackRef.current;
          camTrackRef.current = null;
          if (camVideoPublishedRef.current) {
            await client.unpublish(camera).catch(() => {});
            camVideoPublishedRef.current = false;
          }
          camera.close();
          setState((prev) => ({ ...prev, localVideoTrack: null }));
        }
        if (!wantAudio && localAudioTrackRef.current && effectOwnsTracksRef.current) {
          const microphone = localAudioTrackRef.current;
          localAudioTrackRef.current = null;
          await client.unpublish(microphone).catch(() => {});
          microphone.close();
          setState((prev) => ({ ...prev, localAudioTrack: null }));
        }

        if (!camTrackRef.current && !localAudioTrackRef.current) {
          effectOwnsTracksRef.current = false;
        }
      })()
        .catch((err) => { if (!cancelled) setState((prev) => ({ ...prev, error: String(err) })); })
        .finally(() => { publishBusyRef.current = false; });
    }

    return () => { cancelled = true; };
  }, [enabled, publish, publishAudio, compositeVideoLive, captureFrameRate, state.joined]);
  const toggleScreenShare = useCallback(async () => {
    if (!AGORA_APP_ID || screenShareUid === undefined) return;

    const AgoraRTC = await getAgoraRTC();

    if (!screenTrackRef.current) {
      // ── Start screenshare (CAPTURE ONLY) ───────────────────────────────────
      // The screen is NOT published to Agora as a separate video stream: guests
      // and viewers see it through the composite program feed. We only capture
      // it here to feed the compositor (localScreenTrack), so there is no second
      // client and no extra encode. Start/stop is keyed off screenTrackRef.
      //
      // Capture config follows content mode: Detail = 1080p30 "detail" (desktop
      // text stays sharp), Motion = 1080p60 "motion" (gameplay). Desktop/tab
      // audio is captured with the voice DSP OFF (AEC/AGC/ANS muffle music and
      // pump levels) and mixed into the program by the compositor.
      const screenConfig = {
        encoderConfig: {
          width: 1920,
          height: 1080,
          frameRate: captureFrameRate,
          bitrateMin: 2000,
          bitrateMax: 5000,
        },
        optimizationMode: contentMode === "motion" ? ("motion" as const) : ("detail" as const),
      };
      let result: Awaited<ReturnType<typeof AgoraRTC.createScreenVideoTrack>>;
      try {
        result = await AgoraRTC.createScreenVideoTrack(screenConfig, { AEC: false, AGC: false, ANS: false });
      } catch {
        result = await AgoraRTC.createScreenVideoTrack(screenConfig, "disable");
      }
      const track = Array.isArray(result) ? result[0] : result;
      const audioTrack = Array.isArray(result) ? result[1] : null;
      try {
        const s = track.getMediaStreamTrack().getSettings();
        console.info("[diag] screen capture", { width: s.width, height: s.height, frameRate: s.frameRate });
        onCaptureFps?.({ source: "screen", frameRate: s.frameRate });
      } catch {}

      // Native "Stop sharing" button: just tear down the capture (no client).
      track.on("track-ended", () => {
        track.close();
        screenTrackRef.current = null;
        screenAudioTrackRef.current?.close();
        screenAudioTrackRef.current = null;
        setLocalScreenTrack(null);
        setLocalScreenAudioTrack(null);
        setState((prev) => ({ ...prev, isScreenSharing: false }));
      });

      screenTrackRef.current = track;
      screenAudioTrackRef.current = audioTrack;
      setLocalScreenTrack(track);
      setLocalScreenAudioTrack(audioTrack);
      setState((prev) => ({ ...prev, isScreenSharing: true }));
    } else {
      // ── Stop screenshare ───────────────────────────────────────────────────
      screenTrackRef.current.close();
      screenTrackRef.current = null;
      screenAudioTrackRef.current?.close();
      screenAudioTrackRef.current = null;
      setLocalScreenTrack(null);
      setLocalScreenAudioTrack(null);
      setState((prev) => ({ ...prev, isScreenSharing: false }));
    }
  }, [screenShareUid, contentMode, captureFrameRate, onCaptureFps]);

  const switchMicDevice = useCallback(async (deviceId: string) => {
    if (!localAudioTrackRef.current) return;
    await localAudioTrackRef.current.setDevice(deviceId);
  }, []);

  const switchCamDevice = useCallback(async (deviceId: string) => {
    const track = camTrackRef.current as (ILocalVideoTrack & { setDevice?: (id: string) => Promise<void> }) | null;
    if (!track?.setDevice) return;
    await track.setDevice(deviceId);
  }, []);

  const goLiveAsHost = useCallback(async (hostUid: number) => {
    if (!AGORA_APP_ID) return;
    try {
      const AgoraRTC = await getAgoraRTC();

      // iOS Safari only grants getUserMedia inside the user gesture that started
      // this call, and that activation is consumed by the leave()/token-fetch/
      // join() awaits below. Create the camera+mic tracks FIRST, while the gesture
      // is still valid, otherwise the prompt never resolves and the button hangs
      // on "Starting…". If this throws (permission denied) we bail before leaving
      // the audience client, so the user keeps watching.
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();

      // Leave the current audience client before re-joining as host.
      if (clientRef.current) {
        await clientRef.current.leave().catch(() => {});
        clientRef.current = null;
      }
      joinedRef.current = false;
      setState((prev) => ({ ...prev, joined: false, error: null }));

      const client = AgoraRTC.createClient({ mode: "live", codec: chosenCodec() });

      const syncRemote = () =>
        setState((prev) => ({ ...prev, remoteUsers: [...client.remoteUsers] }));

      client.on("user-published", async (user, mediaType) => {
        // On-stage guests DO watch the program video (so they see the show as
        // broadcast) but never its audio - the mix contains their own voice
        // and would echo it back at them. They keep per-track audio instead.
        if (user.uid === CREATOR_COMPOSITE_UID && mediaType === "audio") return;
        await client.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) user.audioTrack.play();
        syncRemote();
      });
      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio") user.audioTrack?.stop();
        syncRemote();
      });
      client.on("user-left", syncRemote);

      await client.setClientRole("host");
      const agoraToken = await fetchAgoraToken(channelNameRef.current, hostUid, authTokenRef.current, participantTokenRef.current);
      applyProxyIfNeeded(client);
      await client.join(AGORA_APP_ID, channelNameRef.current, agoraToken, hostUid);
      client.on("token-privilege-will-expire", async () => {
        try {
          const newToken = await fetchAgoraToken(channelNameRef.current, hostUid, authTokenRef.current, participantTokenRef.current);
          if (newToken) await client.renewToken(newToken);
        } catch (err) {
          setState((prev) => ({ ...prev, error: `Token renewal failed: ${String(err)}` }));
        }
      });

      clientRef.current = client;
      joinedRef.current = true;
      setState((prev) => ({ ...prev, joined: true, remoteUsers: [...client.remoteUsers] }));

      camTrackRef.current = videoTrack;
      localAudioTrackRef.current = audioTrack;
      await client.publish([audioTrack, videoTrack]);
      setState((prev) => ({ ...prev, localVideoTrack: videoTrack, localAudioTrack: audioTrack, error: null }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err) }));
    }
  }, []);

  // Inverse of goLiveAsHost: drop the published camera/mic, leave the host client,
  // and re-join as a plain audience member so a removed guest keeps watching.
  const demoteToAudience = useCallback(async () => {
    if (!AGORA_APP_ID) return;
    try {
      const AgoraRTC = await getAgoraRTC();

      camTrackRef.current?.close();
      camTrackRef.current = null;
      localAudioTrackRef.current?.close();
      localAudioTrackRef.current = null;
      effectOwnsTracksRef.current = false;
      setState((prev) => ({ ...prev, localVideoTrack: null, localAudioTrack: null }));

      if (clientRef.current) {
        await clientRef.current.leave().catch(() => {});
        clientRef.current = null;
      }
      joinedRef.current = false;

      const client = AgoraRTC.createClient({ mode: "live", codec: chosenCodec() });

      const syncRemote = () =>
        setState((prev) => ({ ...prev, remoteUsers: [...client.remoteUsers] }));

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) user.audioTrack.play();
        syncRemote();
      });
      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio") user.audioTrack?.stop();
        syncRemote();
      });
      client.on("user-left", syncRemote);

      await client.setClientRole("audience");
      const agoraToken = await fetchAgoraToken(channelNameRef.current, 0, authTokenRef.current, participantTokenRef.current);
      applyProxyIfNeeded(client);
      await client.join(AGORA_APP_ID, channelNameRef.current, agoraToken, 0);
      client.on("token-privilege-will-expire", async () => {
        try {
          const newToken = await fetchAgoraToken(channelNameRef.current, 0, authTokenRef.current, participantTokenRef.current);
          if (newToken) await client.renewToken(newToken);
        } catch (err) {
          setState((prev) => ({ ...prev, error: `Token renewal failed: ${String(err)}` }));
        }
      });

      clientRef.current = client;
      joinedRef.current = true;
      setState((prev) => ({ ...prev, joined: true, remoteUsers: [...client.remoteUsers], error: null }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err) }));
    }
  }, []);

  return { ...state, localScreenTrack, localScreenAudioTrack, toggleScreenShare, switchMicDevice, switchCamDevice, goLiveAsHost, demoteToAudience };
}
