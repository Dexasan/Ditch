"use client";

import { useEffect, useRef, useState } from "react";
import type { IAgoraRTCRemoteUser, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { Participant } from "@ditch/types";
import type { Layer } from "@/lib/studio-store";
import { ChromaKeyProcessor, type ChromaKeyConfig } from "@/lib/chromaKey";

const W = 1280;
const H = 720;
const DEFAULT_FPS = 30;

export type Rect = { x: number; y: number; w: number; h: number };

// Returns an array where slot 0 = creator cell (null when hidden),
// slots 1..n = participant cells. Layout adapts to the total visible sources.
export function getLayout(creatorVisible: boolean, participantCount: number): Array<Rect | null> {
  const out: Array<Rect | null> = Array(participantCount + 1).fill(null);
  const total = (creatorVisible ? 1 : 0) + participantCount;

  if (total === 0) return out;

  if (total === 1) {
    const full = { x: 0, y: 0, w: W, h: H };
    if (creatorVisible) out[0] = full; else out[1] = full;
    return out;
  }

  if (total === 2) {
    const a = { x: 0,     y: 0, w: W / 2, h: H };
    const b = { x: W / 2, y: 0, w: W / 2, h: H };
    if (creatorVisible) { out[0] = a; out[1] = b; }
    else               { out[1] = a; out[2] = b; }
    return out;
  }

  if (total === 3) {
    const top  = { x: 0,     y: 0,     w: W,     h: H / 2 };
    const botL = { x: 0,     y: H / 2, w: W / 2, h: H / 2 };
    const botR = { x: W / 2, y: H / 2, w: W / 2, h: H / 2 };
    if (creatorVisible) { out[0] = top; out[1] = botL; out[2] = botR; }
    else               { out[1] = top; out[2] = botL; out[3] = botR; }
    return out;
  }

  // total >= 4: 2×2 grid
  const CW = W / 2, CH = H / 2;
  const cells: Rect[] = [
    { x: 0,  y: 0,  w: CW, h: CH },
    { x: CW, y: 0,  w: CW, h: CH },
    { x: 0,  y: CH, w: CW, h: CH },
    { x: CW, y: CH, w: CW, h: CH },
  ];
  if (creatorVisible) {
    out[0] = cells[0];
    for (let i = 0; i < Math.min(participantCount, 3); i++) out[i + 1] = cells[i + 1];
  } else {
    for (let i = 0; i < Math.min(participantCount, 4); i++) out[i + 1] = cells[i];
  }
  return out;
}

function supportsBreakoutBox(): boolean {
  return (
    typeof (window as any).MediaStreamTrackGenerator !== "undefined" &&   // eslint-disable-line @typescript-eslint/no-explicit-any
    typeof (window as any).MediaStreamTrackProcessor !== "undefined" &&   // eslint-disable-line @typescript-eslint/no-explicit-any
    typeof (window as any).VideoFrame !== "undefined"                      // eslint-disable-line @typescript-eslint/no-explicit-any
  );
}

// Inline worker source — drives the draw tick from a separate thread.
// Workers are not subject to the main thread's background-tab CPU budget throttling,
// so the timer fires reliably even when the streaming tab loses focus.
// Start message: { type: "start", interval: number } — interval in ms between ticks.
const WORKER_SRC = `
  let timer = null;
  self.onmessage = (e) => {
    if (e.data?.type === "start") timer = setInterval(() => self.postMessage("tick"), e.data.interval);
    if (e.data?.type === "stop")  { clearInterval(timer); timer = null; }
  };
`;

interface CompositorOptions {
  localVideoTrack: ILocalVideoTrack | null;
  localScreenTrack?: ILocalVideoTrack | null;
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  liveParticipants: Participant[];
  enabled: boolean;
  /** Active camera layer — position, visibility, and transform come from here. */
  cameraLayer?: Layer | null;
  targetFps?: 30 | 60;
  onFps?: (fps: number) => void;
}

export function useCompositor({
  localVideoTrack,
  localScreenTrack = null,
  localAudioTrack,
  remoteUsers,
  liveParticipants,
  enabled,
  cameraLayer = null,
  targetFps = DEFAULT_FPS,
  onFps,
}: CompositorOptions): { stream: MediaStream | null; setCamTransformLive: (patch: Partial<Layer["transform"]>) => void } {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const workerRef    = useRef<Worker | null>(null);
  const fpsRef       = useRef({ frames: 0, lastLog: Date.now() });
  // cameraLayer lives in a ref so Inspector transform updates don't restart the worker.
  // Synced from the prop on each render via effect.
  const cameraLayerRef = useRef<Layer | null>(cameraLayer ?? null);
  useEffect(() => { cameraLayerRef.current = cameraLayer ?? null; }, [cameraLayer]);

  const chromaKeyRef = useRef<ChromaKeyProcessor | null>(null);

  // Fallback path: CanvasCaptureMediaStreamTrack with manual requestFrame()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const captureTrackRef = useRef<any>(null);

  // Fallback path: hidden <video> elements keyed by track id
  const videoElemsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Breakout Box path: latest decoded VideoFrame per track id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frameCacheRef = useRef<Map<string, any>>(new Map());
  const processorCleanupsRef = useRef<Map<string, () => void>>(new Map());

  const audioCtxRef       = useRef<AudioContext | null>(null);
  const audioDestRef      = useRef<MediaStreamAudioDestinationNode | null>(null);
  const connectedAudioRef = useRef<Set<string>>(new Set());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frameWriterRef    = useRef<WritableStreamDefaultWriter<any> | null>(null);

  // ── Setup: canvas, AudioContext, composite stream ────────────────────────────
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

    const useBreakout = supportsBreakoutBox();
    console.log(`[compositor] breakout box available: ${useBreakout}`);

    let videoTrack: MediaStreamTrack;
    if (useBreakout) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generator = new (window as any).MediaStreamTrackGenerator({ kind: "video" });
      frameWriterRef.current = generator.writable.getWriter();
      videoTrack = generator as MediaStreamTrack;
    } else {
      // captureStream(0) = manual rate: Chrome only captures a frame when we call
      // requestFrame(), so we control exactly when captures happen regardless of
      // tab visibility — Chrome can't throttle what it doesn't schedule itself.
      const captureStream = canvas.captureStream(0);
      captureTrackRef.current = captureStream.getVideoTracks()[0];
      videoTrack = captureTrackRef.current;
    }

    setStream(new MediaStream([videoTrack, ...audioDest.stream.getAudioTracks()]));

    try { chromaKeyRef.current = new ChromaKeyProcessor(); } catch {
      console.warn("[compositor] WebGL unavailable — chroma key disabled");
    }

    // Resume AudioContext when tab regains focus (Chrome suspends it on hide)
    function onVisibility() {
      console.log(`[compositor] visibility: ${document.visibilityState}`);
      if (document.visibilityState === "visible" && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      workerRef.current?.postMessage({ type: "stop" });
      workerRef.current?.terminate();
      workerRef.current = null;
      frameWriterRef.current?.close().catch(() => {});
      frameWriterRef.current = null;
      captureTrackRef.current = null;
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
      chromaKeyRef.current?.dispose();
      chromaKeyRef.current = null;
      setStream(null);
    };
  }, [enabled]);

  // ── Breakout Box: one MediaStreamTrackProcessor per active video track ────────
  useEffect(() => {
    if (!enabled || !supportsBreakoutBox()) return;

    const activeTracks = new Map<string, MediaStreamTrack>();
    if (localVideoTrack) {
      try { const t = localVideoTrack.getMediaStreamTrack(); activeTracks.set(t.id, t); } catch {}
    }
    if (localScreenTrack) {
      try { const t = localScreenTrack.getMediaStreamTrack(); activeTracks.set(t.id, t); } catch {}
    }
    for (const p of liveParticipants) {
      const uid = (p.slot_index ?? 0) + 1;
      const ru = remoteUsers.find((u) => u.uid === uid);
      if (ru?.videoTrack) {
        try { const t = ru.videoTrack.getMediaStreamTrack(); activeTracks.set(t.id, t); } catch {}
      }
    }

    for (const [id, cleanup] of processorCleanupsRef.current) {
      if (!activeTracks.has(id)) {
        cleanup();
        processorCleanupsRef.current.delete(id);
        try { frameCacheRef.current.get(id)?.close(); } catch {}
        frameCacheRef.current.delete(id);
      }
    }

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
  }, [enabled, localVideoTrack, localScreenTrack, remoteUsers, liveParticipants]);

  // ── Draw loop — driven by Worker timer ───────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!enabled || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Terminate any previous worker before starting a new one
    workerRef.current?.postMessage({ type: "stop" });
    workerRef.current?.terminate();

    const useBreakout = supportsBreakoutBox();

    function getVideoElem(trackId: string, nativeTrack: MediaStreamTrack): HTMLVideoElement {
      let el = videoElemsRef.current.get(trackId);
      if (!el) {
        el = document.createElement("video");
        el.autoplay   = true;
        el.muted      = true;
        el.playsInline = true;
        el.srcObject  = new MediaStream([nativeTrack]);
        el.play().catch(() => {});
        videoElemsRef.current.set(trackId, el);
      }
      return el;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function drawCover(source: HTMLVideoElement | any, dx: number, dy: number, dw: number, dh: number) {
      const vw = (source.displayWidth ?? source.videoWidth) || dw;
      const vh = (source.displayHeight ?? source.videoHeight) || dh;
      const scale = Math.max(dw / vw, dh / vh);
      const sw = dw / scale, sh = dh / scale;
      const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
      ctx!.drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh);
    }

    function drawParticipants(layout: Array<Rect | null>) {
      for (const p of liveParticipants) {
        const gridIdx = (p.slot_index ?? 0) + 1;
        const cell = layout[gridIdx];
        if (!cell) continue;
        const uid = (p.slot_index ?? 0) + 1;
        const remoteUser = remoteUsers.find((u) => u.uid === uid);
        if (!remoteUser?.videoTrack) continue;
        try {
          const native = remoteUser.videoTrack.getMediaStreamTrack();
          const source = useBreakout ? frameCacheRef.current.get(native.id) : getVideoElem(native.id, native);
          if (source) drawCover(source, cell.x, cell.y, cell.w, cell.h);
        } catch {}
      }
    }

    function draw() {
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, W, H);

      // Screen share fills the canvas as a background layer when active
      if (localScreenTrack) {
        try {
          const native = localScreenTrack.getMediaStreamTrack();
          const source = useBreakout ? frameCacheRef.current.get(native.id) : getVideoElem(native.id, native);
          if (source) drawCover(source, 0, 0, W, H);
        } catch {}
      }

      const camL = cameraLayerRef.current;
      const camVisible = camL?.visible ?? false;
      const camTransform = camL?.transform ?? null;

      // Participants use auto-grid (camera position comes from its layer transform)
      drawParticipants(getLayout(false, liveParticipants.length));

      // Camera drawn at its layer transform position
      if (camVisible && camTransform && localVideoTrack) {
        try {
          const native = localVideoTrack.getMediaStreamTrack();
          const source = useBreakout ? frameCacheRef.current.get(native.id) : getVideoElem(native.id, native);
          if (source) {
            const ckCfg = (cameraLayerRef.current?.effects ?? [])
              .find((e) => (e as Record<string, unknown>)["type"] === "chromaKey" &&
                           (e as Record<string, unknown>)["enabled"]) as ChromaKeyConfig | undefined;
            if (ckCfg && chromaKeyRef.current) {
              const nw = (source.displayWidth ?? source.videoWidth) || W;
              const nh = (source.displayHeight ?? source.videoHeight) || H;
              const keyed  = chromaKeyRef.current.process(source, nw, nh, ckCfg);
              const { x: dx, y: dy, width: dw, height: dh } = camTransform;
              const scale  = Math.max(dw / nw, dh / nh);
              const sw = dw / scale, sh = dh / scale;
              const sx = (nw - sw) / 2, sy = (nh - sh) / 2;
              ctx!.drawImage(keyed, sx, sy, sw, sh, dx, dy, dw, dh);
            } else {
              drawCover(source, camTransform.x, camTransform.y, camTransform.width, camTransform.height);
            }
          }
        } catch {}
      }

      // Deliver the composite frame to the output track
      if (frameWriterRef.current) {
        // Breakout Box path: push VideoFrame explicitly
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const frame = new (window as any).VideoFrame(canvas, { timestamp: performance.now() * 1000 });
          frameWriterRef.current.write(frame).catch(() => {}).finally(() => { try { frame.close(); } catch {} });
        } catch {}
      } else {
        // Fallback path: signal captureStream to grab the current canvas state right now
        captureTrackRef.current?.requestFrame();
      }

      // FPS counter
      const fps = fpsRef.current;
      fps.frames++;
      const now = Date.now();
      if (now - fps.lastLog >= 5000) {
        const measured = fps.frames / ((now - fps.lastLog) / 1000);
        console.log(`[compositor] fps: ${measured.toFixed(1)} | tab: ${document.visibilityState}`);
        onFps?.(Math.round(measured));
        fps.frames = 0;
        fps.lastLog = now;
      }
    }

    // Spawn an inline Worker to drive the tick. Workers run in their own thread
    // and are not subject to the main thread's background-tab CPU budget, so the
    // 30fps timer fires reliably even when the tab is not in focus.
    const blob = new Blob([WORKER_SRC], { type: "application/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    const worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl); // safe to revoke after worker is created
    worker.onmessage = () => draw();
    worker.postMessage({ type: "start", interval: 1000 / targetFps });
    workerRef.current = worker;

    return () => {
      worker.postMessage({ type: "stop" });
      worker.terminate();
    };
  }, [enabled, targetFps, localVideoTrack, localScreenTrack, remoteUsers, liveParticipants]);

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

  function setCamTransformLive(patch: Partial<Layer["transform"]>) {
    if (!cameraLayerRef.current) return;
    cameraLayerRef.current = {
      ...cameraLayerRef.current,
      transform: { ...cameraLayerRef.current.transform, ...patch },
    };
  }

  return { stream, setCamTransformLive };
}
