"use client";

import { useEffect } from "react";
import type { Room } from "livekit-client";
import { CREATOR_COMPOSITE_UID } from "@/lib/agora";
import { loadLiveKit } from "@/lib/livekit";

const API_BASE = "/api/backend";

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
      // Pull the SDK chunk alongside the token request so the lazy import does
      // not add a round trip before the program feed goes up.
      const [lk, response] = await Promise.all([
        loadLiveKit(),
        fetch(
          `${API_BASE}/livekit/token?session_id=${encodeURIComponent(sessionId)}&uid=${CREATOR_COMPOSITE_UID}`,
          { headers, cache: "no-store" },
        ),
      ]);
      if (!response.ok) throw new Error("LiveKit composite token request failed");
      const credentials = await response.json() as { token: string; url: string };
      if (cancelled) return;

      const nextRoom = new lk.Room({ dynacast: true });
      await nextRoom.connect(credentials.url, credentials.token);
      room = nextRoom;

      const sourceVideo = stream.getVideoTracks()[0];
      const sourceAudio = stream.getAudioTracks()[0];
      if (!sourceVideo) return;
      const videoClone = sourceVideo.clone();
      clones.push(videoClone);
      await nextRoom.localParticipant.publishTrack(new lk.LocalVideoTrack(videoClone), {
        source: lk.Track.Source.Camera,
        videoCodec: "h264",
        simulcast: true,
      });
      if (sourceAudio) {
        const audioClone = sourceAudio.clone();
        clones.push(audioClone);
        await nextRoom.localParticipant.publishTrack(new lk.LocalAudioTrack(audioClone), {
          source: lk.Track.Source.Microphone,
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
