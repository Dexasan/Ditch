import { RoomServiceClient } from "livekit-server-sdk";

/** Stop an already-connected publisher; denying future token minting is insufficient. */
export async function removeLiveKitParticipant(sessionId: string, slotIndex: number | null): Promise<void> {
  if (slotIndex == null) return;
  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return;
  const endpoint = new URL(url);
  endpoint.protocol = endpoint.protocol === "wss:" ? "https:" : endpoint.protocol === "ws:" ? "http:" : endpoint.protocol;
  const rooms = new RoomServiceClient(endpoint.origin, key, secret);
  await rooms.removeParticipant(sessionId, String(slotIndex + 1));
}
