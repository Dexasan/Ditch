"use client";

import { useEffect, useRef } from "react";
import type { ILocalVideoTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";

export default function AgoraVideoTile({
  track,
  fit = "cover",
  mirror = false,
}: {
  track: ILocalVideoTrack | IRemoteVideoTrack;
  fit?: "contain" | "cover";
  mirror?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    track.play(ref.current, { fit, mirror });
    return () => {
      track.stop();
    };
  }, [fit, mirror, track]);

  return <div ref={ref} className="absolute inset-0 h-full w-full overflow-hidden" />;
}
