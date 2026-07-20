"use client";

import { useCompositePublish } from "./useCompositePublish";
import { useLiveKitCompositePublish } from "./useLiveKitCompositePublish";
import { RTC_PROVIDER } from "./useRtcRoom";

type Options = Parameters<typeof useCompositePublish>[0];

export function useProgramPublish(options: Options) {
  useCompositePublish({ ...options, enabled: options.enabled && RTC_PROVIDER === "agora" });
  useLiveKitCompositePublish({ ...options, enabled: options.enabled && RTC_PROVIDER === "livekit" });
}
