"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  ILocalAudioTrack,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { AGORA_APP_ID, getAgoraRTC } from "@/lib/agora";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

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
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  joined: boolean;
  error: string | null;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
  /** Hot-switch the active microphone without dropping the channel. */
  switchMicDevice: (deviceId: string) => Promise<void>;
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
  enabled: boolean;
  /** UID for the screen-share second client. Required to enable screenshare. */
  screenShareUid?: number;
  /** Supabase access token forwarded to the Agora token endpoint. Required when App Certificate is configured. */
  authToken?: string;
}): AgoraRoomState {
  const { channelName, uid, role, publish, enabled, screenShareUid, authToken } = options;

  const [state, setState] = useState<Omit<AgoraRoomState, "localScreenTrack" | "toggleScreenShare" | "switchMicDevice" | "goLiveAsHost" | "demoteToAudience">>({
    localVideoTrack: null,
    localAudioTrack: null,
    remoteUsers: [],
    joined: false,
    error: null,
    isScreenSharing: false,
  });
  const [localScreenTrack, setLocalScreenTrack] = useState<ILocalVideoTrack | null>(null);

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

      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      clientRef.current = client;

      const syncRemote = () =>
        setState((prev) => ({ ...prev, remoteUsers: [...client.remoteUsers] }));

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) {
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
      await client.join(AGORA_APP_ID, channelName, agoraToken, uid);
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
        isScreenSharing: false,
      });
      setLocalScreenTrack(null);
    };
  // Role/uid changes cause a full leave+rejoin - intentional. publish is handled
  // by the dedicated effect below so toggling it does NOT drop the channel.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName, uid, role]);

  // ── Publish toggle ────────────────────────────────────────────────────────────
  // Publishes/unpublishes mic+camera on the already-joined client. Owns only the
  // tracks it creates: goLiveAsHost manages its own (effectOwnsTracksRef stays
  // false there), so a publish=false render can never tear down a promoted
  // participant's tracks.
  useEffect(() => {
    const client = clientRef.current;
    if (!enabled || !client || !state.joined) return;
    let cancelled = false;

    if (publish && !camTrackRef.current && !publishBusyRef.current) {
      publishBusyRef.current = true;
      (async () => {
        const AgoraRTC = await getAgoraRTC();
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        if (cancelled || clientRef.current !== client) {
          audioTrack.close();
          videoTrack.close();
          return;
        }
        await client.publish([audioTrack, videoTrack]);
        camTrackRef.current = videoTrack;
        localAudioTrackRef.current = audioTrack;
        effectOwnsTracksRef.current = true;
        setState((prev) => ({ ...prev, localVideoTrack: videoTrack, localAudioTrack: audioTrack }));
      })()
        .catch((err) => { if (!cancelled) setState((prev) => ({ ...prev, error: String(err) })); })
        .finally(() => { publishBusyRef.current = false; });
    } else if (!publish && camTrackRef.current && effectOwnsTracksRef.current) {
      const audioTrack = localAudioTrackRef.current;
      const camTrack = camTrackRef.current;
      client.unpublish(audioTrack ? [audioTrack, camTrack] : [camTrack]).catch(() => {});
      camTrack.close();
      audioTrack?.close();
      camTrackRef.current = null;
      localAudioTrackRef.current = null;
      effectOwnsTracksRef.current = false;
      setState((prev) => ({ ...prev, localVideoTrack: null, localAudioTrack: null }));
    }

    return () => { cancelled = true; };
  }, [enabled, publish, state.joined]);

  const toggleScreenShare = useCallback(async () => {
    if (!AGORA_APP_ID || screenShareUid === undefined) return;

    const AgoraRTC = await getAgoraRTC();

    if (!screenClientRef.current) {
      // ── Start screenshare ──────────────────────────────────────────────────
      // Create a dedicated second client so the camera client is untouched.
      const screenClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      await screenClient.setClientRole("host");
      const screenToken = await fetchAgoraToken(channelNameRef.current, screenShareUid, authTokenRef.current);
      await screenClient.join(AGORA_APP_ID, channelNameRef.current, screenToken, screenShareUid);
      screenClient.on("token-privilege-will-expire", async () => {
        const newToken = await fetchAgoraToken(channelNameRef.current, screenShareUid, authTokenRef.current);
        if (newToken) await screenClient.renewToken(newToken);
      });

      const result = await AgoraRTC.createScreenVideoTrack({}, "disable");
      const track = Array.isArray(result) ? result[0] : result;

      // Handle the browser's native "Stop sharing" button
      track.on("track-ended", () => {
        screenClientRef.current?.leave().catch(() => {});
        screenClientRef.current = null;
        track.close();
        screenTrackRef.current = null;
        setLocalScreenTrack(null);
        setState((prev) => ({ ...prev, isScreenSharing: false }));
      });

      await screenClient.publish(track);
      screenClientRef.current = screenClient;
      screenTrackRef.current = track;
      setLocalScreenTrack(track);
      setState((prev) => ({ ...prev, isScreenSharing: true }));
    } else {
      // ── Stop screenshare ───────────────────────────────────────────────────
      if (screenTrackRef.current) {
        await screenClientRef.current.unpublish(screenTrackRef.current).catch(() => {});
        screenTrackRef.current.close();
        screenTrackRef.current = null;
      }
      await screenClientRef.current.leave().catch(() => {});
      screenClientRef.current = null;
      setLocalScreenTrack(null);
      setState((prev) => ({ ...prev, isScreenSharing: false }));
    }
  }, [screenShareUid]);

  const switchMicDevice = useCallback(async (deviceId: string) => {
    if (!localAudioTrackRef.current) return;
    await localAudioTrackRef.current.setDevice(deviceId);
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

      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });

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

      await client.setClientRole("host");
      const agoraToken = await fetchAgoraToken(channelNameRef.current, hostUid, authTokenRef.current);
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

      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });

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

  return { ...state, localScreenTrack, toggleScreenShare, switchMicDevice, goLiveAsHost, demoteToAudience };
}
