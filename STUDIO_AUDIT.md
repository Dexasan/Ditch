# Studio Audit — DITCH Live Control Room

## 1. Entry point: `page.tsx` (server component)

**Path:** `apps/web/src/app/c/[slug]/live/page.tsx`

Server component. Runs on every request. Does:

- `supabase.auth.getUser()` — redirects to `/auth` if not logged in
- Parallel fetch: `GET /channels/:slug` + `GET /channels/mine` (ownership check)
- Redirects non-owners to `/c/[slug]`
- Redirects if session is missing or ended → `/dashboard`
- Renders a 57px `<header>` + `<LiveRoom>`

The header in `page.tsx` (the one that says "Control room"):

| Zone | Contents |
|------|----------|
| Left | DITCH logo link, `/` separator, channel display name, LIVE status badge |
| Right | "View channel ↗" link, "Dashboard" link |

This header is the 57px that `LiveRoom` subtracts from viewport height.

---

## 2. Main client component: `LiveRoom.tsx`

**Path:** `apps/web/src/app/c/[slug]/live/LiveRoom.tsx` — 624 lines

Single large client component. 3-column layout + bottom toolbar. No store — all state is `useState` local to this component.

### Local state

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `messages` | `ChatMessage[]` | `[]` | Chat feed, capped at 200 |
| `participants` | `Participant[]` | `[]` | All session participants |
| `chatBody` | `string` | `""` | Chat input value |
| `micEnabled` | `boolean` | `true` | Mic on/off |
| `camEnabled` | `boolean` | `true` | Cam on/off |
| `streamingEnabled` | `boolean` | `false` | Whether relay stream is active |

### Socket events

| Direction | Event | Handler |
|-----------|-------|---------|
| emit on mount | `session:join` | Gets initial participants + recent chat |
| emit on unmount | `session:leave` | Cleanup |
| listen | `chat:message` | Appends to `messages` |
| listen | `participant:queue_update` | Replaces `participants` |
| listen | `participant:status_change` | Updates single participant in array |
| emit | `chat:message` | Sends creator chat message |
| emit | `participant:status_change` | Approve / set-live / remove a participant |

### Layout (actual DOM structure)

```
div.flex.h-[calc(100vh-57px)]
├── aside.w-60          — Left: Queue panel
│   ├── header          — "Queue" label + count badge
│   └── scroll area     — waiting + approved participants (QueueItem per row)
│       Each row: avatar, name, status badge, Approve/Set live/Remove buttons
├── main.flex-1         — Center: Stage
│   ├── stage header    — "Stage" label, LIVE badge, tiny cam thumbnail (7rem×3.94rem), screen thumb
│   ├── grid-cols-2     — 2×2 participant slot grid (AgoraVideoTile or empty placeholder)
│   └── toolbar         — Mic, Cam, Screen icons + Go Live button (center)
└── aside.w-72          — Right: Chat
    ├── header          — "Chat" label
    ├── scroll area     — message list (PlatformDot + author + body per row)
    └── form            — text input + Send button
```

### Functions defined inline

- `toggleMic()` — calls `localAudioTrack.setEnabled(next)`
- `toggleCam()` — calls `localVideoTrack.setEnabled(next)`
- `changeParticipantStatus(id, status, slot?)` — emits `participant:status_change`
- `sendChat(e)` — emits `chat:message`

### Inline sub-components

- `QueueItem` — participant row with action buttons
- `IconButton` — icon + label button with danger/active variants
- `PlatformDot` — colored 8px dot for platform identity
- `IconMic`, `IconMicOff`, `IconCamera`, `IconCameraOff`, `IconScreen`, `IconScreenOff`, `IconRadio` — SVG icons

---

## 3. Hooks

### `useAgoraRoom`

**Path:** `apps/web/src/hooks/useAgoraRoom.ts`

Manages the entire Agora RTC lifecycle. Two Agora clients: one for camera (UID 999), one for screen share (UID 998 — created on demand).

**Inputs:**
```ts
{
  channelName: string;       // session ID
  uid: number;               // CREATOR_CAM_UID = 999
  role: "host" | "audience";
  publish: boolean;          // true for creator
  enabled: boolean;
  screenShareUid?: number;   // CREATOR_SCREEN_UID = 998
}
```

**Outputs:**
```ts
{
  localVideoTrack: ILocalVideoTrack | null;   // creator camera
  localScreenTrack: ILocalVideoTrack | null;  // screen share (second client)
  localAudioTrack: ILocalAudioTrack | null;   // creator mic
  remoteUsers: IAgoraRTCRemoteUser[];         // all remote peers
  joined: boolean;
  error: string | null;
  isScreenSharing: boolean;
  toggleScreenShare: () => Promise<void>;
}
```

**Notes:**
- Camera client: mode `"live"`, codec `"vp8"`
- Screen client created fresh on each `toggleScreenShare()` call, destroyed on stop or browser "Stop sharing" click
- Subscribes to all remote users on `user-published`, plays audio automatically
- Full teardown on unmount (leaves channels, closes tracks)

**Used by:** `LiveRoom.tsx`, `ChannelView.tsx`

---

### `useCompositor`

**Path:** `apps/web/src/hooks/useCompositor.ts`

Composites local + remote video onto a 1280×720 offscreen canvas. Outputs a `MediaStream` containing one video track + mixed audio.

**Inputs:**
```ts
{
  localVideoTrack: ILocalVideoTrack | null;
  localAudioTrack: ILocalAudioTrack | null;
  remoteUsers: IAgoraRTCRemoteUser[];
  liveParticipants: Participant[];
  enabled: boolean;
}
```

**Outputs:** `{ stream: MediaStream | null }`

**Video source strategies (two paths):**

| Path | Mechanism | When |
|------|-----------|------|
| Breakout Box | `MediaStreamTrackProcessor` → `VideoFrame` cache → `drawImage` | Chrome 100+ with `MediaStreamTrackGenerator` |
| Fallback | Hidden `<video>` elements + `canvas.captureStream(0)` + `requestFrame()` | All other browsers |

**Draw tick:** Inline Worker (`setInterval` at 33ms = 30fps) — fires from a separate thread, immune to background-tab throttling.

**Layout presets:**

| Live participants | Layout |
|-----------------|--------|
| 0 | Creator fills full 1280×720 |
| 1 | Creator left half, participant right half |
| 2 | Creator full width top, two participants split bottom |
| 3+ | 2×2 grid, creator top-left |

**Audio graph:** `AudioContext` → `createMediaStreamSource` per track → single `MediaStreamAudioDestinationNode`. All audio mixed and included in output `MediaStream`.

**FPS logging:** Internal only — `console.log` every 5 seconds. Not exposed as React state.

**Critical gap — no visible preview:** The canvas is never attached to the DOM. The output `MediaStream` goes only to `useRelayStream`. There is currently zero visible preview of the composite anywhere on the page. The center "Stage" grid shows raw `AgoraVideoTile` elements (individual unprocessed feeds), not the compositor output.

---

### `useRelayStream`

**Path:** `apps/web/src/hooks/useRelayStream.ts`

WebSocket client that encodes the composite `MediaStream` and sends binary chunks to the relay server.

**Inputs:**
```ts
{
  stream: MediaStream | null;
  sessionId: string;
  token: string;
  enabled: boolean;
}
```

**Outputs:** `{ streaming: boolean; error: string | null }`

**Protocol:**
1. Connect WS → send `{type:"start", session_id, token}`
2. Receive `{type:"started"}` → start `MediaRecorder`
3. `ondataavailable` (every 250ms) → send binary chunk
4. Receive `{type:"stopped"|"error"}` → trigger reconnect
5. Send `{type:"stop"}` before closing

**MediaRecorder MIME priority:** `video/webm;codecs=h264,opus` → `video/webm;codecs=vp8,opus` → `video/webm`  
**Bitrates:** 3 Mbps video, 128 kbps audio  
**Reconnect:** 5 attempts, 2s between each

**`streaming` = true** only after `{type:"started"}` ack. Not on WS connect.

---

## 4. Libraries

### `lib/socket.ts`
Singleton Socket.IO client. One instance per `(REALTIME_URL + token)` pair. `autoConnect: false` — caller must call `.connect()`.

### `lib/api.ts`
Typed fetch wrapper (`get`, `post`, `patch`, `delete`). Bearer token in Authorization header. Throws `ApiError` (extends `Error` with `status: number`) on non-2xx.

### `lib/agora.ts`
Dynamic import shim for Agora SDK. Exports UID constants: `CREATOR_CAM_UID = 999`, `CREATOR_SCREEN_UID = 998`, `slotToUid(i) = i + 1`.

### `lib/supabase/browser.ts` / `server.ts`
Client factories for browser-safe and server-only Supabase access.

---

## 5. Components

### `AgoraVideoTile`
**Path:** `apps/web/src/components/AgoraVideoTile.tsx`

Minimal 23-line wrapper. Calls `track.play(ref.current)` on mount, `track.stop()` on unmount. Returns a full-inset div. Used for participant slot tiles and creator/screen thumbnails.

---

## 6. Relay server (untouched by studio refactor)

**Path:** `apps/relay/src/`

Node.js WebSocket server + ffmpeg child process. Its interface (WebSocket protocol) is stable and does not change in the studio refactor.

- `index.ts` — WS server, JWT validation, session/destinations DB fetch, ffmpeg spawn
- `lib/ffmpeg.ts` — ffmpeg args: WebM pipe-in → `-c:v copy` (H264 passthrough) → AAC audio → tee RTMP fan-out
- `lib/env.ts` — env validation

---

## 7. CSS design tokens

From `apps/web/src/app/globals.css`:

```css
--color-brand:          #7c3aed
--color-brand-light:    #a78bfa
--color-surface:        #0f0f10   /* page bg */
--color-surface-raised: #1a1a1d   /* panel/card bg */
--color-surface-border: #2a2a2e   /* borders */
--color-text:           #f4f4f5
--color-text-muted:     #71717a
```

---

## 8. Gap analysis — new studio vs. current state

### Reusable as-is (zero changes needed)

| Piece | Location | Notes |
|-------|----------|-------|
| `useAgoraRoom` | hooks/useAgoraRoom.ts | Complete. Just consumed differently. |
| `useRelayStream` | hooks/useRelayStream.ts | Complete. No interface change. |
| `AgoraVideoTile` | components/AgoraVideoTile.tsx | Used in layers / participant display. |
| `getSocket` + socket event logic | lib/socket.ts | Singleton stays. Event wiring moves to new component. |
| `api.ts`, `agora.ts`, supabase libs | lib/ | Unchanged. |
| Chat JSX (messages feed + form) | LiveRoom.tsx:466–513 | Copy into right sidebar panel. |
| Queue / participant management logic | LiveRoom.tsx:243–295 | Move to stream-info or dedicated panel. |
| Go Live button + state | LiveRoom.tsx:442–454 | Move to top bar. |
| Mic/cam toggle functions | LiveRoom.tsx:202–213 | Move to audio mixer card. |
| PLATFORM_COLOR map | LiveRoom.tsx:17–24 | Reuse across panels. |
| `PlatformDot`, `QueueItem`, `IconButton` | LiveRoom.tsx:100–623 | Extract, reuse. |
| All inline SVG icons | LiveRoom.tsx:27–97 | Extract to shared icon file. |

### Reusable with extension

| Piece | Change needed |
|-------|--------------|
| `useCompositor` | Expose `fps` as React state (internal fpsRef already counts it). Add `localScreenTrack` as compositor input. |
| `page.tsx` (server) | Keep auth/ownership/session logic. Replace `<LiveRoom>` with `<Studio>`. Update header to match new top bar or remove it (top bar lives inside Studio). |

### Must be built from scratch

| Feature | Why it's missing |
|---------|-----------------|
| Visible composite preview | `useCompositor` canvas is headless. Need `<video autoPlay muted ref={v => v && (v.srcObject = stream)}/>` in center column. |
| Top bar layout | New component. Logo + FPS counter + disk counter + Clip/Record/Go Live. |
| Disk space counter | `navigator.storage.estimate()` — never called anywhere. |
| FPS counter (UI) | Compositor counts internally but only logs. Needs `useState` exposure. |
| Clip button | 30–60s rolling `MediaRecorder` ring buffer on composite stream. Download on click. |
| Record button | Full-session `MediaRecorder` → Blob accumulation → download link. |
| Scenes system | No scene concept exists. Need `scenes[]` array, `activeSceneId`, add/remove/switch. |
| Layers panel | No source abstraction. Currently sources are implicit (camera always on, screen if sharing, remoteUsers by Agora). Need explicit ordered `Layer[]` with add/remove/reorder. |
| Audio Mixer | No mixer UI at all. Need: `AnalyserNode` + `requestAnimationFrame` VU bars, `GainNode` fader, mute button, device selector (`enumerateDevices`), CUE, stereo link. |
| Right sidebar icon strip | New nav component. Switches between: transitions, source-props, chat, stream-info, settings. |
| Stream info panel | Uptime timer, active destinations, participant count. |
| Source properties panel | Per-source settings. Placeholder initially. |
| Scene transitions panel | Transition type picker. Placeholder initially. |
| Studio store (Zustand) | No global store exists. Needed for scenes, layers, audio mixer config, right panel selection, shared mic/cam/streaming state. |

### Full gap summary

| Feature | Status |
|---------|--------|
| Agora camera/mic | ✅ done |
| Screen share | ✅ done |
| Canvas compositor (logic) | ✅ done |
| WebSocket relay | ✅ done |
| ffmpeg fan-out | ✅ done (server-side) |
| Chat feed | ✅ done (needs move) |
| Participant queue | ✅ done (needs move) |
| Go Live button + flow | ✅ done (needs move) |
| Mic/cam toggles | ✅ done (needs move) |
| Socket event wiring | ✅ done (needs move) |
| Composite preview (visible) | ❌ missing |
| Top bar layout | ❌ missing |
| Disk space counter | ❌ missing |
| FPS counter in UI | ❌ missing |
| Clip button | ❌ missing |
| Record button | ❌ missing |
| Scenes system | ❌ missing |
| Layers panel | ❌ missing |
| Audio Mixer | ❌ missing |
| Right sidebar icon strip | ❌ missing |
| Stream info panel | ❌ missing |
| Source properties panel | ❌ missing |
| Scene transitions | ❌ missing |
| Studio store | ❌ missing |
