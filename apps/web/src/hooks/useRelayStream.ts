"use client";

import { useEffect, useRef, useState } from "react";

const CHUNK_INTERVAL_MS = 250;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 2000;

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
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    function stopRecorder() {
      recorderRef.current?.stop();
      recorderRef.current = null;
    }

    function closeSocket() {
      const ws = wsRef.current;
      if (!ws) return;
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "stop" }));
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      wsRef.current = null;
    }

    function scheduleReconnect() {
      if (cancelled) return;
      if (attempts >= MAX_RETRIES) {
        setError("Stream dropped and could not reconnect — check your connection");
        setStreaming(false);
        return;
      }
      attempts++;
      setError(`Stream dropped — reconnecting (${attempts}/${MAX_RETRIES})…`);
      setStreaming(false);
      retryTimer = setTimeout(connect, RETRY_DELAY_MS);
    }

    function connect() {
      if (cancelled) return;

      const ws = new WebSocket(relayUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "start", session_id: sessionId, token }));
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.type === "started") {
          attempts = 0;

          const mimeType =
            MediaRecorder.isTypeSupported("video/webm;codecs=h264,opus")
              ? "video/webm;codecs=h264,opus"
              : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
              ? "video/webm;codecs=vp8,opus"
              : "video/webm";

          console.log("[relay-stream] MediaRecorder mimeType selected:", mimeType);

          const recorder = new MediaRecorder(stream!, {
            mimeType,
            videoBitsPerSecond: 3_000_000,
            audioBitsPerSecond: 128_000,
          });
          recorderRef.current = recorder;

          recorder.ondataavailable = (e: BlobEvent) => {
            if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
          };

          recorder.onerror = () => {
            setError("Encoder error — restarting stream…");
            stopRecorder();
            closeSocket();
            scheduleReconnect();
          };

          recorder.start(CHUNK_INTERVAL_MS);
          setStreaming(true);
          setError(null);
        }

        if (msg.type === "error") {
          setError(String(msg.message));
          stopRecorder();
          scheduleReconnect();
        }

        if (msg.type === "stopped") {
          // ffmpeg exited server-side; recorder is still running — stop it then reconnect
          stopRecorder();
          scheduleReconnect();
        }
      };

      // onerror always fires before onclose; set the message here, let onclose drive reconnect
      ws.onerror = () => {
        setError(`Relay connection error — reconnecting (${attempts + 1}/${MAX_RETRIES})…`);
      };

      ws.onclose = () => {
        stopRecorder();
        wsRef.current = null;
        scheduleReconnect();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      stopRecorder();
      closeSocket();
      setStreaming(false);
    };
  }, [enabled, stream, sessionId, token]);

  return { streaming, error };
}
