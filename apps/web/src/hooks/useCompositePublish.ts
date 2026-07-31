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

/**
 * Fetches the composite publisher's Agora token, throwing on failure.
 *
 * See the matching note in useAgoraRoom: a swallowed error used to be
 * indistinguishable from testing mode, because both produced a `null` token
 * that joins successfully while the Agora project is in App-ID-only mode.
 * Returns `null` only when the server answers 200 with no token, meaning
 * AGORA_APP_CERTIFICATE is not configured.
 */
async function fetchToken(sessionId: string, authToken?: string): Promise<string | null> {
  const url = `${API_BASE}/agora/token?session_id=${encodeURIComponent(sessionId)}&uid=${CREATOR_COMPOSITE_UID}`;
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(url, { headers, cache: "no-store" });
  } catch (err) {
    throw new Error(`Composite Agora token request failed: ${String(err)}`);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Composite Agora token refused: HTTP ${res.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const { token } = await res.json();
  if (token == null) {
    console.warn(
      "[agora] no composite token issued. AGORA_APP_CERTIFICATE is not set, so this " +
        "publish is unauthenticated. It will fail once token auth is enforced.",
    );
  }
  return (token as string) ?? null;
}

// The Agora (DITCH viewer) profile is INDEPENDENT of the broadcast canvas: the
// composite is downscaled to this for interactive delivery, so a 1080p60
// broadcast never forces 1080p60 onto Agora. label is for diagnostics only.
export interface AgoraProfile {
  width: number;
  height: number;
  frameRate: number;
  bitrateMax: number;
  optimizationMode: "detail" | "motion";
  label: string;
}

export function useCompositePublish({
  stream,
  sessionId,
  authToken,
  enabled,
  agoraProfile,
  onLiveChange,
}: {
  stream: MediaStream | null;
  sessionId: string;
  authToken?: string;
  enabled: boolean;
  agoraProfile: AgoraProfile;
  /** Called true once the composite is publishing to Agora, false on teardown/
   *  failure. Drives the creator-camera fallback publish in useAgoraRoom. */
  onLiveChange?: (live: boolean) => void;
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
        // Event handler: a throw here would be an unhandled rejection, and the
        // composite publish would silently drop when the token expired.
        try {
          const t = await fetchToken(sessionId, authToken);
          if (t) await c.renewToken(t);
        } catch (err) {
          console.error("[composite] token renewal failed:", err);
        }
      });

      // Downscale the composite to the interactive Agora profile, independent of
      // the broadcast canvas (720p30@3M default, or 1080p30@5M for a selected
      // 1080p Detail/30 program). Agora resizes the source frames to this.
      const localVideo = AgoraRTC.createCustomVideoTrack({
        mediaStreamTrack: videoTrack,
        width: agoraProfile.width,
        height: agoraProfile.height,
        frameRate: agoraProfile.frameRate,
        bitrateMin: Math.round(agoraProfile.bitrateMax * 0.6),
        bitrateMax: agoraProfile.bitrateMax,
        optimizationMode: agoraProfile.optimizationMode,
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
      onLiveChange?.(true);
      console.log("[composite] program feed published as uid", CREATOR_COMPOSITE_UID);
      console.info("[diag] agora profile", { profile: agoraProfile.label });

      // Diagnostics: what DITCH viewers actually receive. sendResolution +
      // sendBitrate reveal whether the composite is degraded on the Agora hop;
      // captureFrameRate vs sendFrameRate reveals dropped frames.
      statsTimer = setInterval(() => {
        try {
          const v = localVideo.getStats();
          console.info("[diag] composite send", {
            profile: agoraProfile.label,
            sendResolution: `${v.sendResolutionWidth}x${v.sendResolutionHeight}`,
            sendBitrateKbps: Math.round((v.sendBitrate ?? 0) / 1000),
            sendFrameRate: v.sendFrameRate,
            captureFrameRate: v.captureFrameRate,
          });
        } catch {}
      }, 5000);
    })().catch((err) => { onLiveChange?.(false); console.warn("[composite] publish failed:", err); });

    return () => {
      cancelled = true;
      onLiveChange?.(false);
      if (statsTimer) { clearInterval(statsTimer); statsTimer = null; }
      tracks.forEach((t) => { try { t.close(); } catch {} });
      client?.leave().catch(() => {});
      client = null;
    };
    // agoraProfile.label uniquely identifies the profile; changing resolution,
    // frame rate, or content mode republishes with the new config.
  }, [enabled, stream, sessionId, authToken, agoraProfile.label, onLiveChange]);
}
