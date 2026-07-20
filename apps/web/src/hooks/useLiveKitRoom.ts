"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createLocalAudioTrack,
  createLocalScreenTracks,
  createLocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type LocalAudioTrack,
  type LocalVideoTrack,
  type RemoteTrack,
} from "livekit-client";
import type { AgoraRoomState } from "./useAgoraRoom";

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
  enabled: boolean;
  screenShareUid?: number;
  authToken?: string;
}): AgoraRoomState {
  const { channelName, uid, publish, enabled, screenShareUid, authToken } = options;
  const roomRef = useRef<Room | null>(null);
  const cameraRef = useRef<LocalVideoTrack | null>(null);
  const microphoneRef = useRef<LocalAudioTrack | null>(null);
  const screenRef = useRef<LocalVideoTrack | null>(null);
  const currentUidRef = useRef(uid);
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

  const syncRemoteUsers = useCallback((room: Room) => {
    const users: Array<Record<string, unknown>> = [];
    for (const participant of room.remoteParticipants.values()) {
      const numericUid = Number(participant.identity);
      const uidValue = Number.isFinite(numericUid) ? numericUid : 0;
      const camera = participant.getTrackPublication(Track.Source.Camera)?.track;
      const screen = participant.getTrackPublication(Track.Source.ScreenShare)?.track;
      const audio = participant.getTrackPublication(Track.Source.Microphone)?.track;
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

  const connect = useCallback(async (connectUid: number, shouldPublish: boolean) => {
    await disconnect();
    setState((previous) => ({ ...previous, connectionState: "connecting", error: null }));
    const credentials = await fetchToken(channelName, connectUid, authToken);
    const room = new Room({ adaptiveStream: true, dynacast: true });
    const sync = () => syncRemoteUsers(room);
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) track.attach();
      sync();
    });
    room.on(RoomEvent.TrackUnsubscribed, sync);
    room.on(RoomEvent.ParticipantDisconnected, sync);
    room.on(RoomEvent.ConnectionStateChanged, (connectionState) => {
      setState((previous) => ({ ...previous, connectionState }));
    });
    await room.connect(credentials.url, credentials.token);
    roomRef.current = room;
    currentUidRef.current = connectUid;

    if (shouldPublish) {
      const [microphone, camera] = await Promise.all([createLocalAudioTrack(), createLocalVideoTrack()]);
      await room.localParticipant.publishTrack(microphone, { source: Track.Source.Microphone });
      await room.localParticipant.publishTrack(camera, { source: Track.Source.Camera });
      microphoneRef.current = microphone;
      cameraRef.current = camera;
      setState((previous) => ({ ...previous, localAudioTrack: audioAdapter(microphone) as never, localVideoTrack: videoAdapter(camera) as never }));
    }
    sync();
    setState((previous) => ({ ...previous, joined: true, connectionState: "connected" }));
  }, [authToken, channelName, disconnect, syncRemoteUsers]);

  useEffect(() => {
    if (!enabled || !channelName) return;
    let cancelled = false;
    connect(uid, publish).catch((error) => {
      if (!cancelled) setState((previous) => ({ ...previous, error: String(error), connectionState: "disconnected" }));
    });
    return () => { cancelled = true; void disconnect(); };
  }, [channelName, enabled]);

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
    const tracks = await createLocalScreenTracks({ audio: false });
    const screen = tracks.find((track): track is LocalVideoTrack => track.kind === Track.Kind.Video);
    if (!screen) return;
    await room.localParticipant.publishTrack(screen, { source: Track.Source.ScreenShare });
    screenRef.current = screen;
    setState((previous) => ({ ...previous, localScreenTrack: videoAdapter(screen) as never, isScreenSharing: true }));
  }, []);

  return {
    ...state,
    toggleScreenShare,
    switchMicDevice: async (deviceId) => { await microphoneRef.current?.restartTrack({ deviceId }); },
    switchCamDevice: async (deviceId) => { await cameraRef.current?.restartTrack({ deviceId }); },
    goLiveAsHost: async (hostUid) => { await connect(hostUid, true); },
    demoteToAudience: async () => { await connect(0, false); },
  };
}

export function getLiveKitProviderName() {
  return "livekit" as const;
}
