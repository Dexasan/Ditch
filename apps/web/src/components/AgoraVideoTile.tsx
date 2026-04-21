"use client";

import { useEffect, useRef } from "react";
import type { ILocalVideoTrack, IRemoteVideoTrack } from "agora-rtc-sdk-ng";

export default function AgoraVideoTile({
  track,
}: {
  track: ILocalVideoTrack | IRemoteVideoTrack;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    track.play(ref.current);
    return () => {
      track.stop();
    };
  }, [track]);

  return <div ref={ref} className="absolute inset-0 w-full h-full" />;
}
