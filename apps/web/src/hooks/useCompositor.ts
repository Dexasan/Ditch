"use client";

import { useEffect, useRef, useState } from "react";
import type { IAgoraRTCRemoteUser, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { Participant } from "@ditch/types";

const W = 1280;
const H = 720;

function getLayout(participantCount: number): Array<{ x: number; y: number; w: number; h: number }> {
  if (participantCount === 0) return [{ x: 0, y: 0, w: W, h: H }];
  if (participantCount === 1) return [
    { x: 0,     y: 0, w: W / 2, h: H },
    { x: W / 2, y: 0, w: W / 2, h: H },
  ];
  if (participantCount === 2) return [
    { x: 0,     y: 0,     w: W,     h: H / 2 },
    { x: 0,     y: H / 2, w: W / 2, h: H / 2 },
    { x: W / 2, y: H / 2, w: W / 2, h: H / 2 },
  ];
  const CW = W / 2, CH = H / 2;
  return [
    { x: 0,  y: 0,  w: CW, h: CH },
    { x: CW, y: 0,  w: CW, h: CH },
    { x: 0,  y: CH, w: CW, h: CH },
    { x: CW, y: CH, w: CW, h: CH },
  ];
}

// Breakout Box APIs (Chrome 94+): MediaStreamTrackProcessor reads raw VideoFrames
// from the decode pipeline directly — not from the rendering pipeline, which Chrome
// throttles in background tabs. MediaStreamTrackGenerator pushes frames explicitly
// into a track without going through captureStream, which is also throttled.
function supportsBreakoutBox(): boolean {
  return (
    typeof (window as any).MediaStreamTrackGenerator !== "undefined" &&   // eslint-disable-line @typescript-eslint/no-explicit-any
    typeof (window as any).MediaStreamTrackProcessor !== "undefined" &&   // eslint-disable-line @typescript-eslint/no-explicit-any
    typeof (window as any).VideoFrame !== "undefined"                      // eslint-disable-line @typescript-eslint/no-explicit-any
  );
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

  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const fpsRef       = useRef({ frames: 0, lastLog: Date.now() });

  // Fallback (non-Breakout-Box): hidden <video> elements keyed by track id
  const videoElemsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Breakout Box: latest decoded VideoFrame per track id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frameCacheRef = useRef<Map<string, any>>(new Map());
  // Breakout Box: cancellation fn per active processor
  const processorCleanupsRef = useRef<Map<string, () => void>>(new Map());

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const connectedAudioRef = useRef<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frameWriterRef = useRef<WritableStreamDefaultWriter<any> | null>(null);

  // ── Setup: canvas, AudioContext, composite MediaStream ───────────────────────
  useEffect(() => {
    if (!enabled) return;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvasRef.current = canvas;

    const audioCtx  = new AudioContext();
    const audioDest = audioCtx.createMediaStreamDestination();
    audioCtxRef.current  = audioCtx;
    audioDestRef.current = audioDest;

    let videoTrack: MediaStreamTrack;
    if (supportsBreakoutBox()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generator = new (window as any).MediaStreamTrackGenerator({ kind: "video" });
      frameWriterRef.current = generator.writable.getWriter();
      videoTrack = generator as MediaStreamTrack;
    } else {
      // captureStream fallback — will throttle in background tabs
      videoTrack = canvas.captureStream(30).getVideoTracks()[0];
    }

    setStream(new MediaStream([videoTrack, ...audioDest.stream.getAudioTracks()]));

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      frameWriterRef.current?.close().catch(() => {});
      frameWriterRef.current = null;
      audioCtx.close().catch(() => {});
      audioCtxRef.current  = null;
      audioDestRef.current = null;
      connectedAudioRef.current.clear();
      videoElemsRef.current.forEach((el) => { el.srcObject = null; });
      videoElemsRef.current.clear();
      processorCleanupsRef.current.forEach((fn) => fn());
      processorCleanupsRef.current.clear();
      frameCacheRef.current.forEach((f) => { try { f.close(); } catch {} });
      frameCacheRef.current.clear();
      canvasRef.current = null;
      setStream(null);
    };
  }, [enabled]);

  // ── Breakout Box: manage one MediaStreamTrackProcessor per active video track ─
  // Each processor runs a read loop that caches the latest decoded VideoFrame.
  // The decode pipeline is not throttled in background tabs — only rendering is.
  useEffect(() => {
    if (!enabled || !supportsBreakoutBox()) return;

    // Collect all currently active video tracks
    const activeTracks = new Map<string, MediaStreamTrack>();
    if (localVideoTrack) {
      try { const t = localVideoTrack.getMediaStreamTrack(); activeTracks.set(t.id, t); } catch {}
    }
    for (const p of liveParticipants) {
      const uid = (p.slot_index ?? 0) + 1;
      const ru = remoteUsers.find((u) => u.uid === uid);
      if (ru?.videoTrack) {
        try { const t = ru.videoTrack.getMediaStreamTrack(); activeTracks.set(t.id, t); } catch {}
      }
    }

    // Stop processors for tracks that are no longer active
    for (const [id, cleanup] of processorCleanupsRef.current) {
      if (!activeTracks.has(id)) {
        cleanup();
        processorCleanupsRef.current.delete(id);
        try { frameCacheRef.current.get(id)?.close(); } catch {}
        frameCacheRef.current.delete(id);
      }
    }

    // Start a processor for each new track
    for (const [id, track] of activeTracks) {
      if (processorCleanupsRef.current.has(id)) continue;

      let cancelled = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processor = new (window as any).MediaStreamTrackProcessor({ track });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const reader: ReadableStreamDefaultReader<any> = processor.readable.getReader();

      (async () => {
        while (!cancelled) {
          try {
            const { done, value: frame } = await reader.read();
            if (done || cancelled) { try { frame?.close(); } catch {} break; }
            // Replace the cached frame atomically (JS is single-threaded)
            try { frameCacheRef.current.get(id)?.close(); } catch {}
            frameCacheRef.current.set(id, frame);
          } catch { break; }
        }
      })();

      processorCleanupsRef.current.set(id, () => {
        cancelled = true;
        reader.cancel().catch(() => {});
      });
    }
  }, [enabled, localVideoTrack, remoteUsers, liveParticipants]);

  // ── Draw loop ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (intervalRef.current) clearInterval(intervalRef.current);

    const useBreakout = supportsBreakoutBox();

    function getVideoElem(trackId: string, nativeTrack: MediaStreamTrack): HTMLVideoElement {
      let el = videoElemsRef.current.get(trackId);
      if (!el) {
        el = document.createElement("video");
        el.autoplay  = true;
        el.muted     = true;
        el.playsInline = true;
        el.srcObject = new MediaStream([nativeTrack]);
        el.play().catch(() => {});
        videoElemsRef.current.set(trackId, el);
      }
      return el;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function drawCover(source: HTMLVideoElement | any, dx: number, dy: number, dw: number, dh: number) {
      // VideoFrame uses displayWidth/displayHeight; HTMLVideoElement uses videoWidth/videoHeight
      const vw = (source.displayWidth ?? source.videoWidth) || dw;
      const vh = (source.displayHeight ?? source.videoHeight) || dh;
      const scale = Math.max(dw / vw, dh / vh);
      const sw = dw / scale, sh = dh / scale;
      const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
      ctx!.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    function draw() {
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, W, H);

      const layout = getLayout(liveParticipants.length);

      // Cell 0: creator camera
      if (localVideoTrack) {
        try {
          const native = localVideoTrack.getMediaStreamTrack();
          const source = useBreakout ? frameCacheRef.current.get(native.id) : getVideoElem(native.id, native);
          if (source) {
            const { x, y, w, h } = layout[0];
            drawCover(source, x, y, w, h);
          }
        } catch {}
      }

      // Cells 1+: live participants
      for (const p of liveParticipants) {
        const gridIdx = (p.slot_index ?? 0) + 1;
        if (gridIdx >= layout.length) continue;
        const uid = (p.slot_index ?? 0) + 1;
        const remoteUser = remoteUsers.find((u) => u.uid === uid);
        if (!remoteUser?.videoTrack) continue;
        try {
          const native = remoteUser.videoTrack.getMediaStreamTrack();
          const source = useBreakout ? frameCacheRef.current.get(native.id) : getVideoElem(native.id, native);
          if (source) {
            const { x, y, w, h } = layout[gridIdx];
            drawCover(source, x, y, w, h);
          }
        } catch {}
      }

      // Push composite frame explicitly — not throttled unlike captureStream
      if (frameWriterRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const frame = new (window as any).VideoFrame(canvas, { timestamp: performance.now() * 1000 });
          frameWriterRef.current.write(frame).catch(() => {}).finally(() => { try { frame.close(); } catch {} });
        } catch {}
      }

      // FPS counter — logs every 5 seconds so you can confirm 30fps in background
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [enabled, localVideoTrack, remoteUsers, liveParticipants]);

  // ── Audio graph ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !audioCtxRef.current || !audioDestRef.current) return;

    function connectIfNew(nativeTrack: MediaStreamTrack) {
      if (connectedAudioRef.current.has(nativeTrack.id)) return;
      try {
        const src = audioCtxRef.current!.createMediaStreamSource(new MediaStream([nativeTrack]));
        src.connect(audioDestRef.current!);
        connectedAudioRef.current.add(nativeTrack.id);
      } catch {}
    }

    if (localAudioTrack) {
      try { connectIfNew(localAudioTrack.getMediaStreamTrack()); } catch {}
    }
    for (const user of remoteUsers) {
      if (!user.audioTrack) continue;
      try { connectIfNew(user.audioTrack.getMediaStreamTrack()); } catch {}
    }
  }, [enabled, localAudioTrack, remoteUsers]);

  return { stream };
}
