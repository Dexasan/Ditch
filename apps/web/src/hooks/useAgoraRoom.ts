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

async function fetchAgoraToken(sessionId: string, uid: number, authToken?: string): Promise<string | null> {
  try {
    const url = `${API_BASE}/agora/token?session_id=${encodeURIComponent(sessionId)}&uid=${uid}`;
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const { token } = await res.json();
    return token as string | null;
  } catch {
    return null;
  }
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
  /** UID for the screen-share second client. Required to enable screenshare. */
  screenShareUid?: number;
  /** Supabase access token forwarded to the Agora token endpoint. Required when App Certificate is configured. */
  authToken?: string;
}): AgoraRoomState {
  const { channelName, uid, role, publish, publishAudio, enabled, screenShareUid, authToken } = options;

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
      const agoraToken = await fetchAgoraToken(channelName, uid, authTokenRef.current);
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
        const newToken = await fetchAgoraToken(channelNameRef.current, uid, authTokenRef.current);
        if (newToken) await client.renewToken(newToken);
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
    const needsWork =
      (wantVideo && !camTrackRef.current) ||
      (wantAudio && !localAudioTrackRef.current) ||
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
          // Capture at 1080p30. Agora's default is 480p, which the compositor
          // then stretches across a 720p/1080p canvas: more pixels, no real
          // detail. Capturing at 1080p gives the compositor genuine detail to
          // downscale from (supersampled and sharp at 720p, native at 1080p).
          const videoTrack = await AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: 1920,
              height: 1080,
              frameRate: 30,
              bitrateMin: 1500,
              bitrateMax: 5000,
            },
          });
          if (cancelled || clientRef.current !== client) {
            videoTrack.close();
          } else {
            await client.publish(videoTrack);
            camTrackRef.current = videoTrack;
            effectOwnsTracksRef.current = true;
            setState((prev) => ({ ...prev, localVideoTrack: videoTrack }));
          }
        }

        if (!wantVideo && camTrackRef.current && effectOwnsTracksRef.current) {
          const camera = camTrackRef.current;
          camTrackRef.current = null;
          await client.unpublish(camera).catch(() => {});
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
  }, [enabled, publish, publishAudio, state.joined]);
  const toggleScreenShare = useCallback(async () => {
    if (!AGORA_APP_ID || screenShareUid === undefined) return;

    const AgoraRTC = await getAgoraRTC();

    if (!screenClientRef.current) {
      // ── Start screenshare ──────────────────────────────────────────────────
      // Create a dedicated second client so the camera client is untouched.
      const screenClient = AgoraRTC.createClient({ mode: "live", codec: chosenCodec() });
      await screenClient.setClientRole("host");
      const screenToken = await fetchAgoraToken(channelNameRef.current, screenShareUid, authTokenRef.current);
      applyProxyIfNeeded(screenClient);
      await screenClient.join(AGORA_APP_ID, channelNameRef.current, screenToken, screenShareUid);
      screenClient.on("token-privilege-will-expire", async () => {
        const newToken = await fetchAgoraToken(channelNameRef.current, screenShareUid, authTokenRef.current);
        if (newToken) await screenClient.renewToken(newToken);
      });

      // Capture desktop/tab audio with the voice-DSP turned OFF. Agora's
      // default screen-audio processing (AEC/AGC/ANS) is tuned for speech and
      // makes music/desktop audio sound "groggy" - warbly and pumping. Passing
      // an explicit config disables all three for clean, full-range audio.
      // When the user ticks "share audio", Agora returns [videoTrack,
      // audioTrack]; the audio is mixed into the program by the compositor (it
      // is not published on the screen client - the composite feed already
      // carries it to viewers and to the RTMP relay). If a browser can't
      // capture screen audio at all, fall back to a video-only share.
      // Capture the screen at 1080p30 with "detail" optimization: desktops and
      // UIs are full of thin text and sharp edges, so favor resolution/detail
      // over frame rate (the default "motion" mode blurs static text to chase
      // fps). Higher bitrate than Agora's ~3 Mbps default so text stays crisp.
      const screenConfig = {
        encoderConfig: {
          width: 1920,
          height: 1080,
          frameRate: 30,
          bitrateMin: 2000,
          bitrateMax: 5000,
        },
        optimizationMode: "detail" as const,
      };
      let result: Awaited<ReturnType<typeof AgoraRTC.createScreenVideoTrack>>;
      try {
        result = await AgoraRTC.createScreenVideoTrack(screenConfig, { AEC: false, AGC: false, ANS: false });
      } catch {
        result = await AgoraRTC.createScreenVideoTrack(screenConfig, "disable");
      }
      const track = Array.isArray(result) ? result[0] : result;
      const audioTrack = Array.isArray(result) ? result[1] : null;

      // Handle the browser's native "Stop sharing" button
      track.on("track-ended", () => {
        screenClientRef.current?.leave().catch(() => {});
        screenClientRef.current = null;
        track.close();
        screenTrackRef.current = null;
        screenAudioTrackRef.current?.close();
        screenAudioTrackRef.current = null;
        setLocalScreenTrack(null);
        setLocalScreenAudioTrack(null);
        setState((prev) => ({ ...prev, isScreenSharing: false }));
      });

      await screenClient.publish(track);
      screenClientRef.current = screenClient;
      screenTrackRef.current = track;
      screenAudioTrackRef.current = audioTrack;
      setLocalScreenTrack(track);
      setLocalScreenAudioTrack(audioTrack);
      setState((prev) => ({ ...prev, isScreenSharing: true }));
    } else {
      // ── Stop screenshare ───────────────────────────────────────────────────
      if (screenTrackRef.current) {
        await screenClientRef.current.unpublish(screenTrackRef.current).catch(() => {});
        screenTrackRef.current.close();
        screenTrackRef.current = null;
      }
      screenAudioTrackRef.current?.close();
      screenAudioTrackRef.current = null;
      await screenClientRef.current.leave().catch(() => {});
      screenClientRef.current = null;
      setLocalScreenTrack(null);
      setLocalScreenAudioTrack(null);
      setState((prev) => ({ ...prev, isScreenSharing: false }));
    }
  }, [screenShareUid]);

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
      const agoraToken = await fetchAgoraToken(channelNameRef.current, hostUid, authTokenRef.current);
      applyProxyIfNeeded(client);
      await client.join(AGORA_APP_ID, channelNameRef.current, agoraToken, hostUid);
      client.on("token-privilege-will-expire", async () => {
        const newToken = await fetchAgoraToken(channelNameRef.current, hostUid, authTokenRef.current);
        if (newToken) await client.renewToken(newToken);
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
      const agoraToken = await fetchAgoraToken(channelNameRef.current, 0, authTokenRef.current);
      applyProxyIfNeeded(client);
      await client.join(AGORA_APP_ID, channelNameRef.current, agoraToken, 0);
      client.on("token-privilege-will-expire", async () => {
        const newToken = await fetchAgoraToken(channelNameRef.current, 0, authTokenRef.current);
        if (newToken) await client.renewToken(newToken);
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
