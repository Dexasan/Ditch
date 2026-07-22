"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteTrack,
  Room,
} from "livekit-client";
import type { AgoraRoomState } from "./useAgoraRoom";
import { loadLiveKit, type LiveKitModule } from "@/lib/livekit";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

async function fetchToken(sessionId: string, uid: number, authToken?: string) {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(
    `${API_BASE}/livekit/token?session_id=${encodeURIComponent(sessionId)}&uid=${uid}`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "LiveKit token request failed");
  return response.json() as Promise<{ token: string; url: string }>;
}

function videoAdapter(track: LocalVideoTrack | RemoteTrack) {
  return {
    play(container: HTMLElement, options?: { fit?: "contain" | "cover"; mirror?: boolean }) {
      const element = track.attach() as HTMLVideoElement;
      element.autoplay = true;
      element.playsInline = true;
      element.style.width = "100%";
      element.style.height = "100%";
      element.style.objectFit = options?.fit ?? "cover";
      element.style.transform = options?.mirror ? "scaleX(-1)" : "none";
      container.replaceChildren(element);
    },
    stop() {
      track.detach().forEach((element) => element.remove());
    },
    close() {
      track.detach().forEach((element) => element.remove());
      if ("stop" in track) track.stop();
    },
    getMediaStreamTrack() {
      return track.mediaStreamTrack;
    },
    async setDevice(deviceId: string) {
      if ("restartTrack" in track) await track.restartTrack({ deviceId });
    },
  };
}

function audioAdapter(track: LocalAudioTrack | RemoteTrack) {
  return {
    play() { track.attach(); },
    stop() { track.detach().forEach((element) => element.remove()); },
    close() {
      track.detach().forEach((element) => element.remove());
      if ("stop" in track) track.stop();
    },
    getMediaStreamTrack() { return track.mediaStreamTrack; },
    async setDevice(deviceId: string) {
      if ("restartTrack" in track) await track.restartTrack({ deviceId });
    },
  };
}

export function useLiveKitRoom(options: {
  channelName: string;
  uid: number;
  role: "host" | "audience";
  publish: boolean;
  publishAudio?: boolean;
  enabled: boolean;
  screenShareUid?: number;
  authToken?: string;
}): AgoraRoomState {
  const { channelName, uid, role, publish, publishAudio, enabled, screenShareUid, authToken } = options;
  const roomRef = useRef<Room | null>(null);
  const cameraRef = useRef<LocalVideoTrack | null>(null);
  const microphoneRef = useRef<LocalAudioTrack | null>(null);
  const screenRef = useRef<LocalVideoTrack | null>(null);
  const currentUidRef = useRef(uid);
  const publishQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [state, setState] = useState<AgoraRoomState>({
    localVideoTrack: null,
    localScreenTrack: null,
    localAudioTrack: null,
    remoteUsers: [],
    joined: false,
    error: null,
    connectionState: "init",
    isScreenSharing: false,
    toggleScreenShare: async () => {},
    switchMicDevice: async () => {},
    switchCamDevice: async () => {},
    goLiveAsHost: async () => {},
    demoteToAudience: async () => {},
  });

  const syncRemoteUsers = useCallback((room: Room, lk: LiveKitModule) => {
    const users: Array<Record<string, unknown>> = [];
    for (const participant of room.remoteParticipants.values()) {
      const numericUid = Number(participant.identity);
      const uidValue = Number.isFinite(numericUid) ? numericUid : 0;
      const camera = participant.getTrackPublication(lk.Track.Source.Camera)?.track;
      const screen = participant.getTrackPublication(lk.Track.Source.ScreenShare)?.track;
      const audio = participant.getTrackPublication(lk.Track.Source.Microphone)?.track;
      if (camera || audio) {
        users.push({
          uid: uidValue,
          videoTrack: camera ? videoAdapter(camera) : undefined,
          audioTrack: audio ? audioAdapter(audio) : undefined,
        });
      }
      if (screen) {
        users.push({ uid: uidValue === 999 ? (screenShareUid ?? 998) : uidValue, videoTrack: videoAdapter(screen) });
      }
    }
    setState((previous) => ({ ...previous, remoteUsers: users as unknown as AgoraRoomState["remoteUsers"] }));
  }, [screenShareUid]);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    cameraRef.current?.stop();
    microphoneRef.current?.stop();
    screenRef.current?.stop();
    cameraRef.current = null;
    microphoneRef.current = null;
    screenRef.current = null;
    if (room) await room.disconnect();
    setState((previous) => ({ ...previous, joined: false, localVideoTrack: null, localAudioTrack: null, localScreenTrack: null, isScreenSharing: false }));
  }, []);

  const connect = useCallback(async (
    connectUid: number,
    shouldPublishVideo: boolean,
    shouldPublishAudio: boolean,
  ) => {
    await disconnect();
    setState((previous) => ({ ...previous, connectionState: "connecting", error: null }));
    // Fetch the token and pull the SDK chunk at the same time so the lazy
    // import does not add a round trip to stream startup.
    const [lk, credentials] = await Promise.all([
      loadLiveKit(),
      fetchToken(channelName, connectUid, authToken),
    ]);
    const room = new lk.Room({ adaptiveStream: true, dynacast: true });
    const sync = () => syncRemoteUsers(room, lk);
    room.on(lk.RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === lk.Track.Kind.Audio) track.attach();
      sync();
    });
    room.on(lk.RoomEvent.TrackUnsubscribed, sync);
    room.on(lk.RoomEvent.ParticipantDisconnected, sync);
    room.on(lk.RoomEvent.ConnectionStateChanged, (connectionState) => {
      setState((previous) => ({ ...previous, connectionState }));
    });
    await room.connect(credentials.url, credentials.token);
    roomRef.current = room;
    currentUidRef.current = connectUid;

    // Mic and camera are published independently: a scene with no camera layer
    // must still carry audio, or a screen-share-only broadcast goes out silent
    // and the composite has no audio stream for the relay to map.
    if (shouldPublishAudio) {
      const microphone = await lk.createLocalAudioTrack();
      await room.localParticipant.publishTrack(microphone, { source: lk.Track.Source.Microphone });
      microphoneRef.current = microphone;
      setState((previous) => ({ ...previous, localAudioTrack: audioAdapter(microphone) as never }));
    }
    if (shouldPublishVideo) {
      const camera = await lk.createLocalVideoTrack();
      await room.localParticipant.publishTrack(camera, { source: lk.Track.Source.Camera });
      cameraRef.current = camera;
      setState((previous) => ({ ...previous, localVideoTrack: videoAdapter(camera) as never }));
    }
    sync();
    setState((previous) => ({ ...previous, joined: true, connectionState: "connected" }));
  }, [authToken, channelName, disconnect, syncRemoteUsers]);

  useEffect(() => {
    if (!enabled || !channelName) return;
    let cancelled = false;
    connect(uid, publish, publishAudio ?? publish).catch((error) => {
      if (!cancelled) setState((previous) => ({ ...previous, error: String(error), connectionState: "disconnected" }));
    });
    return () => { cancelled = true; void disconnect(); };
  }, [channelName, enabled]);

  // Creator scenes can switch between graphics-only and camera layouts while
  // live. Keep LiveKit publication in sync without reconnecting the room. This
  // is host-only so a promoted audience participant remains owned by
  // goLiveAsHost instead of being torn down by their original audience props.
  useEffect(() => {
    const room = roomRef.current;
    if (!enabled || role !== "host" || !state.joined || !room) return;
    const wantVideo = publish;
    const wantAudio = publishAudio ?? publish;

    publishQueueRef.current = publishQueueRef.current.then(async () => {
      if (roomRef.current !== room) return;
      // Already resolved from cache: the room cannot be joined without connect()
      // having loaded the SDK first.
      const lk = await loadLiveKit();

      if (wantAudio && !microphoneRef.current) {
        const microphone = await lk.createLocalAudioTrack();
        if (roomRef.current !== room) { microphone.stop(); return; }
        await room.localParticipant.publishTrack(microphone, { source: lk.Track.Source.Microphone });
        microphoneRef.current = microphone;
        setState((previous) => ({ ...previous, localAudioTrack: audioAdapter(microphone) as never }));
      }
      if (wantVideo && !cameraRef.current) {
        const camera = await lk.createLocalVideoTrack();
        if (roomRef.current !== room) { camera.stop(); return; }
        await room.localParticipant.publishTrack(camera, { source: lk.Track.Source.Camera });
        cameraRef.current = camera;
        setState((previous) => ({ ...previous, localVideoTrack: videoAdapter(camera) as never }));
      }

      if (!wantVideo && cameraRef.current) {
        const camera = cameraRef.current;
        cameraRef.current = null;
        await room.localParticipant.unpublishTrack(camera);
        camera.stop();
        setState((previous) => ({ ...previous, localVideoTrack: null }));
      }
      if (!wantAudio && microphoneRef.current) {
        const microphone = microphoneRef.current;
        microphoneRef.current = null;
        await room.localParticipant.unpublishTrack(microphone);
        microphone.stop();
        setState((previous) => ({ ...previous, localAudioTrack: null }));
      }
    }).catch((error) => {
      if (roomRef.current === room) {
        setState((previous) => ({ ...previous, error: String(error) }));
      }
    });
  }, [enabled, publish, publishAudio, role, state.joined]);
  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (screenRef.current) {
      await room.localParticipant.unpublishTrack(screenRef.current);
      screenRef.current.stop();
      screenRef.current = null;
      setState((previous) => ({ ...previous, localScreenTrack: null, isScreenSharing: false }));
      return;
    }
    const lk = await loadLiveKit();
    const tracks = await lk.createLocalScreenTracks({ audio: false });
    const screen = tracks.find((track): track is LocalVideoTrack => track.kind === lk.Track.Kind.Video);
    if (!screen) return;
    await room.localParticipant.publishTrack(screen, { source: lk.Track.Source.ScreenShare });
    screenRef.current = screen;
    setState((previous) => ({ ...previous, localScreenTrack: videoAdapter(screen) as never, isScreenSharing: true }));
  }, []);

  return {
    ...state,
    toggleScreenShare,
    switchMicDevice: async (deviceId) => { await microphoneRef.current?.restartTrack({ deviceId }); },
    switchCamDevice: async (deviceId) => { await cameraRef.current?.restartTrack({ deviceId }); },
    // A guest going on stage publishes both camera and mic; demotion drops both.
    goLiveAsHost: async (hostUid) => { await connect(hostUid, true, true); },
    demoteToAudience: async () => { await connect(0, false, false); },
  };
}

export function getLiveKitProviderName() {
  return "livekit" as const;
}
