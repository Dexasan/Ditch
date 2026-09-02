"use client";

import { useEffect, useRef, useState } from "react";
import type { EncoderPreset, OutputResolution } from "@/lib/studio-store";
import {
  canUseWebCodecsRelay,
  startWebCodecsEncoder,
  type WebCodecsEncoderController,
} from "@/lib/webcodecsRelay";

// Guaranteed key frame cadence for the WebCodecs path (matches the relay's 2s
// forced GOP and YouTube/Twitch's <=2s requirement).
const KEY_FRAME_INTERVAL_SEC = 2;

function resolutionDims(res: OutputResolution): { width: number; height: number } {
  return res === "1080p" ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}

const CHUNK_INTERVAL_MS = 250;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;
// Restart instead of allowing encoded video to accumulate indefinitely when
// the relay or network stops draining the WebSocket send queue.
const MAX_SOCKET_BUFFER_BYTES = 4 * 1024 * 1024;
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

const DEFAULT_VIDEO_KBPS = 3000;
const DEFAULT_AUDIO_KBPS = 192;

interface RelayStreamOptions {
  stream: MediaStream | null;
  sessionId: string;
  token: string;
  enabled: boolean;
  onBitrate?: (kbps: number) => void;
  // Encoder settings are read at (re)connect time, not reactively: changing
  // them mid-stream must not restart the recorder. They apply on next start.
  videoBitrateKbps?: number;
  audioBitrateKbps?: number;
  encoderPreset?: EncoderPreset;
  fps?: number;
  outputResolution?: OutputResolution;
}

export interface RelayStreamState {
  streaming: boolean;
  error: string | null;
  diagnostics: RelayStreamDiagnostics | null;
}

export interface RelayStartTimings {
  auth_ms: number;
  database_ms: number;
  hls_setup_ms: number;
  ffmpeg_spawn_ms: number;
  total_ms: number;
}

export interface RelayStreamDiagnostics {
  connection_id: number;
  reconnect_attempt: number;
  socket_open_ms: number | null;
  relay_started_ms: number | null;
  first_browser_chunk_ms: number | null;
  first_relay_media_ms: number | null;
  peak_socket_buffer_bytes: number;
  relay: RelayStartTimings | null;
}

export function useRelayStream({
  stream,
  sessionId,
  token,
  enabled,
  onBitrate,
  videoBitrateKbps,
  audioBitrateKbps,
  encoderPreset,
  fps,
  outputResolution,
}: RelayStreamOptions): RelayStreamState {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<RelayStreamDiagnostics | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  // Either a MediaRecorder wrapper or the WebCodecs encoder controller. Teardown
  // stops whichever sink is live without caring which encode path produced it.
  const activeSinkRef = useRef<{ stop: () => void } | null>(null);
  const bytesSentRef = useRef(0);
  const bitrateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable ref so the interval closure never captures a stale callback
  const onBitrateRef = useRef(onBitrate);
  onBitrateRef.current = onBitrate;
  // Ref (not effect dep) so settings changes don't tear down a live stream
  const encoderRef = useRef({
    videoBitrateKbps: DEFAULT_VIDEO_KBPS,
    audioBitrateKbps: DEFAULT_AUDIO_KBPS,
    encoderPreset: "balanced" as EncoderPreset,
    fps: 30,
    outputResolution: "720p" as OutputResolution,
  });
  encoderRef.current = {
    videoBitrateKbps: videoBitrateKbps ?? DEFAULT_VIDEO_KBPS,
    audioBitrateKbps: audioBitrateKbps ?? DEFAULT_AUDIO_KBPS,
    encoderPreset: encoderPreset ?? "balanced",
    fps: fps ?? 30,
    outputResolution: outputResolution ?? "720p",
  };

  useEffect(() => {
    if (!enabled || !stream) return;

    let relayUrl = process.env.NEXT_PUBLIC_RELAY_URL ?? "ws://localhost:3003";
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let connectionSequence = 0;

    // WebCodecs capability is probed once (stable across reconnects). A runtime
    // WebCodecs failure latches `webCodecsDisabled` so the rest of the session
    // transparently re-establishes on MediaRecorder.
    let webCodecsChecked = false;
    let webCodecsCapable = false;
    let webCodecsDisabled = false;

    function stopSink() {
      if (bitrateTimerRef.current) {
        clearInterval(bitrateTimerRef.current);
        bitrateTimerRef.current = null;
      }
      const sink = activeSinkRef.current;
      if (sink) { try { sink.stop(); } catch {} }
      activeSinkRef.current = null;
    }

    function closeSocket(ws: WebSocket | null, sendStop: boolean) {
      if (!ws) return;
      // Detach handlers first: an intentional close must not schedule another
      // reconnect through onclose/onerror.
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (wsRef.current === ws) wsRef.current = null;
      if (sendStop && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "stop" }));
      }
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    }

    function scheduleReconnect(message?: string) {
      if (cancelled || retryTimer) return;
      if (attempts >= MAX_RETRIES) {
        setError("Stream dropped and could not reconnect. Check your connection");
        setStreaming(false);
        return;
      }
      attempts++;
      setError(`Stream dropped, reconnecting (${attempts}/${MAX_RETRIES})…`);
      setStreaming(false);
      if (message) setError(message);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, RETRY_DELAY_MS);
    }

    function restart(ws: WebSocket, message?: string) {
      stopSink();
      closeSocket(ws, false);
      scheduleReconnect(message);
    }

    async function connect() {
      if (cancelled) return;
      const connectionId = ++connectionSequence;
      const reconnectAttempt = attempts;
      const connectStartedAt = performance.now();
      let peakSocketBufferBytes = 0;
      let sentFirstChunk = false;

      setDiagnostics({
        connection_id: connectionId,
        reconnect_attempt: reconnectAttempt,
        socket_open_ms: null,
        relay_started_ms: null,
        first_browser_chunk_ms: null,
        first_relay_media_ms: null,
        peak_socket_buffer_bytes: 0,
        relay: null,
      });

      if (process.env.NEXT_PUBLIC_RELAY_DISCOVERY === "true") {
        try {
          const response = await fetch(
            `/api/backend/relay/assignment?session_id=${encodeURIComponent(sessionId)}`,
            { cache: "no-store" },
          );
          if (response.ok) {
            const assignment = await response.json() as { relay_url?: string };
            if (assignment.relay_url) relayUrl = assignment.relay_url;
          }
        } catch (error) {
          console.warn("[relay-stream] relay discovery failed, using configured fallback", error);
        }
      }
      // Probe WebCodecs once, at the real resolution/fps/bitrate we'll use, so a
      // browser that exposes the API but can't encode (e.g.) 1080p H264 still
      // falls back cleanly. `webCodecsDisabled` (a runtime failure) forces
      // MediaRecorder for the remainder of the session.
      if (!webCodecsChecked) {
        webCodecsChecked = true;
        const enc = encoderRef.current;
        const { width, height } = resolutionDims(enc.outputResolution);
        webCodecsCapable = await canUseWebCodecsRelay({
          width,
          height,
          fps: enc.fps,
          videoBitrateKbps: enc.videoBitrateKbps,
          audioBitrateKbps: enc.audioBitrateKbps,
        });
        console.info("[relay-stream] WebCodecs relay path:", webCodecsCapable ? "available" : "unavailable");
      }
      if (cancelled) return;
      const useWebCodecsNow = webCodecsCapable && !webCodecsDisabled;
      let relayTicket: string;
      try {
        const response = await fetch("/api/backend/relay/ticket", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Ditch-Request": "1" },
          body: JSON.stringify({ session_id: sessionId }), cache: "no-store",
        });
        if (!response.ok) throw new Error("Relay authorization failed");
        relayTicket = (await response.json()).token;
      } catch { scheduleReconnect("Relay authorization failed. Please sign in again."); return; }
      if (cancelled) return;
      const ws = new WebSocket(relayUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        const socketOpenMs = Math.round(performance.now() - connectStartedAt);
        setDiagnostics((current) => current?.connection_id === connectionId
          ? { ...current, socket_open_ms: socketOpenMs }
          : current);
        const enc = encoderRef.current;
        ws.send(JSON.stringify({
          type: "start",
          session_id: sessionId,
          token: relayTicket,
          video_bitrate_kbps: enc.videoBitrateKbps,
          audio_bitrate_kbps: enc.audioBitrateKbps,
          encoder_preset: enc.encoderPreset,
          fps: enc.fps,
          // Tells the relay which demuxer to use: WebCodecs emits fragmented MP4,
          // MediaRecorder emits WebM.
          container: useWebCodecsNow ? "mp4" : "webm",
        }));
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.type === "started") {
          const relayStartedMs = Math.round(performance.now() - connectStartedAt);
          const relayTimings = msg.timings && typeof msg.timings === "object"
            ? msg.timings as unknown as RelayStartTimings
            : null;
          setDiagnostics((current) => current?.connection_id === connectionId
            ? { ...current, relay_started_ms: relayStartedMs, relay: relayTimings }
            : current);
          console.info("[relay-perf] relay started", {
            connection_id: connectionId,
            reconnect_attempt: reconnectAttempt,
            client_elapsed_ms: relayStartedMs,
            relay: relayTimings,
          });

          const enc = encoderRef.current;

          // Shared sink plumbing: forwards one encoded byte range to the relay,
          // applies socket-buffer backpressure, and records the first-chunk
          // diagnostic. Returns false when the send queue is saturated (the
          // caller restarts) so the WebCodecs encoder can stop feeding.
          const pushToRelay = (payload: Blob | ArrayBufferView, byteLength: number): boolean => {
            if (byteLength === 0 || ws.readyState !== WebSocket.OPEN) return true;

            peakSocketBufferBytes = Math.max(peakSocketBufferBytes, ws.bufferedAmount);
            if (ws.bufferedAmount >= MAX_SOCKET_BUFFER_BYTES) {
              restart(ws, `Relay upload stalled, reconnecting (${attempts + 1}/${MAX_RETRIES})...`);
              return false;
            }

            ws.send(payload);
            bytesSentRef.current += byteLength;
            if (!sentFirstChunk) {
              sentFirstChunk = true;
              const firstChunkMs = Math.round(performance.now() - connectStartedAt);
              setDiagnostics((current) => current?.connection_id === connectionId
                ? { ...current, first_browser_chunk_ms: firstChunkMs }
                : current);
              console.info("[relay-perf] first browser media chunk", {
                connection_id: connectionId,
                elapsed_ms: firstChunkMs,
                bytes: byteLength,
              });
            }
            return true;
          };

          const startBitrateTimer = () => {
            bytesSentRef.current = 0;
            bitrateTimerRef.current = setInterval(() => {
              const kbps = Math.round((bytesSentRef.current * 8) / 2 / 1000);
              bytesSentRef.current = 0;
              onBitrateRef.current?.(kbps);
              setDiagnostics((current) => (
                current?.connection_id === connectionId &&
                current.peak_socket_buffer_bytes !== peakSocketBufferBytes
              ) ? { ...current, peak_socket_buffer_bytes: peakSocketBufferBytes } : current);
            }, 2000);
          };

          if (useWebCodecsNow) {
            // Browser-side H264 encode with guaranteed 2s key frames, muxed to
            // fragmented MP4 (container: "mp4"). A setup or runtime failure
            // latches WebCodecs off and restarts on MediaRecorder.
            startWebCodecsEncoder({
              stream: stream!,
              videoBitrateKbps: enc.videoBitrateKbps,
              audioBitrateKbps: enc.audioBitrateKbps,
              fps: enc.fps,
              keyFrameIntervalSec: KEY_FRAME_INTERVAL_SEC,
              onChunk: (data) => pushToRelay(data, data.byteLength),
              onError: (err) => {
                console.warn("[relay-stream] WebCodecs runtime failure, falling back to MediaRecorder", err);
                webCodecsDisabled = true;
                restart(ws, "Switching encoder, reconnecting…");
              },
            }).then((controller: WebCodecsEncoderController) => {
              // Torn down while awaiting start(): stop immediately.
              if (cancelled || wsRef.current !== ws) { controller.stop(); return; }
              activeSinkRef.current = controller;
              startBitrateTimer();
              setStreaming(true);
              setError(null);
            }).catch((err) => {
              console.warn("[relay-stream] WebCodecs setup failed, falling back to MediaRecorder", err);
              webCodecsDisabled = true;
              restart(ws, "Switching encoder, reconnecting…");
            });
            return;
          }

          const mimeType =
            MediaRecorder.isTypeSupported("video/webm;codecs=h264,opus")
              ? "video/webm;codecs=h264,opus"
              : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
              ? "video/webm;codecs=vp8,opus"
              : "video/webm";

          console.log("[relay-stream] MediaRecorder mimeType selected:", mimeType);

          const recorder = new MediaRecorder(stream!, {
            mimeType,
            videoBitsPerSecond: enc.videoBitrateKbps * 1000,
            audioBitsPerSecond: enc.audioBitrateKbps * 1000,
            // Ask Chromium for a keyframe every 2s. Unknown dictionary members
            // are ignored by browsers without support, so this is safe to pass
            // unconditionally. (Ignored for H264 in current Chromium; the
            // WebCodecs path above is the real key frame control.)
            videoKeyFrameIntervalDuration: 2000,
          } as MediaRecorderOptions);
          activeSinkRef.current = {
            stop: () => { if (recorder.state !== "inactive") recorder.stop(); },
          };

          recorder.ondataavailable = (e: BlobEvent) => {
            pushToRelay(e.data, e.data.size);
          };

          recorder.onerror = () => {
            setError("Encoder error, restarting stream…");
            restart(ws);
          };

          recorder.start(CHUNK_INTERVAL_MS);
          startBitrateTimer();
          setStreaming(true);
          setError(null);
        }

        if (msg.type === "error") {
          const message = String(msg.message);
          if (msg.retryable === false) {
            stopSink();
            closeSocket(ws, false);
            setError(message);
            setStreaming(false);
          } else {
            restart(ws, `${message}; reconnecting (${attempts + 1}/${MAX_RETRIES})...`);
          }
        }

        if (msg.type === "stopped") {
          // ffmpeg exited server-side; close this socket before reconnecting so
          // one browser can never leave multiple idle relay connections behind.
          restart(ws);
        }

        if (msg.type === "first_media") {
          // A relay acknowledgement only means ffmpeg spawned. Reset the retry
          // budget after media is actually flowing so repeated pre-media exits
          // cannot reconnect forever.
          attempts = 0;
          const firstRelayMediaMs = Math.round(performance.now() - connectStartedAt);
          setDiagnostics((current) => current?.connection_id === connectionId
            ? { ...current, first_relay_media_ms: firstRelayMediaMs }
            : current);
          console.info("[relay-perf] first media reached relay", {
            connection_id: connectionId,
            client_elapsed_ms: firstRelayMediaMs,
            relay_elapsed_ms: msg.relay_elapsed_ms,
          });
        }
      };

      // onerror always fires before onclose; set the message here, let onclose drive reconnect
      ws.onerror = () => {
        setError(`Relay connection error, reconnecting (${attempts + 1}/${MAX_RETRIES})…`);
      };

      ws.onclose = () => {
        stopSink();
        if (wsRef.current === ws) wsRef.current = null;
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      stopSink();
      closeSocket(wsRef.current, true);
      bytesSentRef.current = 0;
      onBitrateRef.current?.(0);
      setStreaming(false);
    };
  }, [enabled, stream, sessionId, token]);

  return { streaming, error, diagnostics };
}
