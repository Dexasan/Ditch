"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IAgoraRTCRemoteUser, ILocalVideoTrack, ILocalAudioTrack } from "agora-rtc-sdk-ng";
import type { ChatMessage, Participant } from "@ditch/types";
import type { Layer } from "@/lib/studio-store";
import { ChromaKeyProcessor, type ChromaKeyConfig } from "@/lib/chromaKey";
import { layoutMarkdown, markdownCacheKey, type MdOp } from "@/lib/markdownCanvas";

// Platform accent colors for the canvas-native chat widget (mirrors the studio
// chat panel palette; canvas can't read CSS variables).
const CHAT_PLATFORM_COLOR: Record<string, string> = {
  twitch:  "#9146ff",
  youtube: "#ff0000",
  tiktok:  "#ff0050",
  kick:    "#53fc18",
  ditch:   "#FF1DB4",
};

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

// Splits text into lines that fit maxWidth using the context's current font.
// Explicit newlines are preserved; words that alone exceed maxWidth overflow.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (!para.trim()) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/\s+/)) {
      const trial = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(trial).width <= maxWidth) {
        line = trial;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

type Transform = Layer["transform"];

function enabledChromaKey(layer: Layer): ChromaKeyConfig | undefined {
  return (layer.effects ?? []).find(
    (e) => (e as Record<string, unknown>)["type"] === "chromaKey" &&
           (e as Record<string, unknown>)["enabled"],
  ) as ChromaKeyConfig | undefined;
}

interface CompositorOptions {
  localVideoTrack: ILocalVideoTrack | null;
  localScreenTrack?: ILocalVideoTrack | null;
  localAudioTrack: ILocalAudioTrack | null;
  /** Native microphone track used by the program mix. This can fall back to a
   * direct getUserMedia capture when the RTC room has not produced a mic yet. */
  programAudioTrack?: MediaStreamTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  liveParticipants: Participant[];
  enabled: boolean;
  /** Active scene layers, bottom -> top. Drawn in array order (z-order). */
  layers?: Layer[];
  /** Scene background color (canvas fill before layers). */
  bgColor?: string;
  /** Resolves media-file / extra-device video elements by layer id. */
  getExternalSource?: (layerId: string) => HTMLVideoElement | null;
  /** Extra audio sources (media files) to mix in. Ids are mixer source ids. */
  extraAudioTracks?: Array<{ id: string; track: MediaStreamTrack }>;
  /** Unified chat feed, drawn by "widget" layers (Live Chat overlay). */
  chatMessages?: ChatMessage[];
  targetFps?: 30 | 60;
  onFps?: (fps: number) => void;
}

export function useCompositor({
  localVideoTrack,
  localScreenTrack = null,
  localAudioTrack,
  programAudioTrack = null,
  remoteUsers,
  liveParticipants,
  enabled,
  layers = [],
  bgColor = "#000000",
  getExternalSource,
  extraAudioTracks = [],
  chatMessages = [],
  targetFps = DEFAULT_FPS,
  onFps,
}: CompositorOptions): {
  stream: MediaStream | null;
  setLayerTransformLive: (layerId: string, patch: Partial<Transform>) => void;
  setTrackGain: (sourceId: string, volume: number, muted: boolean) => void;
  getAnalyser: (sourceId: string) => AnalyserNode | null;
  resumeAudio: () => Promise<boolean>;
} {
  const [stream, setStream] = useState<MediaStream | null>(null);

  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const workerRef    = useRef<Worker | null>(null);
  const fpsRef       = useRef({ frames: 0, lastLog: Date.now() });
  // layers, remoteUsers, and liveParticipants live in refs so Inspector updates
  // and participant churn don't restart the worker (a restart costs a frame gap).
  // Synced from the props on each render via effects.
  const layersRef = useRef<Layer[]>([]);
  const bgColorRef = useRef(bgColor);
  const getExternalSourceRef = useRef(getExternalSource);
  const remoteUsersRef = useRef<IAgoraRTCRemoteUser[]>(remoteUsers);
  const liveParticipantsRef = useRef<Participant[]>(liveParticipants);
  // Transform overrides applied during a drag, before the store commit lands.
  const liveTransformsRef = useRef<Map<string, Partial<Transform>>>(new Map());
  // Wrapped-lines cache for text layers, invalidated when font/width/content change.
  const textCacheRef = useRef<Map<string, { key: string; lines: string[] }>>(new Map());
  // Laid-out markdown draw ops per layer, keyed by content + box size.
  const markdownOpsRef = useRef<Map<string, { key: string; ops: MdOp[] }>>(new Map());
  // Chat widget: wrapped-lines cache keyed by message id + layout config.
  const chatWrapCacheRef = useRef<Map<string, { lines: string[]; nameW: number }>>(new Map());
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);

  useEffect(() => {
    layersRef.current = layers;
    // A store commit supersedes any in-flight drag override.
    liveTransformsRef.current.clear();
    // Prune caches for layers that no longer exist.
    const ids = new Set(layers.map((l) => l.id));
    for (const id of [...textCacheRef.current.keys()])  if (!ids.has(id)) textCacheRef.current.delete(id);
    for (const id of [...imageCacheRef.current.keys()]) if (!ids.has(id)) imageCacheRef.current.delete(id);
    for (const id of [...markdownOpsRef.current.keys()]) if (!ids.has(id)) markdownOpsRef.current.delete(id);
  }, [layers]);
  useEffect(() => { bgColorRef.current = bgColor; }, [bgColor]);
  useEffect(() => { getExternalSourceRef.current = getExternalSource; }, [getExternalSource]);
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
  // keyed by sourceId ("mic" | "participant-N" | "media-<layerId>")
  const connectedAudioRef  = useRef<Set<string>>(new Set());
  const srcNodesRef        = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const connectedTrackIdRef = useRef<Map<string, string>>(new Map());
  const gainNodesRef       = useRef<Map<string, GainNode>>(new Map());
  const analyserNodesRef   = useRef<Map<string, AnalyserNode>>(new Map());
  // Re-render once graph nodes exist so VU meters receive their analysers immediately.
  const [, refreshAudioGraph] = useState(0);
  const imageCacheRef      = useRef<Map<string, HTMLImageElement>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const frameWriterRef    = useRef<WritableStreamDefaultWriter<any> | null>(null);

  const resumeAudio = useCallback(async () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return false;
    if (ctx.state !== "running") {
      try { await ctx.resume(); } catch { return false; }
    }
    return ctx.state === "running";
  }, []);

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

    // Browsers commonly create AudioContext in a suspended state after a route
    // navigation. Resume on the first studio interaction so the destination
    // track contains real samples before recording/publishing begins.
    function resumeAudioContext() {
      void resumeAudio();
    }
    resumeAudioContext();
    document.addEventListener("pointerdown", resumeAudioContext, true);
    document.addEventListener("keydown", resumeAudioContext, true);

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
      if (document.visibilityState === "visible") resumeAudioContext();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("pointerdown", resumeAudioContext, true);
      document.removeEventListener("keydown", resumeAudioContext, true);
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
      srcNodesRef.current.clear();
      connectedTrackIdRef.current.clear();
      gainNodesRef.current.clear();
      analyserNodesRef.current.clear();
      imageCacheRef.current.clear();
      textCacheRef.current.clear();
      markdownOpsRef.current.clear();
      chatWrapCacheRef.current.clear();
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

    // Resolves the drawable source for a LOCAL Agora track (camera / screen):
    // decoded VideoFrame on the Breakout path, played <video> element otherwise.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function localTrackSource(track: ILocalVideoTrack): any | null {
      try {
        const native = track.getMediaStreamTrack();
        return useBreakout ? frameCacheRef.current.get(native.id) : getVideoElem(native.id, native);
      } catch {
        return null;
      }
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

    // Merges the store transform with any in-flight drag override.
    function layerTransform(layer: Layer): Transform {
      const o = liveTransformsRef.current.get(layer.id);
      return o ? { ...layer.transform, ...o } : layer.transform;
    }

    // Applies opacity + rotation for a layer, runs fn, restores the context.
    function withLayerCtx(layer: Layer, t: Transform, fn: () => void) {
      ctx!.save();
      // layer.opacity is stored 0-100; globalAlpha expects 0-1
      ctx!.globalAlpha = Math.max(0, Math.min(1, layer.opacity / 100));
      if (t.rotation) {
        const cx = t.x + t.width / 2, cy = t.y + t.height / 2;
        ctx!.translate(cx, cy);
        ctx!.rotate((t.rotation * Math.PI) / 180);
        ctx!.translate(-cx, -cy);
      }
      try { fn(); } finally { ctx!.restore(); }
    }

    // Draws a video-ish source (VideoFrame, <video>, or canvas) cover-fit into a
    // cell, running it through the chroma key shader when the layer asks for it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function drawVideoSource(source: any, layer: Layer, cell: Rect) {
      const ckCfg = enabledChromaKey(layer);
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
          // creator's own local camera keeps the Breakout path.
          const source = getVideoElem(native.id, native);
          if (source) drawCover(source, cell.x, cell.y, cell.w, cell.h);
        } catch {}
      }
    }

    // Resolves the drawable source for a camera layer: the primary layer (no
    // deviceId) uses the published Agora track; extra-device layers use the raw
    // getUserMedia element managed by useMediaSources.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function cameraSource(layer: Layer): any | null {
      if (layer.sourceConfig["deviceId"]) {
        const el = getExternalSourceRef.current?.(layer.id);
        return el && el.readyState >= 2 && el.videoWidth > 0 ? el : null;
      }
      return localVideoTrack ? localTrackSource(localVideoTrack) : null;
    }

    function drawImageLayer(layer: Layer, t: Transform) {
      const src = layer.sourceConfig["src"] as string | undefined;
      if (!src) return;
      let img = imageCacheRef.current.get(layer.id);
      if (!img || img.src !== src) {
        img = new Image();
        img.src = src;
        imageCacheRef.current.set(layer.id, img);
      }
      if (img.complete && img.naturalWidth > 0) {
        ctx!.drawImage(img, t.x, t.y, t.width, t.height);
      }
    }

    function drawTextLayer(layer: Layer, t: Transform) {
      const cfg = layer.sourceConfig;
      const content = (cfg["content"] as string) ?? "";
      if (!content) return;
      const fontSize = Number(cfg["fontSizePx"]) || 48;
      const family   = (cfg["fontFamily"] as string) || "Arial";
      const weight   = (cfg["weight"] as string) || "700";
      const align    = (cfg["align"] as CanvasTextAlign) || "left";
      const font     = `${weight} ${fontSize}px "${family}", sans-serif`;
      ctx!.font = font; // must be set before measuring
      const key = `${font}|${Math.round(t.width)}|${align}|${content}`;
      let entry = textCacheRef.current.get(layer.id);
      if (!entry || entry.key !== key) {
        entry = { key, lines: wrapText(ctx!, content, t.width) };
        textCacheRef.current.set(layer.id, entry);
      }
      ctx!.fillStyle = (cfg["color"] as string) || "#FFFFFF";
      ctx!.textAlign = align;
      ctx!.textBaseline = "top";
      if (cfg["shadow"]) {
        ctx!.shadowColor = "rgba(0,0,0,0.8)";
        ctx!.shadowBlur = 8;
        ctx!.shadowOffsetY = 2;
      }
      const tx = align === "center" ? t.x + t.width / 2 : align === "right" ? t.x + t.width : t.x;
      const lineH = fontSize * 1.25;
      let y = t.y;
      for (const line of entry.lines) {
        if (y > t.y + t.height - fontSize) break; // clip to the layer box
        if (line) ctx!.fillText(line, tx, y);
        y += lineH;
      }
    }

    function drawShapeLayer(layer: Layer, t: Transform) {
      const cfg = layer.sourceConfig;
      const radius = Math.max(0, Math.min(Number(cfg["cornerRadius"]) || 0, t.width / 2, t.height / 2));
      const borderWidth = Number(cfg["borderWidth"]) || 0;
      ctx!.beginPath();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (ctx as any).roundRect === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (ctx as any).roundRect(t.x, t.y, t.width, t.height, radius);
      } else {
        ctx!.rect(t.x, t.y, t.width, t.height);
      }
      ctx!.fillStyle = (cfg["fill"] as string) || "#FF1DB4";
      ctx!.fill();
      if (borderWidth > 0) {
        ctx!.lineWidth = borderWidth;
        ctx!.strokeStyle = (cfg["borderColor"] as string) || "#FFFFFF";
        ctx!.stroke();
      }
    }

    // Media files AND browser tab captures both draw from an external <video>
    // element managed by useMediaSources.
    function drawExternalVideoLayer(layer: Layer, t: Transform) {
      const el = getExternalSourceRef.current?.(layer.id);
      if (!el || el.readyState < 2 || el.videoWidth === 0) return;
      drawVideoSource(el, layer, { x: t.x, y: t.y, w: t.width, h: t.height });
    }

    function drawMarkdownLayer(layer: Layer, t: Transform) {
      const cfg = layer.sourceConfig;
      if (cfg["bg"]) {
        ctx!.beginPath();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (ctx as any).roundRect === "function") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ctx as any).roundRect(t.x, t.y, t.width, t.height, 12);
        } else {
          ctx!.rect(t.x, t.y, t.width, t.height);
        }
        ctx!.fillStyle = "rgba(10,10,26,0.82)";
        ctx!.fill();
      }
      const key = markdownCacheKey(cfg, t.width, t.height);
      let entry = markdownOpsRef.current.get(layer.id);
      if (!entry || entry.key !== key) {
        entry = {
          key,
          ops: layoutMarkdown(ctx!, (cfg["markdown"] as string) ?? "", t.width, t.height, {
            fontSizePx: Number(cfg["fontSizePx"]) || 24,
            color: (cfg["color"] as string) || "#FFFFFF",
            bg: !!cfg["bg"],
          }),
        };
        markdownOpsRef.current.set(layer.id, entry);
      }
      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      for (const op of entry.ops) {
        if (op.op === "rect") {
          ctx!.fillStyle = op.fill;
          ctx!.fillRect(t.x + op.x, t.y + op.y, op.w, op.h);
        } else {
          ctx!.font = op.font;
          ctx!.fillStyle = op.fill;
          ctx!.fillText(op.text, t.x + op.x, t.y + op.y);
        }
      }
    }

    // Wraps "name  body" where the first line starts after the colored name.
    function wrapChatMessage(name: string, body: string, maxW: number, cacheKey: string) {
      const cached = chatWrapCacheRef.current.get(cacheKey);
      if (cached) return cached;
      const nameW = ctx!.measureText(`${name}  `).width;
      const lines: string[] = [];
      let line = "";
      let avail = Math.max(40, maxW - nameW);
      for (const word of body.split(/\s+/)) {
        const trial = line ? `${line} ${word}` : word;
        if (!line || ctx!.measureText(trial).width <= avail) {
          line = trial;
        } else {
          lines.push(line);
          line = word;
          avail = maxW;
        }
      }
      lines.push(line);
      const entry = { lines, nameW };
      chatWrapCacheRef.current.set(cacheKey, entry);
      // Bounded cache: old messages scroll out, drop the oldest entries
      if (chatWrapCacheRef.current.size > 300) {
        const first = chatWrapCacheRef.current.keys().next().value;
        if (first) chatWrapCacheRef.current.delete(first);
      }
      return entry;
    }

    // Live Chat widget: renders the unified cross-platform feed, newest at the
    // bottom, filling the layer box upward until it runs out of room.
    function drawWidgetLayer(layer: Layer, t: Transform) {
      const cfg = layer.sourceConfig;
      if (((cfg["widget"] as string) ?? "chat") !== "chat") return;

      const fontSize = Number(cfg["fontSizePx"]) || 20;
      const lineH = Math.round(fontSize * 1.35);
      const pad = Math.round(fontSize * 0.7);
      const maxMessages = Number(cfg["maxMessages"]) || 8;

      // Backdrop opacity is independent of layer opacity: 0 = no box at all,
      // text stays fully crisp. (Legacy bg:false configs mean 0 too.)
      const bgOpacity = cfg["bgOpacity"] !== undefined
        ? Math.max(0, Math.min(100, Number(cfg["bgOpacity"])))
        : (cfg["bg"] === false ? 0 : 55);
      if (bgOpacity > 0) {
        ctx!.beginPath();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (ctx as any).roundRect === "function") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (ctx as any).roundRect(t.x, t.y, t.width, t.height, 12);
        } else {
          ctx!.rect(t.x, t.y, t.width, t.height);
        }
        ctx!.fillStyle = `rgba(10,10,26,${(bgOpacity / 100).toFixed(2)})`;
        ctx!.fill();
      }

      ctx!.font = `600 ${fontSize}px Arial, sans-serif`;
      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      // Soft shadow keeps the text readable straight over video when the
      // backdrop is transparent.
      ctx!.shadowColor = "rgba(0,0,0,0.85)";
      ctx!.shadowBlur = 4;
      ctx!.shadowOffsetY = 1;
      const maxW = t.width - pad * 2;
      const msgs = chatMessagesRef.current.slice(-maxMessages);
      let bottom = t.y + t.height - pad;

      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        const name = m.author_display_name ?? "viewer";
        const { lines, nameW } = wrapChatMessage(
          name, m.body ?? "", maxW, `${layer.id}|${m.id}|${fontSize}|${Math.round(maxW)}`,
        );
        const blockH = lines.length * lineH + Math.round(lineH * 0.25);
        const top = bottom - blockH;
        if (top < t.y + pad) break;

        ctx!.fillStyle = CHAT_PLATFORM_COLOR[m.platform] ?? "#9aa0b4";
        ctx!.fillText(name, t.x + pad, top);
        ctx!.fillStyle = "#FFFFFF";
        for (let li = 0; li < lines.length; li++) {
          const lx = t.x + pad + (li === 0 ? nameW : 0);
          ctx!.fillText(lines[li], lx, top + li * lineH);
        }
        bottom = top;
      }
    }

    function draw() {
      ctx!.fillStyle = bgColorRef.current || "#000";
      ctx!.fillRect(0, 0, W, H);

      const layers = layersRef.current;
      const participantCount = liveParticipantsRef.current.length;

      // Legacy path (LiveRoom passes no layers at all): auto-grid the guests.
      // The studio never hits this - guests are real "participant" layers there,
      // resizable and movable like everything else.
      if (layers.length === 0 && participantCount > 0) {
        drawParticipants(getLayout(false, participantCount));
      }

      for (const layer of layers) {
        const t = layerTransform(layer);
        if (!layer.visible || layer.sourceUnavailable) continue;

        switch (layer.type) {
          case "participant": {
            // Resolve the slot from the LIVE participant record - the slot can
            // be assigned or changed after the layer was created.
            const pid = layer.sourceConfig["participantId"] as string | undefined;
            const liveP = pid ? liveParticipantsRef.current.find((p) => p.id === pid) : undefined;
            const slotIndex = liveP?.slot_index ?? (Number(layer.sourceConfig["slotIndex"]) || 0);
            const remoteUser = remoteUsersRef.current.find((u) => u.uid === slotIndex + 1);
            if (!remoteUser?.videoTrack) break;
            try {
              const native = remoteUser.videoTrack.getMediaStreamTrack();
              // Guest tracks render via a played <video> element (see the note
              // in drawParticipants about the Breakout Box and remote tracks).
              const source = getVideoElem(native.id, native);
              if (source) {
                withLayerCtx(layer, t, () =>
                  drawVideoSource(source, layer, { x: t.x, y: t.y, w: t.width, h: t.height }));
              }
            } catch {}
            break;
          }
          case "camera": {
            const source = cameraSource(layer);
            if (source) {
              withLayerCtx(layer, t, () =>
                drawVideoSource(source, layer, { x: t.x, y: t.y, w: t.width, h: t.height }));
            }
            break;
          }
          case "screenshare": {
            if (!localScreenTrack) break;
            const source = localTrackSource(localScreenTrack);
            if (source) {
              withLayerCtx(layer, t, () =>
                drawVideoSource(source, layer, { x: t.x, y: t.y, w: t.width, h: t.height }));
            }
            break;
          }
          case "media":
          case "browser":  withLayerCtx(layer, t, () => drawExternalVideoLayer(layer, t)); break;
          case "image":    withLayerCtx(layer, t, () => drawImageLayer(layer, t));    break;
          case "text":     withLayerCtx(layer, t, () => drawTextLayer(layer, t));     break;
          case "shape":    withLayerCtx(layer, t, () => drawShapeLayer(layer, t));    break;
          case "markdown": withLayerCtx(layer, t, () => drawMarkdownLayer(layer, t)); break;
          case "widget":   withLayerCtx(layer, t, () => drawWidgetLayer(layer, t));   break;
          default: break;
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
  // remoteUsers/liveParticipants/layers are read via refs inside draw() - listing
  // them here would restart the worker (and drop a frame) on every event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, targetFps, localVideoTrack, localScreenTrack]);

  // ── Audio graph ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !audioCtxRef.current || !audioDestRef.current) return;

    function disconnectSource(sourceId: string) {
      try { srcNodesRef.current.get(sourceId)?.disconnect(); } catch {}
      try { gainNodesRef.current.get(sourceId)?.disconnect(); } catch {}
      try { analyserNodesRef.current.get(sourceId)?.disconnect(); } catch {}
      srcNodesRef.current.delete(sourceId);
      gainNodesRef.current.delete(sourceId);
      analyserNodesRef.current.delete(sourceId);
      connectedAudioRef.current.delete(sourceId);
      connectedTrackIdRef.current.delete(sourceId);
    }

    function ensureConnected(sourceId: string, nativeTrack: MediaStreamTrack) {
      // Re-wire if the same source id now carries a different track
      // (e.g. a media layer re-selected a new file).
      if (connectedAudioRef.current.has(sourceId)) {
        if (connectedTrackIdRef.current.get(sourceId) === nativeTrack.id) return;
        disconnectSource(sourceId);
      }
      try {
        const ctx     = audioCtxRef.current!;
        if (ctx.state !== "running") ctx.resume().catch(() => {});
        const src     = ctx.createMediaStreamSource(new MediaStream([nativeTrack]));
        const gain    = ctx.createGain();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;
        gain.gain.value = 1.0;
        src.connect(gain);
        gain.connect(analyser);
        analyser.connect(audioDestRef.current!);
        srcNodesRef.current.set(sourceId, src);
        gainNodesRef.current.set(sourceId, gain);
        analyserNodesRef.current.set(sourceId, analyser);
        connectedAudioRef.current.add(sourceId);
        connectedTrackIdRef.current.set(sourceId, nativeTrack.id);
      } catch {}
    }

    const microphoneTrack = programAudioTrack ?? localAudioTrack?.getMediaStreamTrack() ?? null;
    if (microphoneTrack) {
      try { ensureConnected("mic", microphoneTrack); } catch {}
    }
    for (const user of remoteUsers) {
      if (!user.audioTrack) continue;
      // Only guest slots (uid 1..8) feed the mix. Reserved creator UIDs stay
      // out - mixing the composite feed (997) back in would be a feedback loop.
      const uid = Number(user.uid);
      if (!(uid >= 1 && uid <= 8)) continue;
      // Agora UID = slot_index + 1, so slot_index = uid - 1
      const slotIndex = uid - 1;
      try { ensureConnected(`participant-${slotIndex}`, user.audioTrack.getMediaStreamTrack()); } catch {}
    }
    for (const { id, track } of extraAudioTracks) {
      ensureConnected(id, track);
    }
    // Drop graph nodes for media sources whose layer or file went away.
    for (const id of [...connectedAudioRef.current]) {
      if (!id.startsWith("media-")) continue;
      if (extraAudioTracks.some((t) => t.id === id)) continue;
      disconnectSource(id);
    }
    refreshAudioGraph((version) => version + 1);
  }, [enabled, localAudioTrack, programAudioTrack, remoteUsers, extraAudioTracks]);

  function setLayerTransformLive(layerId: string, patch: Partial<Transform>) {
    const cur = liveTransformsRef.current.get(layerId);
    liveTransformsRef.current.set(layerId, cur ? { ...cur, ...patch } : { ...patch });
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

  return { stream, setLayerTransformLive, setTrackGain, getAnalyser, resumeAudio };
}
