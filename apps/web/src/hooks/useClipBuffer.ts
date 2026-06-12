"use client";

import { useEffect, useRef } from "react";

export function useClipBuffer(stream: MediaStream | null): { saveClip: () => void } {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef("video/webm");

  useEffect(() => {
    if (!stream) return;

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        if (chunksRef.current.length > 60) chunksRef.current.shift();
      }
    };
    recorder.start(1000);
    recorderRef.current = recorder;

    return () => {
      try { recorder.stop(); } catch { /* already stopped */ }
      recorderRef.current = null;
      chunksRef.current = [];
    };
  }, [stream]);

  function saveClip() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    const mimeType = mimeTypeRef.current;
    const currentStream = recorder.stream;

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ditch-clip-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);

      // Restart the rolling buffer from empty - otherwise the next clip
      // would still contain the chunks that were just saved
      chunksRef.current = [];
      const next = new MediaRecorder(currentStream, { mimeType });
      next.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          if (chunksRef.current.length > 60) chunksRef.current.shift();
        }
      };
      next.start(1000);
      recorderRef.current = next;
    };

    recorder.stop();
  }

  return { saveClip };
}
