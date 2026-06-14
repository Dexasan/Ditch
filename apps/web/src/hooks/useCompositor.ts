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

// Inline worker source - drives the draw tick from a separate thread.
// Workers are not subject to the main thread's background-tab CPU budget throttling,
// so the timer fires reliably even when the streaming tab loses focus.
// Start message: { type: "start", interval: number } - interval in ms between ticks.
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
  /** Active camera layer - position, visibility, and transform come from here. */
  cameraLayer?: Layer | null;
  /** Image layers to composite on top of video (logos, overlays, etc.) */
  imageLayers?: Layer[];
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
  imageLayers = [],
  targetFps = DEFAULT_FPS,
  onFps,
}: CompositorOptions): {
  stream: MediaStream | null;
  setCamTransformLive: (patch: Partial<Layer["transform"]>) => void;
  setTrackGain: (sourceId: string, volume: number, muted: boolean) => void;
  getAnalyser: (sourceId: string) => AnalyserNode | null;
} {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const workerRef    = useRef<Worker | null>(null);
  const fpsRef       = useRef({ frames: 0, lastLog: Date.now() });
  // cameraLayer, imageLayers, remoteUsers, and liveParticipants live in refs so
  // Inspector updates and participant churn don't restart the worker (a restart
  // costs a frame gap). Synced from the props on each render via effects.
  const cameraLayerRef = useRef<Layer | null>(cameraLayer ?? null);
  const imageLayersRef = useRef<Layer[]>([]);
  const remoteUsersRef = useRef<IAgoraRTCRemoteUser[]>(remoteUsers);
  const liveParticipantsRef = useRef<Participant[]>(liveParticipants);
  useEffect(() => { cameraLayerRef.current = cameraLayer ?? null; }, [cameraLayer]);
  useEffect(() => { imageLayersRef.current = imageLayers.filter((l) => l.visible); }, [imageLayers]);
  useEffect(() => { remoteUsersRef.current = remoteUsers; }, [remoteUsers]);
  useEffect(() => { liveParticipantsRef.current = liveParticipants; }, [liveParticipants]);

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
  // keyed by sourceId ("mic" | "participant-N")
  const connectedAudioRef  = useRef<Set<string>>(new Set());
  const gainNodesRef       = useRef<Map<string, GainNode>>(new Map());
  const analyserNodesRef   = useRef<Map<string, AnalyserNode>>(new Map());
  const imageCacheRef      = useRef<Map<string, HTMLImageElement>>(new Map());
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
      // tab visibility - Chrome can't throttle what it doesn't schedule itself.
      const captureStream = canvas.captureStream(0);
      captureTrackRef.current = captureStream.getVideoTracks()[0];
      videoTrack = captureTrackRef.current;
    }

    setStream(new MediaStream([videoTrack, ...audioDest.stream.getAudioTracks()]));

    try { chromaKeyRef.current = new ChromaKeyProcessor(); } catch (err) {
      console.warn("[compositor] chroma key disabled:", err);
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
      gainNodesRef.current.clear();
      analyserNodesRef.current.clear();
      imageCacheRef.current.clear();
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

    // Only LOCAL tracks go through the Breakout Box. Remote (guest) tracks are
    // drawn from played <video> elements instead (see drawParticipants): a
    // MediaStreamTrackProcessor on an Agora remote track both fails to emit
    // frames reliably and locks the track away from the video element.
    const activeTracks = new Map<string, MediaStreamTrack>();
    if (localVideoTrack) {
      try { const t = localVideoTrack.getMediaStreamTrack(); activeTracks.set(t.id, t); } catch {}
    }
    if (localScreenTrack) {
      try { const t = localScreenTrack.getMediaStreamTrack(); activeTracks.set(t.id, t); } catch {}
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
  }, [enabled, localVideoTrack, localScreenTrack]);

  // ── Draw loop - driven by Worker timer ───────────────────────────────────────
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
      for (const p of liveParticipantsRef.current) {
        const gridIdx = (p.slot_index ?? 0) + 1;
        const cell = layout[gridIdx];
        if (!cell) continue;
        const uid = (p.slot_index ?? 0) + 1;
        const remoteUser = remoteUsersRef.current.find((u) => u.uid === uid);
        if (!remoteUser?.videoTrack) continue;
        try {
          const native = remoteUser.videoTrack.getMediaStreamTrack();
          // Remote (guest) tracks always render via a played <video> element, not
          // the Breakout Box: Agora remote tracks don't reliably emit frames
          // through MediaStreamTrackProcessor (they need a play() sink to drive
          // decoding), which left guest tiles black on the composite. The
          // creator's own local camera keeps the Breakout path (drawCreator).
          const source = getVideoElem(native.id, native);
          if (source) drawCover(source, cell.x, cell.y, cell.w, cell.h);
        } catch {}
      }
    }

    // Draws the creator camera into a given cell, honoring opacity + chroma key.
    // Used both for the free-positioned solo layout and the auto-grid slot 0.
    function drawCreator(cell: Rect) {
      if (!localVideoTrack) return;
      const camL = cameraLayerRef.current;
      try {
        const native = localVideoTrack.getMediaStreamTrack();
        const source = useBreakout ? frameCacheRef.current.get(native.id) : getVideoElem(native.id, native);
        if (!source) return;
        const ckCfg = (camL?.effects ?? [])
          .find((e) => (e as Record<string, unknown>)["type"] === "chromaKey" &&
                       (e as Record<string, unknown>)["enabled"]) as ChromaKeyConfig | undefined;
        ctx!.save();
        // layer.opacity is stored 0-100; globalAlpha expects 0-1
        ctx!.globalAlpha = (camL?.opacity ?? 100) / 100;
        try {
          if (ckCfg && chromaKeyRef.current) {
            const nw = (source.displayWidth ?? source.videoWidth) || W;
            const nh = (source.displayHeight ?? source.videoHeight) || H;
            const keyed = chromaKeyRef.current.process(source, nw, nh, ckCfg);
            const scale = Math.max(cell.w / nw, cell.h / nh);
            const sw = cell.w / scale, sh = cell.h / scale;
            const sx = (nw - sw) / 2, sy = (nh - sh) / 2;
            ctx!.drawImage(keyed, sx, sy, sw, sh, cell.x, cell.y, cell.w, cell.h);
          } else {
            drawCover(source, cell.x, cell.y, cell.w, cell.h);
          }
        } finally {
          ctx!.restore();
        }
      } catch {}
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
      const participantCount = liveParticipantsRef.current.length;

      if (participantCount === 0) {
        // Solo: the creator camera is positioned freely via its layer transform.
        const t = camL?.transform;
        if (camVisible && t && localVideoTrack) {
          drawCreator({ x: t.x, y: t.y, w: t.width, h: t.height });
        }
      } else {
        // Guests on stage: auto-tile creator + participants into one grid so a
        // single guest can no longer swallow the whole canvas. Creator = slot 0.
        const layout = getLayout(camVisible && !!localVideoTrack, participantCount);
        drawParticipants(layout);
        const creatorCell = layout[0];
        if (camVisible && creatorCell) drawCreator(creatorCell);
      }

      // Image layers (overlays: logos, lower-thirds, etc.) - drawn on top of video
      for (const layer of imageLayersRef.current) {
        const src = layer.sourceConfig.src as string | undefined;
        if (!src) continue;
        let img = imageCacheRef.current.get(layer.id);
        if (!img) {
          img = new Image();
          img.src = src;
          imageCacheRef.current.set(layer.id, img);
        }
        if (img.complete && img.naturalWidth > 0) {
          const { x, y, width, height } = layer.transform;
          ctx!.save();
          // layer.opacity is stored 0-100; globalAlpha expects 0-1
          ctx!.globalAlpha = layer.opacity / 100;
          ctx!.drawImage(img, x, y, width, height);
          ctx!.restore();
        }
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
  // remoteUsers/liveParticipants are read via refs inside draw() - listing them
  // here would restart the worker (and drop a frame) on every participant event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, targetFps, localVideoTrack, localScreenTrack]);

  // ── Audio graph ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !audioCtxRef.current || !audioDestRef.current) return;

    function ensureConnected(sourceId: string, nativeTrack: MediaStreamTrack) {
      if (connectedAudioRef.current.has(sourceId)) return;
      try {
        const ctx     = audioCtxRef.current!;
        const src     = ctx.createMediaStreamSource(new MediaStream([nativeTrack]));
        const gain    = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        gain.gain.value = 1.0;
        src.connect(gain);
        gain.connect(analyser);
        analyser.connect(audioDestRef.current!);
        gainNodesRef.current.set(sourceId, gain);
        analyserNodesRef.current.set(sourceId, analyser);
        connectedAudioRef.current.add(sourceId);
      } catch {}
    }

    if (localAudioTrack) {
      try { ensureConnected("mic", localAudioTrack.getMediaStreamTrack()); } catch {}
    }
    for (const user of remoteUsers) {
      if (!user.audioTrack) continue;
      // Agora UID = slot_index + 1, so slot_index = uid - 1
      const slotIndex = Number(user.uid) - 1;
      try { ensureConnected(`participant-${slotIndex}`, user.audioTrack.getMediaStreamTrack()); } catch {}
    }
  }, [enabled, localAudioTrack, remoteUsers]);

  function setCamTransformLive(patch: Partial<Layer["transform"]>) {
    if (!cameraLayerRef.current) return;
    cameraLayerRef.current = {
      ...cameraLayerRef.current,
      transform: { ...cameraLayerRef.current.transform, ...patch },
    };
  }

  function setTrackGain(sourceId: string, volume: number, muted: boolean) {
    const gn  = gainNodesRef.current.get(sourceId);
    const ctx = audioCtxRef.current;
    if (!gn || !ctx) return;
    // setTargetAtTime gives a 15ms click-free ramp instead of a hard jump
    gn.gain.setTargetAtTime(muted ? 0 : volume, ctx.currentTime, 0.015);
  }

  function getAnalyser(sourceId: string): AnalyserNode | null {
    return analyserNodesRef.current.get(sourceId) ?? null;
  }

  return { stream, setCamTransformLive, setTrackGain, getAnalyser };
}
