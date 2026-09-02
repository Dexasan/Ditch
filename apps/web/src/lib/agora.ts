export type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  ILocalAudioTrack,
  IRemoteVideoTrack,
} from "agora-rtc-sdk-ng";

export const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "";

let _autoplayHandlerSet = false;

export async function getAgoraRTC() {
  const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
  if (!_autoplayHandlerSet) {
    _autoplayHandlerSet = true;
    if (process.env.NODE_ENV === "production") { AgoraRTC.setLogLevel(4); AgoraRTC.disableLogUpload(); }
    // iOS Safari blocks media playback started outside a user gesture. Without a
    // handler the SDK leaves remote video frozen/black; registering one lets the
    // SDK resume playback on the next tap.
    AgoraRTC.onAutoplayFailed = () => {
      console.warn("[agora] autoplay blocked; will resume on next user interaction");
      window.dispatchEvent(new Event("ditch:autoplay-failed"));
    };
  }
  return AgoraRTC;
}

// Participant slot index (0-3) → Agora UID (1-4)
export const slotToUid = (slotIndex: number) => slotIndex + 1;

// Reserved UIDs for the creator - fixed so viewers can find them in remoteUsers
export const CREATOR_CAM_UID = 999;       // creator camera + mic
export const CREATOR_SCREEN_UID = 998;    // creator screen share (second client)
export const CREATOR_COMPOSITE_UID = 997; // full program mix (studio canvas + audio)
