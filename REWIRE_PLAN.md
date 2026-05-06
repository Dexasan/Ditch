# Studio Rewire Plan

## Route strategy

The existing `/c/[slug]/live` page stays **completely untouched** throughout construction. The new studio builds at a new route: **`/c/[slug]/studio`**.

When we're done (all parts confirmed working), we rename `studio` → `live` in one final step. Until then, both routes coexist — `/live` for the old control room, `/studio` for the work-in-progress.

The new `studio/page.tsx` is a copy of `live/page.tsx` with identical server-side auth/ownership/session logic. The only difference is what it renders: `<Studio>` instead of `<LiveRoom>`.

---

## Store decision

**No existing store to extend.** All state in `LiveRoom.tsx` is local `useState`. The new studio layout — scenes, layers, audio mixer config, right panel switching, shared mic/cam state — has too many panels with interdependent state to keep everything local.

**Decision: new Zustand store at `lib/studio-store.ts`.**

It does NOT replace the socket singleton (`lib/socket.ts`) — that stays as-is. It does NOT touch anything in the existing LiveRoom. It is additive.

The store is introduced in **Part 3** (when Go Live moves to the top bar and `streamingEnabled` must be read by both the top bar and the compositor). Parts 1 and 2 don't need it yet.

```ts
// lib/studio-store.ts (introduced in Part 3)
interface StudioStore {
  // Streaming
  streamingEnabled: boolean;
  streaming: boolean;          // relay confirmed "started"
  streamError: string | null;
  setStreamingEnabled: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setStreamError: (v: string | null) => void;

  // Media controls (mic/cam live in audio mixer)
  micEnabled: boolean;
  camEnabled: boolean;
  toggleMic: () => void;
  toggleCam: () => void;

  // Compositor feedback
  fps: number;
  setFps: (n: number) => void;

  // Scenes
  scenes: Scene[];
  activeSceneId: string;
  addScene: () => void;
  switchScene: (id: string) => void;

  // Layers (sources in active scene)
  layers: Layer[];
  addLayer: (type: LayerType) => void;
  removeLayer: (id: string) => void;
  reorderLayers: (from: number, to: number) => void;

  // Right sidebar
  rightPanel: "chat" | "stream-info" | "source-props" | "transitions" | "settings" | null;
  setRightPanel: (p: StudioStore["rightPanel"]) => void;

  // Recording
  isRecording: boolean;
  isClipping: boolean;
}
```

`Scene` and `Layer` types are defined in `packages/types/src/index.ts` before the store is written (per project convention).

---

## Full piece-by-piece mapping

### Top bar (new)

**What lives here:**

| Old location | Piece | New location |
|-------------|-------|-------------|
| `page.tsx` `<header>` | DITCH logo link | Top bar left |
| `LiveRoom.tsx:252–257` | `goLiveLabel` + streaming state | Top bar right (Go Live button) |
| `LiveRoom.tsx:308–325` | Streaming status badge (LIVE / Connecting) | Inside Go Live button or adjacent |
| nowhere | FPS counter | Top bar center (from `useCompositor` exposed state) |
| nowhere | Disk space counter | Top bar center (`navigator.storage.estimate()`) |
| nowhere | Clip button | Top bar right (before Go Live) |
| nowhere | Record button | Top bar right (before Go Live) |

**Go Live wiring (unchanged logic, new location):**
- `streamingEnabled` state moves to `useStudioStore`
- The button reads `streaming` from `useRelayStream` (via store)
- The three-state label logic (`"Go live"` / `"Connecting…"` / `"End stream"`) is identical, just in the top bar component
- `useRelayStream` is still called in the root `<Studio>` component (it needs the composite stream from `useCompositor`)

---

### Left sidebar — Layers + Scenes (new)

**What lives here:**

| Old location | Piece | New location |
|-------------|-------|-------------|
| `LiveRoom.tsx` | Screen share toggle (`isScreenSharing`, `toggleScreenShare`) | Layers panel — "Screen Capture" layer row, toggle visibility |
| `LiveRoom.tsx` | Camera always-on | Layers panel — "Camera" layer row |
| nowhere | Image/Text source types | Layers panel — add source menu |
| nowhere | Scenes list | Scenes panel |

**Layers model:** Each `Layer` in the active scene maps to one compositor draw call. Order in the array = draw order (index 0 = bottom, last = top). The compositor's `getLayout()` function is extended to accept a `layers[]` array instead of hardcoded local/remote assumptions.

**What does NOT move here:**
- Participant slots — those are driven by the WebRTC participant flow (Agora remote users + socket events), not manually added sources. Participants remain in the stream info panel.

---

### Center canvas (new)

**What lives here:**

| Old location | Piece | New location |
|-------------|-------|-------------|
| `LiveRoom.tsx:360–417` | 2×2 participant slot grid | Removed. Participants now visible through composite only. |
| nowhere | Composite preview | `<video autoPlay muted ref={v => { if (v) v.srcObject = compositeStream }}/>` |
| `LiveRoom.tsx:326–357` | Stage header strip with tiny cam thumbnail | Removed. Preview canvas IS the preview. |

The composite preview is a `<video>` element (not `<canvas>`) for simplicity. `useCompositor` returns a `MediaStream` — setting `video.srcObject` on it shows the live compositor output at zero additional compute cost. The canvas itself stays headless inside the hook.

16:9 is enforced with `aspect-ratio: 16/9` and `object-fit: contain` on the video, constrained by the center column's available height.

---

### Right sidebar — icon strip + panels (new)

**Icons and what they open:**

| Icon | Panel | What goes in it |
|------|-------|----------------|
| Transitions | `transitions` | Scene transition type picker (placeholder first) |
| Source properties | `source-props` | Settings for the selected layer (placeholder first) |
| Chat | `chat` | Existing chat feed + send form (moved from LiveRoom right aside) |
| Stream info | `stream-info` | LIVE uptime timer, active destinations, participant queue |
| Settings gear | `settings` | Placeholder initially |

**Chat wiring (unchanged logic, new location):**
- `messages` state + `setMessages`, `chatBody`, `sendChat()` move to the `<Studio>` component
- The chat JSX (`messages.map(...)` + form) copies into `<ChatPanel>` exactly as-is
- Socket event `chat:message` listener stays identical — just wired in Studio instead of LiveRoom

**Participant queue (moved to stream-info):**
- `waiting`, `approved`, `liveParticipants` derived state moves here
- `QueueItem` component is extracted and imported by `<StreamInfoPanel>`
- `changeParticipantStatus()` function and its socket emit are identical — just called from StreamInfoPanel

---

### Audio Mixer (new)

**What lives here:**

| Old location | Piece | New location |
|-------------|-------|-------------|
| `LiveRoom.tsx:202–213` | `toggleMic()`, `toggleCam()` | Audio mixer "Creator Mic" and "Creator Camera" track cards |
| `LiveRoom.tsx:421–438` | Mic, cam, screen icon buttons | Audio mixer mute toggles |
| nowhere | Volume faders | GainNode per track, AudioContext from useCompositor |
| nowhere | VU meters | AnalyserNode per track + rAF draw loop |
| nowhere | Device selector | `navigator.mediaDevices.enumerateDevices()` |
| nowhere | CUE / stereo link | Placeholder initially |

**Web Audio graph extension:**  
`useCompositor` already creates an `AudioContext`. The audio mixer needs to tap into each track before it reaches the destination:

```
localAudioTrack → createMediaStreamSource → GainNode → analyserNode → destination
remoteUser.audioTrack → createMediaStreamSource → GainNode → analyserNode → destination
```

The `GainNode` per track gives the fader its control. The `AnalyserNode` drives the VU meter bars via `getByteFrequencyData()` + `requestAnimationFrame`.

The audio mixer introduces a thin `useAudioMixer` hook that owns this graph and returns per-track `{ gainNode, analyserNode, muted, setMuted, gain, setGain }` per track ID.

---

## Dependency diagram for the new Studio component

```
Studio (root client component)
├── useAgoraRoom          ← unchanged
├── useCompositor         ← unchanged + fps exposed
├── useRelayStream        ← unchanged
├── useStudioStore        ← new Zustand store
├── socket event wiring   ← moved from LiveRoom
│
├── <TopBar>              — logo, fps, disk, clip, record, go-live
├── <LeftSidebar>
│   ├── <LayersPanel>     — source list + add button
│   └── <ScenesPanel>     — scene list + add button
├── <PreviewCanvas>       — <video srcObject={compositeStream}/>
├── <RightIconStrip>      — icon buttons → setRightPanel
├── <RightPanel>          — switches between chat/stream-info/etc
│   ├── <ChatPanel>       — moved from LiveRoom right aside
│   ├── <StreamInfoPanel> — moved from LiveRoom left aside (queue)
│   ├── <SourcePropsPanel>— placeholder
│   ├── <TransitionsPanel>— placeholder
│   └── <SettingsPanel>   — placeholder
└── <AudioMixer>          — new, useAudioMixer hook
```

---

## Build order

Each part is confirmed working before starting the next.

---

### Part 1 — Layout shell

**Route:** `/c/[slug]/studio`  
**Files to create:** `apps/web/src/app/c/[slug]/studio/page.tsx`, `studio/Studio.tsx`

- Copy `live/page.tsx` server logic verbatim (auth, ownership, session fetch). Swap `<LiveRoom>` → `<Studio>`.
- `Studio.tsx`: dark grid with labelled placeholder divs. No logic. No hooks.
- Grid structure:
  - Top bar (fixed height ~44px)
  - Middle row: left sidebar (220px) + center (flex-1) + right icon strip (44px)
  - Bottom: Audio Mixer panel (collapsed by default, ~180px expanded)
- Left sidebar: two stacked panels with "Layers" and "Scenes" labels.
- Center: black div with "Preview Canvas" label.
- Right strip: 5 icon placeholders.
- Bottom: "Audio Mixer" header with + and chevron.

**Verify:** Navigate to `/c/[slug]/studio`. See the grid. Existing `/c/[slug]/live` unchanged.

---

### Part 2 — Camera preview into center canvas

**Files to touch:** `studio/Studio.tsx`

- Call `useAgoraRoom` (same config as LiveRoom — UID 999, role host, publish true).
- Call `useCompositor` (same inputs, `enabled: true` always initially).
- Render `<PreviewCanvas stream={compositeStream} />` in the center column.
- `PreviewCanvas` is `<video autoPlay muted className="w-full h-full object-contain bg-black" ref={...} />`.
- No Go Live wiring yet — compositor runs but relay doesn't.

**Verify:** Camera shows live in the center canvas. No stream going out. FPS logs in console.

---

### Part 3 — Go Live button into top bar

**Files to touch:** `studio/Studio.tsx`, `studio/TopBar.tsx` (new), `lib/studio-store.ts` (new)

- Create `useStudioStore` with `streamingEnabled`, `streaming`, `streamError`, `setStreamingEnabled`.
- Move `useRelayStream` call to `Studio.tsx` root. Pass `enabled` from store.
- Wire `streaming` + `streamError` back into store via effects.
- `TopBar` reads `streamingEnabled`/`streaming` from store. Button calls `store.setStreamingEnabled(v => !v)`.
- Three-state label logic is identical to LiveRoom.

**Verify:** Go Live button in top bar starts the stream. LIVE badge appears. End stream stops it. Old `/live` route still works.

---

### Part 4 — Scenes + Layers panel

**Files to touch:** `studio/Studio.tsx`, `studio/LeftSidebar.tsx`, `lib/studio-store.ts`

- Add `scenes[]`, `activeSceneId`, `layers[]` to store.
- `LayersPanel`: shows one `Layer` row per source (Camera, Screen Capture — mapped from `isScreenSharing`).
- Each row: source type icon, name, eye toggle (visible/hidden), drag handle (static for now).
- Clicking Camera eye toggle calls existing `localVideoTrack.setEnabled()`.
- Clicking Screen row calls existing `toggleScreenShare()`.
- `ScenesPanel`: single scene by default ("Scene 1"). Add button adds a new scene. Clicking switches `activeSceneId`.
- Scene switching resets compositor inputs (initially no cross-fade — instant cut).

**Verify:** Layer visibility toggling works. Scene switching creates a blank scene and switches back.

---

### Part 5 — Audio Mixer

**Files to touch:** `studio/AudioMixer.tsx` (new), `hooks/useAudioMixer.ts` (new)

- `useAudioMixer` taps into `localAudioTrack` and `remoteUsers` audio tracks.
- Creates a `GainNode` + `AnalyserNode` per track, routed between source and compositor's destination.
- Returns per-track: `{ gainNode, analyserNode, muted, setMuted, gain, setGain, deviceLabel }`.
- `AudioMixer` renders one card per track:
  - Track name (from source type or participant display name)
  - Two vertical `<canvas>` VU bars (rAF draws `getByteFrequencyData`)
  - dB number (derived from peak frequency data)
  - Horizontal `<input type="range">` fader (0–2, default 1) → sets `gainNode.gain.value`
  - MUTE button → disconnects GainNode from destination (goes red)
  - Device selector: `enumerateDevices()` filtered to `audioinput`, dropdown triggers `localAudioTrack.setDevice(id)` for the creator mic
  - CUE and stereo link buttons: visual-only (placeholder) initially
- Collapse chevron hides all cards, shows only the header row.

**Verify:** VU meters animate with voice. Fader changes volume in the stream. Mute button silences.

---

### Part 6 — Right sidebar

**Files to touch:** `studio/Studio.tsx`, `studio/RightPanel.tsx` (new), `studio/panels/*.tsx` (new)

- `RightIconStrip`: 5 icon buttons, each calls `store.setRightPanel(id)`. Active icon highlighted.
- `RightPanel` renders the active panel or `null` (strip-only when nothing selected).
- **ChatPanel**: exact copy of LiveRoom's right aside. Chat state (`messages`, `chatBody`) moves to Studio root, passed as props. Socket event wiring (`chat:message`) already in Studio.
- **StreamInfoPanel**: uptime timer (`Date.now() - sessionStartedAt`), participant queue (waiting + approved rows with `QueueItem`). Socket events `participant:queue_update` + `participant:status_change` already in Studio. `changeParticipantStatus()` identical.
- **SourcePropsPanel**: placeholder "Select a source to edit".
- **TransitionsPanel**: placeholder "Scene transitions coming soon".
- **SettingsPanel**: placeholder initially.

**Verify:** Clicking chat icon opens chat. Clicking stream info shows live uptime and participant queue. Approve/remove buttons work.

---

### Part 7 — Polish pass

Only after Parts 1–6 are confirmed working:

- **Record button**: `MediaRecorder` on `compositeStream`, chunks accumulated in array, `Blob` download link on stop.
- **Clip button**: 30s rolling buffer — ring array of 250ms chunks (120 chunks = 30s), download last N on click.
- **FPS counter**: Expose fps from `useCompositor` via `setFps` in store. Render in top bar.
- **Disk space counter**: `navigator.storage.estimate()` → `(usage/quota * 100).toFixed(0) + "%"` in top bar.
- **Drag to reorder layers**: `@dnd-kit/core` on the layers list.
- **Scene transitions**: Fade implemented as opacity cross-blend on compositor canvas between scene switches.
- **Empty states**: "No sources — add one with +" for Layers. "No scenes" guard.
- **Flip `/live` to Studio**: rename `/studio` → `/live`, delete old `LiveRoom.tsx`.

---

## What does NOT change

| Piece | Reason |
|-------|--------|
| `useAgoraRoom` | Hook interface is stable. Just called from Studio root instead of LiveRoom. |
| `useRelayStream` | No change at all. Same props, same WebSocket protocol. |
| Relay server (`apps/relay`) | Server-side. Not touched. |
| Socket.IO event names | Same events, same payloads, same socket singleton. |
| API routes | No changes to `apps/api`. |
| DB schema | No changes to Supabase. |
| `AgoraVideoTile` | Still used for participant video display inside StreamInfoPanel or stage overlays. |
| `lib/api.ts`, `lib/agora.ts` | Unchanged. |
| ChannelView (`/c/[slug]`) | Viewer page. Not touched. |
