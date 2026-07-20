"use client";

import { useAgoraRoom, type AgoraRoomState } from "./useAgoraRoom";
import { useLiveKitRoom } from "./useLiveKitRoom";

export type RtcProvider = "agora" | "livekit";

export const RTC_PROVIDER: RtcProvider =
  process.env.NEXT_PUBLIC_RTC_PROVIDER === "livekit" ? "livekit" : "agora";

type Options = Parameters<typeof useAgoraRoom>[0];

export function useRtcRoom(options: Options): AgoraRoomState {
  const agora = useAgoraRoom({ ...options, enabled: options.enabled && RTC_PROVIDER === "agora" });
  const livekit = useLiveKitRoom({ ...options, enabled: options.enabled && RTC_PROVIDER === "livekit" });
  return RTC_PROVIDER === "livekit" ? livekit : agora;
}
