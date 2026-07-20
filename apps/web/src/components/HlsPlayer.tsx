"use client";

import { useEffect, useRef } from "react";
import Hls from "hls.js";

export default function HlsPlayer({ src, onFatalError }: { src: string; onFatalError?: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      void video.play().catch(() => {});
      return () => { video.removeAttribute("src"); video.load(); };
    }
    if (!Hls.isSupported()) {
      onFatalError?.();
      return;
    }
    const hls = new Hls({
      liveSyncDurationCount: 3,
      liveMaxLatencyDurationCount: 8,
      maxLiveSyncPlaybackRate: 1.25,
      enableWorker: true,
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) onFatalError?.();
    });
    return () => hls.destroy();
  }, [onFatalError, src]);

  return <video ref={ref} className="absolute inset-0 h-full w-full bg-black object-contain" autoPlay playsInline controls={false} />;
}
