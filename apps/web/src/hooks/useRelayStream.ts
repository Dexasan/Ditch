"use client";

import { useEffect, useRef, useState } from "react";

const CHUNK_INTERVAL_MS = 250;

interface RelayStreamOptions {
  stream: MediaStream | null;
  sessionId: string;
  token: string;
  enabled: boolean;
}

export interface RelayStreamState {
  streaming: boolean;
  error: string | null;
}

export function useRelayStream({
  stream,
  sessionId,
  token,
  enabled,
}: RelayStreamOptions): RelayStreamState {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!enabled || !stream) return;

    const relayUrl = process.env.NEXT_PUBLIC_RELAY_URL ?? "ws://localhost:3003";
    const ws = new WebSocket(relayUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "start", session_id: sessionId, token }));
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "started") {
        // Prefer H264 so ffmpeg can copy the stream directly without re-encoding.
        // VP8 requires libvpx+libx264 transcoding which segfaults on Railway.
        const mimeType =
          MediaRecorder.isTypeSupported("video/webm;codecs=h264,opus")
            ? "video/webm;codecs=h264,opus"
            : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
            ? "video/webm;codecs=vp8,opus"
            : "video/webm";

        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: 3_000_000,
          audioBitsPerSecond: 128_000,
        });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };

        recorder.onerror = () => {
          setError("Recorder error — stream may have stopped");
          setStreaming(false);
        };

        recorder.start(CHUNK_INTERVAL_MS);
        setStreaming(true);
        setError(null);
      }

      if (msg.type === "error") {
        setError(String(msg.message));
        setStreaming(false);
      }

      if (msg.type === "stopped") {
        setStreaming(false);
      }
    };

    ws.onerror = () => {
      setError("Could not connect to relay server");
      setStreaming(false);
    };

    ws.onclose = () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
      setStreaming(false);
    };

    return () => {
      recorderRef.current?.stop();
      recorderRef.current = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "stop" }));
        }
        ws.close();
      }
      wsRef.current = null;
      setStreaming(false);
    };
  }, [enabled, stream, sessionId, token]);

  return { streaming, error };
}
