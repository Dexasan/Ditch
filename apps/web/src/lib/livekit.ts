// livekit-client ships ~11MB of dist and only ever runs when
// NEXT_PUBLIC_RTC_PROVIDER is "livekit". A static import puts all of it in the
// shared client bundle, so Agora viewers download an SDK they never touch.
// Loading it on demand moves it into its own chunk that is fetched only when a
// LiveKit path actually connects. The promise is cached module-wide, so every
// caller after the first resolves from memory instead of re-requesting.
export type LiveKitModule = typeof import("livekit-client");

let liveKitModulePromise: Promise<LiveKitModule> | null = null;

export function loadLiveKit(): Promise<LiveKitModule> {
  if (!liveKitModulePromise) liveKitModulePromise = import("livekit-client");
  return liveKitModulePromise;
}
