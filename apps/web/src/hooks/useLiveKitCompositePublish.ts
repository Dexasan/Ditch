"use client";

import { useEffect } from "react";
import { LocalAudioTrack, LocalVideoTrack, Room, Track } from "livekit-client";
import { CREATOR_COMPOSITE_UID } from "@/lib/agora";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export function useLiveKitCompositePublish({
  stream,
  sessionId,
  authToken,
  enabled,
}: {
  stream: MediaStream | null;
  sessionId: string;
  authToken?: string;
  enabled: boolean;
}) {
  useEffect(() => {
    if (!enabled || !stream) return;
    let cancelled = false;
    let room: Room | null = null;
    const clones: MediaStreamTrack[] = [];

    void (async () => {
      const headers: Record<string, string> = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const response = await fetch(
        `${API_BASE}/livekit/token?session_id=${encodeURIComponent(sessionId)}&uid=${CREATOR_COMPOSITE_UID}`,
        { headers, cache: "no-store" },
      );
      if (!response.ok) throw new Error("LiveKit composite token request failed");
      const credentials = await response.json() as { token: string; url: string };
      if (cancelled) return;

      const nextRoom = new Room({ dynacast: true });
      await nextRoom.connect(credentials.url, credentials.token);
      room = nextRoom;

      const sourceVideo = stream.getVideoTracks()[0];
      const sourceAudio = stream.getAudioTracks()[0];
      if (!sourceVideo) return;
      const videoClone = sourceVideo.clone();
      clones.push(videoClone);
      await nextRoom.localParticipant.publishTrack(new LocalVideoTrack(videoClone), {
        source: Track.Source.Camera,
        videoCodec: "h264",
        simulcast: true,
      });
      if (sourceAudio) {
        const audioClone = sourceAudio.clone();
        clones.push(audioClone);
        await nextRoom.localParticipant.publishTrack(new LocalAudioTrack(audioClone), {
          source: Track.Source.Microphone,
        });
      }
      console.log("[composite] LiveKit program feed published as uid", CREATOR_COMPOSITE_UID);
    })().catch((error) => console.warn("[composite] LiveKit publish failed:", error));

    return () => {
      cancelled = true;
      clones.forEach((track) => track.stop());
      room?.disconnect();
      room = null;
    };
  }, [authToken, enabled, sessionId, stream]);
}
