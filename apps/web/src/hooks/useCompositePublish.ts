"use client";

// Publishes the studio's composite output (canvas video + mixed audio) into the
// session's Agora channel under CREATOR_COMPOSITE_UID, so DITCH viewers watch
// the SAME program that goes to Twitch/YouTube - layers, guests, overlays and
// all - instead of just the raw creator camera.
//
// On-stage guests deliberately do NOT consume this feed (they keep low-latency
// per-track views and would otherwise hear themselves back with a delay).

import { useEffect } from "react";
import type { IAgoraRTCClient, ILocalAudioTrack, ILocalVideoTrack } from "agora-rtc-sdk-ng";
import { AGORA_APP_ID, CREATOR_COMPOSITE_UID, getAgoraRTC } from "@/lib/agora";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

async function fetchToken(sessionId: string, authToken?: string): Promise<string | null> {
  try {
    const url = `${API_BASE}/agora/token?session_id=${encodeURIComponent(sessionId)}&uid=${CREATOR_COMPOSITE_UID}`;
    const headers: Record<string, string> = {};
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) return null;
    const { token } = await res.json();
    return (token as string) ?? null;
  } catch {
    return null;
  }
}

export function useCompositePublish({
  stream,
  sessionId,
  authToken,
  enabled,
}: {
  stream: MediaStream | null;
  sessionId: string;
  authToken?: string;
  enabled: boolean;
}): void {
  useEffect(() => {
    if (!enabled || !stream || !AGORA_APP_ID) return;

    let cancelled = false;
    let client: IAgoraRTCClient | null = null;
    let tracks: Array<ILocalVideoTrack | ILocalAudioTrack> = [];
    let statsTimer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const AgoraRTC = await getAgoraRTC();

      // Clone the compositor's tracks: Agora closes the underlying
      // MediaStreamTrack on teardown, and stopping the originals would kill the
      // RTMP relay feed and the local preview with it.
      const videoSrc = stream.getVideoTracks()[0];
      const audioSrc = stream.getAudioTracks()[0];
      if (!videoSrc || cancelled) return;
      const videoTrack = videoSrc.clone();
      const audioTrack = audioSrc ? audioSrc.clone() : null;

      const c = AgoraRTC.createClient({ mode: "live", codec: "h264" });
      await c.setClientRole("host");
      const token = await fetchToken(sessionId, authToken);
      if (cancelled) { videoTrack.stop(); audioTrack?.stop(); return; }

      await c.join(AGORA_APP_ID, sessionId, token, CREATOR_COMPOSITE_UID);
      c.on("token-privilege-will-expire", async () => {
        const t = await fetchToken(sessionId, authToken);
        if (t) await c.renewToken(t);
      });

      const localVideo = AgoraRTC.createCustomVideoTrack({
        mediaStreamTrack: videoTrack,
        // ~5 Mbps (Agora's recommended 1080p upper range). The old 3000 cap
        // crushed desktop text and detailed UIs on the DITCH viewer feed.
        bitrateMin: 2000,
        bitrateMax: 5000,
      });
      const localAudio = audioTrack
        ? AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: audioTrack })
        : null;
      tracks = localAudio ? [localVideo, localAudio] : [localVideo];

      if (cancelled) {
        tracks.forEach((t) => { try { t.close(); } catch {} });
        await c.leave().catch(() => {});
        return;
      }
      await c.publish(tracks);
      client = c;
      console.log("[composite] program feed published as uid", CREATOR_COMPOSITE_UID);

      // Diagnostics: what DITCH viewers actually receive. sendResolution +
      // sendBitrate reveal whether the composite is degraded on the Agora hop;
      // captureFrameRate vs sendFrameRate reveals dropped frames.
      statsTimer = setInterval(() => {
        try {
          const v = localVideo.getStats();
          console.info("[diag] composite send", {
            sendResolution: `${v.sendResolutionWidth}x${v.sendResolutionHeight}`,
            sendBitrateKbps: Math.round((v.sendBitrate ?? 0) / 1000),
            sendFrameRate: v.sendFrameRate,
            captureFrameRate: v.captureFrameRate,
          });
        } catch {}
      }, 5000);
    })().catch((err) => console.warn("[composite] publish failed:", err));

    return () => {
      cancelled = true;
      if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
      tracks.forEach((t) => { try { t.close(); } catch {} });
      client?.leave().catch(() => {});
      client = null;
    };
  }, [enabled, stream, sessionId, authToken]);
}
