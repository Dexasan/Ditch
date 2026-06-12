export type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ILocalVideoTrack,
  ILocalAudioTrack,
  IRemoteVideoTrack,
} from "agora-rtc-sdk-ng";

export const AGORA_APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID ?? "";

export async function getAgoraRTC() {
  const { default: AgoraRTC } = await import("agora-rtc-sdk-ng");
  return AgoraRTC;
}

// Participant slot index (0-3) → Agora UID (1-4)
export const slotToUid = (slotIndex: number) => slotIndex + 1;

// Reserved UIDs for the creator - fixed so viewers can find them in remoteUsers
export const CREATOR_CAM_UID = 999;    // creator camera + mic
export const CREATOR_SCREEN_UID = 998; // creator screen share (second client)
