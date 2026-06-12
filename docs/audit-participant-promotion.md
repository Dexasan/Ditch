# Audit — Participant Promotion: Post-Accept Camera Flow

**Date:** 2026-05-22
**Branch:** main (3fff6a4)
**Scope:** Everything that happens after the creator clicks "Set live" in the queue panel — viewer-side Agora promotion, track creation, host-side subscription and tile rendering.
**Out of scope:** The request/accept handshake (confirmed working).

---

## 1 — Viewer accept-handler code path (exact sequence post-accept)

### The two-step creator flow

The Studio queue panel has **two separate clicks** to get a viewer on stream:

1. **"Approve"** button (`QueueItem`, `Studio.tsx:1428`) → emits `participant:status_change { status: "approved" }` — no slot.
2. **"Set live → N"** button (`Studio.tsx:1435-1441`) → emits `participant:status_change { status: "live", slot_index: nextSlot }` — with assigned slot.

Both flow through `changeParticipantStatus` (`Studio.tsx:2146-2149`):
```typescript
function changeParticipantStatus(id: string, status: ParticipantStatus, slot_index?: number) {
  const socket = getSocket(token);
  socket.emit("participant:status_change", { session_id: sessionId, participant_id: id, status, slot_index });
}
```

The realtime server validates the transition, updates the DB, then broadcasts to the session room:
```typescript
io.to(session_id).emit("participant:status_change", { participant: updatedParticipant });
io.to(session_id).emit("participant:queue_update", { session_id, participants });
```

### What the viewer side listens for

`ChannelView.tsx:74-79` — listens for `participant:status_change`:
```typescript
socket.on("participant:status_change", ({ participant }) => {
  setParticipants((prev) => prev.map((p) => (p.id === participant.id ? participant : p)));
  setMyParticipant((prev) => (prev?.id === participant.id ? participant : prev));
});
```

`ChannelView.tsx:66-71` — listens for `participant:queue_update`:
```typescript
socket.on("participant:queue_update", ({ participants: updated }) => {
  setParticipants(updated);
  setMyParticipant((prev) => {
    if (!prev) return prev;
    return updated.find((p: Participant) => p.id === prev.id) ?? prev;
  });
});
```

Both fire when the creator acts. Both update `myParticipant`.

### How the Agora hook reacts

`ChannelView.tsx:96-105` — derives Agora props from `myParticipant`:
```typescript
const isLiveParticipant = myParticipant?.status === "live";
const mySlotUid = isLiveParticipant ? slotToUid(myParticipant!.slot_index ?? 0) : 0;

const { localVideoTrack, localAudioTrack, remoteUsers } = useAgoraRoom({
  channelName: sessionId,
  uid: isLiveParticipant ? mySlotUid : 0,        // 0 → slotToUid(slot_index)
  role: isLiveParticipant ? "host" : "audience", // "audience" → "host"
  publish: isLiveParticipant,                    // false → true
  enabled: true,
});
```

`slotToUid` (`lib/agora.ts:17`): `(slotIndex: number) => slotIndex + 1`. Slot 0 → UID 1, slot 1 → UID 2, etc.

When `myParticipant.status` goes from `"approved"` to `"live"`, three deps of the `useAgoraRoom` effect change simultaneously: `uid`, `role`, `publish`.

---

## 2 — Track creation invocation — is it being called?

### The intended sequence

`useAgoraRoom.ts:53-124` — the single `useEffect` with deps `[enabled, channelName, uid, role, publish]`:

```typescript
setup().catch((err) => {
  if (mounted) setState((prev) => ({ ...prev, error: String(err) }));
});
```

Inside `setup()`, the full sequence when `role="host"` and `publish=true`:

```
1. const AgoraRTC = await getAgoraRTC()
2. if (!mounted) return                          ← guard
3. const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" })
4. Register user-published / user-unpublished / user-left listeners
5. await client.setClientRole("host")            ← role BEFORE join ✓
6. await client.join(AGORA_APP_ID, channelName, null, slotUID)
7. if (!mounted) return                          ← guard
8. setState({ joined: true })
9. if (publish) {
10.   [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks()  ← track creation
11.   if (!mounted) return                       ← guard
12.   await client.publish([audioTrack, videoTrack])
13.   setState({ localVideoTrack, localAudioTrack })
   }
```

### Whether `createMicrophoneAndCameraTracks` is actually invoked

There is no explicit instrumentation. No console.log anywhere in the promotion or track creation path. The only observable signal on the viewer's device is the browser camera permission prompt — which the user reports is not appearing.

The wiring from socket event → `myParticipant` state → `isLiveParticipant` → `publish=true` dep change → effect re-run → `createMicrophoneAndCameraTracks` call is correct in the code. The mechanism exists.

**The critical gap:** `setup()` is wrapped in `.catch()` that swallows all errors into an `error` state field. `ChannelView` destructures `useAgoraRoom` as:
```typescript
const { localVideoTrack, localAudioTrack, remoteUsers } = useAgoraRoom({...});
```

The `error` field is **not destructured and never rendered**. Any Agora error after the state-update-triggered re-render is completely invisible — no toast, no UI state, nothing.

---

## 3 — Role switch order and timing

**Order is correct.** `client.setClientRole(role)` is called at step 5, `client.join(...)` at step 6. In Agora SDK v4.x (`agora-rtc-sdk-ng: ^4.24.3`), role must be set before joining a "live" mode channel for the role to take effect. The code does this correctly.

The cleanup that fires before the new `setup()` runs:
```typescript
return () => {
  mounted = false;
  clientRef.current?.leave().catch(() => {});  // fires, not awaited
  clientRef.current = null;
  // ...
};
```

`leave()` is not awaited — it fires in the background. The new `setup()` starts immediately. Because a new `AgoraRTC.createClient()` call is made, the new client is independent of the old one. The non-awaited leave on the old client doesn't affect the new join. This is correct.

There is no scenario where `createMicrophoneAndCameraTracks` runs while the client is still in audience role. The role switch happens at step 5, track creation at step 10.

---

## 4 — Host-side subscriber config and tile-render trigger

### Creator's Agora client

`Studio.tsx:2166-2173`:
```typescript
useAgoraRoom({
  channelName: sessionId,
  uid: CREATOR_CAM_UID,  // 999
  role: "host",
  publish: !!cameraLayer,
  enabled: true,
  screenShareUid: CREATOR_SCREEN_UID,
});
```

Inside `useAgoraRoom`, `user-published` is handled:
```typescript
client.on("user-published", async (user, mediaType) => {
  await client.subscribe(user, mediaType);
  if (mediaType === "audio" && user.audioTrack) user.audioTrack.play();
  syncRemote();
});
```

`syncRemote` does `setState({ remoteUsers: [...client.remoteUsers] })`. The creator's client IS subscribing to `user-published`. If a participant publishes, the creator would receive the track. ✓

### How the compositor draws participant tiles

`useCompositor.ts:293-298` (draw loop):
```typescript
for (const p of liveParticipants) {
  const uid = (p.slot_index ?? 0) + 1;              // matches slotToUid
  const remoteUser = remoteUsers.find((u) => u.uid === uid);
  // draws remoteUser?.videoTrack ?? null
}
```

The compositor draws participant video **only if a video track exists in `remoteUsers`**. If no track was published, the compositor draws nothing for that slot. The creator's studio preview would show an empty/black region for the participant's slot.

### How the audience renders participant tiles

`ChannelView.tsx:208-234`:
```typescript
const liveSlots = participants.filter((p) => p.status === "live");

{liveSlots.map((p) => {
  const uid = slotToUid(p.slot_index ?? 0);
  const isMe = myParticipant?.id === p.id;
  const videoTrack = isMe
    ? localVideoTrack
    : remoteUsers.find((u) => u.uid === uid)?.videoTrack ?? null;
  return (
    <div>
      {videoTrack ? <AgoraVideoTile track={videoTrack} /> : <placeholder with name />}
    </div>
  );
})}
```

**Tile rendering is presence-based, not track-based.** A tile appears as soon as `participants` contains a `status === "live"` entry — sourced from socket events (`participant:status_change` / `participant:queue_update`). The tile renders a name-label placeholder if no video track is available.

**This directly explains the audience screenshot:** "black tiles with names 'Raju' and 'Rohan'" — the DB/socket says they're live (tile appears, name shows), but `remoteUsers` has no video track for their UIDs (no publish happened), so the placeholder renders.

**The tile appearing does NOT mean tracks were received.** It means the socket said they're live.

---

## 5 — Anonymous user handling in the join flow

**Anonymous viewers can be promoted correctly.** Tracing the path:

1. The viewer's socket connects with `token: null`. The auth middleware sets `socket.data.user_id = null` — allowed.
2. The viewer's socket joins the session room via `session:join`. The room broadcasts reach them.
3. When the creator sets them live, `io.to(session_id).emit("participant:status_change", ...)` reaches the anonymous socket. ✓
4. `setMyParticipant` updates, `isLiveParticipant → true`.
5. `useAgoraRoom` re-runs with `role="host"`, `publish=true`.
6. `client.join(AGORA_APP_ID, channelName, null, uid)` — the third arg is the Agora token, always `null` (Testing Mode). This is completely independent of Supabase auth.

There is no auth check anywhere in the Agora join or publish path. An anonymous viewer would go through exactly the same Agora code path as an authenticated one.

**No silent fail for anonymous users specifically.** The promotion path is auth-blind.

One note: the `participant:notify_new` event we just shipped (3fff6a4) is emitted with `getSocket(token ?? undefined)` after `requestJoin`. For an anonymous viewer, `token` is null — the socket call goes through. The realtime server handler has no auth check on `participant:notify_new`. This is fine.

---

## 6 — Destinations/mount code overlap check

`Studio.tsx` fetches destinations from the DB on mount (via `useEffect([], [])`) and calls `addDestination` / `updateSettings` to populate the Zustand store. This is entirely separate from Agora client management.

The Agora hook invocation (`useAgoraRoom`) has fixed deps (`channelName=sessionId`, `uid=CREATOR_CAM_UID`, `role="host"`, `publish=!!cameraLayer`, `enabled=true`). None of these change when destinations load. The Agora client is not re-initialized on mount or destination fetch.

**No overlap. The destinations work does not touch the participant promotion path.**

---

## Verdict: Mode A — tracks never created, error silenced

**The failure is Mode A.** The evidence:

| Signal | Meaning |
|---|---|
| "You're live!" badge visible | `myParticipant.status === "live"` — socket state update worked ✓ |
| Mute/Cam buttons visible | `isLiveParticipant === true` — derived from socket state ✓ |
| No camera permission prompt | `createMicrophoneAndCameraTracks()` either not reached or throwing before the OS prompt |
| Black tiles on audience side | `remoteUsers` has no video track for participant UIDs — nothing published |
| Studio preview shows nothing | Compositor finds no `remoteUser.videoTrack` for slot UIDs — nothing published |

**The wiring is correct in the code.** `isLiveParticipant → publish=true → useAgoraRoom deps change → setup() re-runs → setClientRole("host") → join → createMicrophoneAndCameraTracks → publish`. This sequence IS being triggered.

**The failure is that any error in this chain is completely silent.** `setup().catch(err => setState({ error }))` stores the Agora error in state, but `ChannelView` never destructures or renders `error` from `useAgoraRoom`. The user sees "You're live!" from the socket state but no camera — the Agora pipeline failed at some point after the effect re-ran, and nothing reported it.

**The most likely specific failure:** `createMicrophoneAndCameraTracks()` throws before the OS-level camera prompt because:
- The viewer opened `/c/[slug]` as a casual viewer with no expectation of needing camera access
- The browser may have cached a "denied" decision from a prior visit (common on desktops — once denied, no further prompts)
- Or: the Agora client's `join()` at step 6 is failing (wrong app ID, network issue, UID conflict) — also silenced by the same catch

**To distinguish:** Open the viewer's browser console. Any Agora error will appear in the `error` state that was set but not rendered. Alternatively, the Agora SDK logs internally — enabling `AgoraRTC.setLogLevel(0)` would show the failure point.

---

## Tangential issues found (not fixed)

**1. `error` from `useAgoraRoom` is never rendered in `ChannelView`.**
The full signature is returned: `{ localVideoTrack, localAudioTrack, remoteUsers, joined, error, isScreenSharing, toggleScreenShare }`. `ChannelView` only destructures the first three. Any Agora failure (permissions denied, network, UID conflict, device not found) is invisible to the participant.

**2. The "You're live!" UI state is decoupled from actual track state.**
`isLiveParticipant` is derived from `myParticipant.status === "live"` (socket-sourced). The Mute/Cam buttons appear based on this. But `localVideoTrack` and `localAudioTrack` may both be `null` if track creation failed. `toggleMic` and `toggleCam` have `if (!localAudioTrack/localVideoTrack) return` guards — so the buttons are visible but silently do nothing. A participant sees "You're live!" with functional-looking controls that don't work.

**3. Audience tile rendering is presence-based.**
Tiles appear for `status === "live"` participants immediately from the socket, before any Agora track arrives. This is intentional (shows the slot is occupied) but means a broken publish is indistinguishable from a normal "joining" state from the audience side.

**4. The compositor uses an inline `(p.slot_index ?? 0) + 1` instead of `slotToUid`.**
`useCompositor.ts:212, 297`: both spots compute the UID inline rather than importing `slotToUid`. Not a bug (same math), but a consistency issue — if the UID formula ever changes, it'd need updating in three places.
