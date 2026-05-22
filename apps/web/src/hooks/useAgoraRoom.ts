"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  ILocalAudioTrack,
} from "agora-rtc-sdk-ng";
import { AGORA_APP_ID, getAgoraRTC } from "@/lib/agora";

export interface AgoraRoomState {
  localVideoTrack: ILocalVideoTrack | null;   // camera
  localScreenTrack: ILocalVideoTrack | null;  // screen share (second client)
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  joined: boolean;
  error: string | null;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
  /** Call this directly from an onClick handler. iOS Safari requires getUserMedia to
   *  be triggered within a user gesture; calling it from useEffect (socket event chain)
   *  is blocked. This function creates mic+camera tracks and publishes to the already-
   *  joined client, so the permission prompt fires while the gesture context is active. */
  publishTracks: () => Promise<void>;
}

export function useAgoraRoom(options: {
  channelName: string;
  uid: number;
  role: "host" | "audience";
  publish: boolean;
  enabled: boolean;
  /** UID for the screen-share second client. Required to enable screenshare. */
  screenShareUid?: number;
}): AgoraRoomState {
  const { channelName, uid, role, publish, enabled, screenShareUid } = options;

  const [state, setState] = useState<Omit<AgoraRoomState, "localScreenTrack" | "toggleScreenShare" | "publishTracks">>({
    localVideoTrack: null,
    localAudioTrack: null,
    remoteUsers: [],
    joined: false,
    error: null,
    isScreenSharing: false,
  });
  const [localScreenTrack, setLocalScreenTrack] = useState<ILocalVideoTrack | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const camTrackRef = useRef<ILocalVideoTrack | null>(null);
  // Second client + track used exclusively for screen share
  const screenClientRef = useRef<IAgoraRTCClient | null>(null);
  const screenTrackRef = useRef<ILocalVideoTrack | null>(null);
  // Stable ref so toggleScreenShare closure can read current channelName
  const channelNameRef = useRef(channelName);
  useEffect(() => { channelNameRef.current = channelName; }, [channelName]);

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
      // null token = Testing mode (no App Certificate required)
      await client.join(AGORA_APP_ID, channelName, null, uid);
      if (!mounted) return;

      setState((prev) => ({ ...prev, joined: true, remoteUsers: [...client.remoteUsers] }));

      if (publish) {
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        if (!mounted) return;
        await client.publish([audioTrack, videoTrack]);
        camTrackRef.current = videoTrack;
        setState((prev) => ({ ...prev, localVideoTrack: videoTrack, localAudioTrack: audioTrack }));
      }
    }

    setup().catch((err) => {
      if (mounted) setState((prev) => ({ ...prev, error: String(err) }));
    });

    return () => {
      mounted = false;
      camTrackRef.current?.close();
      camTrackRef.current = null;
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
  // Role/publish/uid changes cause a full leave+rejoin — intentional.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, channelName, uid, role, publish]);

  const toggleScreenShare = useCallback(async () => {
    if (!AGORA_APP_ID || screenShareUid === undefined) return;

    const AgoraRTC = await getAgoraRTC();

    if (!screenClientRef.current) {
      // ── Start screenshare ──────────────────────────────────────────────────
      // Create a dedicated second client so the camera client is untouched.
      const screenClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      await screenClient.setClientRole("host");
      await screenClient.join(AGORA_APP_ID, channelNameRef.current, null, screenShareUid);

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

  const publishTracks = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      setState((prev) => ({ ...prev, error: "Not connected — try reloading" }));
      return;
    }
    try {
      const AgoraRTC = await getAgoraRTC();
      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      camTrackRef.current = videoTrack;
      await client.publish([audioTrack, videoTrack]);
      setState((prev) => ({ ...prev, localVideoTrack: videoTrack, localAudioTrack: audioTrack, error: null }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: String(err) }));
    }
  }, []);

  return { ...state, localScreenTrack, toggleScreenShare, publishTracks };
}
