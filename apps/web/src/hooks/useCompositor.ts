"use client";

import { useEffect, useRef, useState } from "react";
import type { IAgoraRTCRemoteUser, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { Participant } from "@ditch/types";

const W = 1280;
const H = 720;

// Returns cell rects for creator + up to 3 participants.
// Center-crops the source into each cell (cover, not contain).
function getLayout(participantCount: number): Array<{ x: number; y: number; w: number; h: number }> {
  if (participantCount === 0) {
    return [{ x: 0, y: 0, w: W, h: H }];
  }
  if (participantCount === 1) {
    return [
      { x: 0,   y: 0, w: W / 2, h: H },
      { x: W / 2, y: 0, w: W / 2, h: H },
    ];
  }
  if (participantCount === 2) {
    return [
      { x: 0,   y: 0,     w: W,     h: H / 2 }, // creator: full top row
      { x: 0,   y: H / 2, w: W / 2, h: H / 2 },
      { x: W / 2, y: H / 2, w: W / 2, h: H / 2 },
    ];
  }
  // 3 participants: 2×2 grid
  const CW = W / 2, CH = H / 2;
  return [
    { x: 0,  y: 0,  w: CW, h: CH },
    { x: CW, y: 0,  w: CW, h: CH },
    { x: 0,  y: CH, w: CW, h: CH },
    { x: CW, y: CH, w: CW, h: CH },
  ];
}

interface CompositorOptions {
  localVideoTrack: ILocalVideoTrack | null;
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  liveParticipants: Participant[];
  enabled: boolean;
}

export function useCompositor({
  localVideoTrack,
  localAudioTrack,
  remoteUsers,
  liveParticipants,
  enabled,
}: CompositorOptions): { stream: MediaStream | null } {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fpsRef = useRef({ frames: 0, lastLog: Date.now() });
  // Pool of hidden <video> elements keyed by MediaStreamTrack id
  const videoElemsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  // Track IDs already connected to the audio graph
  const connectedAudioRef = useRef<Set<string>>(new Set());
  // MediaStreamTrackGenerator writer — pushes VideoFrames directly, bypassing
  // captureStream's background-tab throttling. Falls back to captureStream if unsupported.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frameWriterRef = useRef<WritableStreamDefaultWriter<any> | null>(null);

  // Stand up canvas, AudioContext, and the composite MediaStream once when enabled
  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvasRef.current = canvas;

    const audioCtx = new AudioContext();
    const audioDest = audioCtx.createMediaStreamDestination();
    audioCtxRef.current = audioCtx;
    audioDestRef.current = audioDest;

    // Prefer MediaStreamTrackGenerator (Chrome 94+): we push VideoFrame objects
    // explicitly on each draw tick so the track always gets frames at full rate
    // regardless of tab visibility. captureStream() is throttled in background tabs.
    let videoTrack: MediaStreamTrack;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).MediaStreamTrackGenerator !== "undefined") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generator = new (window as any).MediaStreamTrackGenerator({ kind: "video" });
      frameWriterRef.current = generator.writable.getWriter();
      videoTrack = generator as MediaStreamTrack;
    } else {
      videoTrack = canvas.captureStream(30).getVideoTracks()[0];
    }

    const composite = new MediaStream([videoTrack, ...audioDest.stream.getAudioTracks()]);
    setStream(composite);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      frameWriterRef.current?.close().catch(() => {});
      frameWriterRef.current = null;
      audioCtx.close().catch(() => {});
      audioCtxRef.current = null;
      audioDestRef.current = null;
      connectedAudioRef.current.clear();
      videoElemsRef.current.forEach((el) => { el.srcObject = null; });
      videoElemsRef.current.clear();
      canvasRef.current = null;
      setStream(null);
    };
  }, [enabled]);

  // Draw loop — setInterval keeps firing even when the tab is in the background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (intervalRef.current) clearInterval(intervalRef.current);

    function getVideoElem(trackId: string, nativeTrack: MediaStreamTrack): HTMLVideoElement {
      let el = videoElemsRef.current.get(trackId);
      if (!el) {
        el = document.createElement("video");
        el.autoplay = true;
        el.muted = true;
        el.playsInline = true;
        el.srcObject = new MediaStream([nativeTrack]);
        el.play().catch(() => {});
        videoElemsRef.current.set(trackId, el);
      }
      return el;
    }

    // Center-crop helper: fills cell without letterboxing
    function drawCover(
      el: HTMLVideoElement,
      dx: number, dy: number, dw: number, dh: number
    ) {
      const vw = el.videoWidth || dw;
      const vh = el.videoHeight || dh;
      const scale = Math.max(dw / vw, dh / vh);
      const sw = dw / scale, sh = dh / scale;
      const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
      ctx!.drawImage(el, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    function draw() {
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, W, H);

      const layout = getLayout(liveParticipants.length);

      // Cell 0: creator camera
      if (localVideoTrack) {
        try {
          const native = localVideoTrack.getMediaStreamTrack();
          const el = getVideoElem(native.id, native);
          const { x, y, w, h } = layout[0];
          drawCover(el, x, y, w, h);
        } catch (_) {}
      }

      // Cells 1+: live participants by slot_index
      for (const p of liveParticipants) {
        const gridIdx = (p.slot_index ?? 0) + 1;
        if (gridIdx >= layout.length) continue;

        const uid = (p.slot_index ?? 0) + 1;
        const remoteUser = remoteUsers.find((u) => u.uid === uid);
        if (!remoteUser?.videoTrack) continue;

        try {
          const native = remoteUser.videoTrack.getMediaStreamTrack();
          const el = getVideoElem(native.id, native);
          const { x, y, w, h } = layout[gridIdx];
          drawCover(el, x, y, w, h);
        } catch (_) {}
      }

      // Push frame explicitly when using MediaStreamTrackGenerator
      if (frameWriterRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const frame = new (window as any).VideoFrame(canvas, {
          timestamp: performance.now() * 1000, // microseconds
        });
        frameWriterRef.current.write(frame).catch(() => {}).finally(() => frame.close());
      }

      // FPS counter — logs to console every 5 seconds
      const fps = fpsRef.current;
      fps.frames++;
      const now = Date.now();
      if (now - fps.lastLog >= 5000) {
        const measured = (fps.frames / ((now - fps.lastLog) / 1000)).toFixed(1);
        console.log(`[compositor] fps: ${measured}`);
        fps.frames = 0;
        fps.lastLog = now;
      }
    }

    intervalRef.current = setInterval(draw, 1000 / 30);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, localVideoTrack, remoteUsers, liveParticipants]);

  // Audio graph — connect new tracks to the AudioContext destination
  useEffect(() => {
    if (!enabled || !audioCtxRef.current || !audioDestRef.current) return;

    function connectIfNew(nativeTrack: MediaStreamTrack) {
      if (connectedAudioRef.current.has(nativeTrack.id)) return;
      try {
        const src = audioCtxRef.current!.createMediaStreamSource(
          new MediaStream([nativeTrack])
        );
        src.connect(audioDestRef.current!);
        connectedAudioRef.current.add(nativeTrack.id);
      } catch (_) {}
    }

    if (localAudioTrack) {
      try { connectIfNew(localAudioTrack.getMediaStreamTrack()); } catch (_) {}
    }

    for (const user of remoteUsers) {
      if (!user.audioTrack) continue;
      try { connectIfNew(user.audioTrack.getMediaStreamTrack()); } catch (_) {}
    }
  }, [enabled, localAudioTrack, remoteUsers]);

  return { stream };
}
