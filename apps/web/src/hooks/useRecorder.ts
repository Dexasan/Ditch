"use client";

import { useEffect, useRef, useState } from "react";

interface RecorderResult {
  isRecording: boolean;
  elapsed: number;
  startRecording: () => void;
  stopRecording: () => void;
}

export function useRecorder(
  stream: MediaStream | null,
  /** Called after the recording file has actually been handed to the browser for download. */
  onSaved?: () => void,
): RecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Stable ref so onstop (registered at start time) never calls a stale callback
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  function startRecording() {
    if (!stream || isRecording) return;

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ditch-recording-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      chunksRef.current = [];
      onSavedRef.current?.();
    };

    recorder.start(1000);
    recorderRef.current = recorder;
    setIsRecording(true);
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
    setElapsed(0);
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      try { recorderRef.current?.stop(); } catch { /* already stopped */ }
    };
  }, []);

  return { isRecording, elapsed, startRecording, stopRecording };
}
