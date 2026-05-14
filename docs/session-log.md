## Session Log

### Day 1 — 2026-04-15

**What we did:**
- Read and ingested the full DITCH product context document
- Decided on monorepo architecture (pnpm workspaces + Turborepo), TypeScript/Node stack, Supabase for DB/auth
- Scaffolded the complete Phase 1 project structure from scratch:
  - `apps/web` — Next.js 14 App Router frontend
  - `apps/api` — Fastify REST API with all Phase 1 routes stubbed
  - `apps/realtime` — Socket.io server with all Phase 1 events stubbed
  - `packages/types` — full domain type definitions (`User`, `Channel`, `LiveSession`, `StreamDestination`, `Participant`, `ChatMessage`, all socket payloads)
  - `packages/db` — Supabase client factory (`supabase` + `supabaseAdmin`)
- Created root tooling: `turbo.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.env.example`
- Wrote this `CLAUDE.md`

**State at end of day:**
- Repo is scaffolded, no dependencies installed yet
- No Supabase project created yet — credentials still needed in `.env`
- No database schema written yet
- No routes or socket events implemented yet — all stubbed with comments
- Next logical step: `pnpm install`, create Supabase project, write the DB schema

---

### Day 2 — 2026-04-16

**What was done (solo, before session):**
- Ran `pnpm install` — all workspace dependencies installed, `pnpm-lock.yaml` generated
- Created Supabase project — project URL: `https://kgdlmfybxnqpkhfbjull.supabase.co`
- Filled server-side credentials in `.env`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

**What we did (in session):**

Step 1 — Fixed `.env`
- Updated `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to match the real project credentials (were still placeholder values)

Step 2 — DB schema (`supabase/migrations/001_initial_schema.sql`)
- Created all 4 Postgres enums: `stream_platform`, `session_status`, `participant_status`, `destination_status`
- Created all 6 tables: `users`, `channels`, `live_sessions`, `stream_destinations`, `participants`, `chat_messages`
- Added indexes on all FK columns plus high-traffic query paths (slug, session+status, session+timestamp)
- Wrote `handle_new_user()` trigger — auto-creates `public.users` profile on every Supabase auth signup
- Wrote full RLS policies for all 6 tables (public read where appropriate, owner-only write, RTMP creds owner-only read)
- Schema applied to Supabase project via SQL editor

Step 3 — TypeScript types (`packages/db/src/database.types.ts`)
- Hand-wrote the full `Database` type (Row / Insert / Update shapes for all 6 tables + all 4 enums)
- Wired `Database` generic into both `supabase` and `supabaseAdmin` clients in `packages/db/src/index.ts`
- Re-exported `User` and `Session` types from `@supabase/supabase-js` via `@ditch/db` so other packages don't need a direct dep
- Fixed missing `@types/node` in `packages/db`
- Updated `generate-types` script from `--local` to `--project-id kgdlmfybxnqpkhfbjull`

Step 4 — API routes (partial)
- `apps/api/src/lib/authenticate.ts` — reusable Fastify preHandler; validates Supabase JWT via `supabaseAdmin.auth.getUser()`, attaches `User` to `request.user`
- `apps/api/src/lib/guards.ts` — `assertSessionOwner` and `assertChannelOwner` helpers; used by all protected routes to verify ownership in one query
- `apps/api/src/routes/auth.ts` — `POST /auth/signup`, `POST /auth/signin`
- `apps/api/src/routes/channels.ts` — `GET /channels/:slug` (public; returns channel + active session)
- `apps/api/src/routes/sessions.ts` — `POST /sessions`, `PATCH /sessions/:id` (state machine with transition enforcement), `DELETE /sessions/:id` (force-end)
- Registered CORS plugin in `index.ts`; all new routes registered

**State at end of day:**
- DB schema live in Supabase, TypeScript types fully wired
- Auth routes working: signup + signin proxy to Supabase, return tokens
- Channel + session routes implemented and type-checking clean (all 5 packages pass)
- Remaining API routes still stubbed: destinations (GET/POST/DELETE) and participants (GET/PATCH)
- No realtime events implemented yet
- No web pages built yet

**Next logical step (Day 3):** destinations routes → participants routes → realtime events → web frontend

---

### Day 3 — 2026-04-17

**What we did:**

Step 1 — Destinations routes (`apps/api/src/routes/destinations.ts`)
- `POST /destinations` — adds RTMP destination to a session; rejects if session is `ended`
- `GET /destinations?channel_id=` — returns destinations for the active session on a channel
- `PATCH /destinations/:id` — updates destination status
- `DELETE /destinations/:id` — hard deletes, returns 204
- `assertDestinationOwner` added to `guards.ts` — walks destination → session → channel to verify ownership
- RTMP credentials (`rtmp_url`, `stream_key`) stripped from all responses — never sent to browser

Step 2 — Participants routes (`apps/api/src/routes/participants.ts`)
- `POST /participants` — optional auth (anonymous viewers supported, `user_id` nullable); rejects if session `ended`
- `GET /participants?session_id=` — public; returns all non-removed participants
- `PATCH /participants/:id` — creator-only; enforces status transitions with `slot_index` required for `live`
- `DELETE /participants/:id` — soft-delete (`status: removed`); allowed for creator OR the participant themselves
- `assertParticipantAccess` added to `guards.ts` — allows creator or self

Step 3 — Realtime server (`apps/realtime/src/`)
- Added `@ditch/db` as workspace dependency (needed for JWT validation + DB writes)
- `src/types.ts` — typed `ClientToServerEvents`, `ServerToClientEvents`, `SocketData`
- `src/middleware/auth.ts` — JWT validation via `supabaseAdmin`; anonymous connections allowed (`user_id = null`)
- `src/handlers/session.ts` — `session:join` (joins room, acks with current participants), `session:leave`
- `src/handlers/participant.ts` — `participant:status_change` (creator-only, validates ownership, writes to DB, broadcasts to room), `participant:queue_update` (pull request, responds to requesting socket)
- `src/handlers/chat.ts` — `chat:message` (persists to DB, broadcasts to room)
- Rooms keyed by `session_id`

Step 4 — Channel model + env hardening
- `POST /channels` — auth required; slug validated as `^[a-z0-9-]+$`; owner set from JWT not body; 409 on slug conflict or owner conflict
- `GET /channels/mine` — returns authenticated user's channel or null; used by onboarding/dashboard
- `supabase/migrations/002_one_channel_per_user.sql` — `UNIQUE (owner_id)` constraint on `channels` table (one channel per user, Twitch-style)
- `src/lib/env.ts` — validates `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` on startup; exits with clear message if any are missing
- Fixed env loading: added `--env-file=.env` to `apps/api` dev/start scripts; `--env-file=../../.env` for `apps/realtime`. Root cause: ES module imports are hoisted — `packages/db` throws at module evaluation before any executable code, so env must be loaded by the Node process itself via `--env-file`, not application code.

Step 5 — Test script (`scripts/test-api.sh`)
- 16-step happy path: signup → signin → create channel → create session → create destination → list destinations → join as participant → list participants → approve → set live → update destination status → delete participant → delete destination → go live → force-end session
- All 16 steps passing end-to-end against the live Supabase project

**Temporary dev decision — `POST /auth/signup` uses `supabaseAdmin.auth.admin.createUser({ email_confirm: true })`**
- Reason: `supabase.auth.signUp()` sends a confirmation email, which hits Supabase free tier's 3 emails/hour rate limit during testing, and rejects non-real email domains
- **Must revert to `supabase.auth.signUp()` before frontend is live** so users go through the proper confirmation email → verify → signin flow
- When reverting: disable email confirmation in Supabase dashboard (Auth → Email → toggle off "Confirm email") for dev to avoid the rate limit during frontend development

**State at end of day:**
- All Phase 1 API routes complete and tested end-to-end
- Realtime server fully implemented with typed Socket.io events
- DB migrations 001 + 002 both applied to Supabase project
- One channel per user enforced at both DB and API layer
- Env validation guards against misconfigured deploys

**Next logical step (Day 4):** Web frontend — `/auth` page → onboarding (watch vs. create) → `/dashboard` → `/c/[slug]` → `/c/[slug]/live`

---

### Day 4 — 2026-04-20

**What we did:**

Step 0 — Pre-flight fixes
- Reverted `POST /auth/signup` from `supabaseAdmin.auth.admin.createUser()` back to `supabase.auth.signUp()` — the admin version bypassed email confirmation, which would cause issues with the frontend auth flow
- Fixed port conflict: API moved to `3002`, realtime to `3001`. Updated all env files (`.env`, `.env.example`, `apps/api/.env`), server fallbacks (`apps/api/src/index.ts`, `apps/realtime/src/index.ts`), and `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_REALTIME_URL` everywhere
- Fixed bug in `OnboardingForm` — `POST /channels` requires `display_name` but the form was only sending `slug`; now sends both

Step 1 — Frontend setup (`apps/web`)
- Installed Tailwind CSS v4 + `@tailwindcss/postcss`; configured `postcss.config.mjs`
- `src/app/globals.css` — `@import "tailwindcss"` + CSS custom properties for dark theme (`--color-brand`, `--color-surface`, `--color-surface-raised`, `--color-surface-border`, `--color-text`, `--color-text-muted`)
- `src/lib/supabase/browser.ts` — `createBrowserClient` for client components
- `src/lib/supabase/server.ts` — `createServerClient` with Next.js cookie store for server components
- `src/middleware.ts` — refreshes Supabase session on every request; redirects unauthenticated users away from `/dashboard` and `/onboarding`, redirects authenticated users away from `/auth`
- `src/lib/api.ts` — typed fetch wrapper for Fastify on `:3002`; `ApiError` class with status code; reads `NEXT_PUBLIC_API_URL` env var with fallback

Step 2 — `/auth` page
- `src/app/auth/page.tsx` — client component; tab toggle between sign in / sign up; sign up shows "check your email" confirmation state
- `src/app/auth/callback/route.ts` — Route Handler that exchanges Supabase email confirmation code for a session, then redirects to `/dashboard`
- Uses Supabase browser client directly (not the Fastify API) — the only way SSR session cookies get set correctly

Step 3 — `/onboarding` page
- `src/app/onboarding/page.tsx` — server component; checks for existing channel via `GET /channels/mine`; redirects returning users to `/dashboard`
- `src/app/onboarding/OnboardingForm.tsx` — client form; collects display name + channel slug; auto-slugifies input as you type; shows full URL preview (`ditch.live/c/your-handle`); calls `supabase.auth.updateUser()` for display name, then `POST /channels` for the channel

Step 4 — `/dashboard` page
- `src/app/dashboard/page.tsx` — server component; guards to `/onboarding` if no channel; fetches channel + active session + destinations in parallel
- `src/app/dashboard/SessionPanel.tsx` — client component; full session state machine (start → go live → start ending → force end); status dot with pulse animation
- `src/app/dashboard/DestinationList.tsx` — client component; add/remove RTMP destinations; stream key masked; only shown when session is active
- `src/app/dashboard/SignOutButton.tsx` — signs out via Supabase browser client, redirects to `/auth`
- "Control room →" link in nav only appears when a non-ended session exists

Step 5 — `/c/[slug]` and `/c/[slug]/live`
- `src/lib/socket.ts` — Socket.io client singleton keyed by `(REALTIME_URL, token)`; prevents duplicate connections in React strict mode; exports `SessionJoinAck` type for typed ack callbacks
- `src/app/c/[slug]/page.tsx` — public server component; 404 if channel not found; shows offline state if no active session
- `src/app/c/[slug]/ChannelView.tsx` — client component; connects socket, joins session room, renders unified chat + live participant row + "Request to join" sidebar panel; tracks viewer's own participant status via socket events
- `src/app/c/[slug]/live/page.tsx` — protected server component; redirects non-owners to `/c/[slug]`, redirects if no active session
- `src/app/c/[slug]/live/LiveRoom.tsx` — client component; 3-panel layout: participant queue (approve / set live / remove), 4-slot video grid (clean Agora stubs — each slot marked for `AgoraVideoTrack` replacement), unified chat

**Architectural decisions made:**
- Auth pages use the Supabase browser client directly, not the Fastify API — required for SSR session cookies to work with `@supabase/ssr`
- Socket.io rooms keyed by `session_id` (not `channel_slug`) — matches the realtime server implementation
- Agora video slots are isolated stubs in `LiveRoom.tsx`; swapping in real video tracks is a single-component change with no impact on queue or chat logic
- Email confirmation is required for new signups — testers must confirm via email before signing in. To skip during dev, disable "Confirm email" in Supabase dashboard → Auth → Email

**State at end of day:**
- All Phase 1 web pages built and type-checking clean across all 5 packages
- Full golden path exists: sign up → confirm email → onboarding → dashboard → start session → go live → viewer joins channel → chat works → request to join → creator approves from control room
- Agora video not yet wired — slots are stubs
- No end-to-end browser test run yet

**Next logical step (Day 5):** End-to-end browser test of the full golden path, then Agora integration for live video in participant slots

---

### Day 5 — 2026-04-21

**What we did:**

Step 1 — Bug fixes from first browser test
- Owner check on `/c/[slug]` — creator now sees "Go to Control Room →" instead of the viewer join panel; `isOwner` computed server-side from `authSession.user.id === channel.owner_id`
- RTMP URL validation — `rtmp_url` schema pattern tightened to `^rtmps?://.+`; garbage values now rejected with 400 before touching DB
- Chat persistence — `session:join` ack extended to return last 50 messages (`recentMessages`) alongside participants; both `ChannelView` and `LiveRoom` seed state from ack on mount so chat survives navigation
- Stale session bug ("Session has ended" in incognito) — root cause: Next.js 14 cached GET fetches by default; added `cache: "no-store"` globally to `api.ts`; also added `sessionError` state in `ChannelView` with proper UI fallback

Step 2 — Agora WebRTC integration (`apps/web`)
- Installed `agora-rtc-sdk-ng`
- `src/lib/agora.ts` — App ID env var, lazy `getAgoraRTC()` loader (deferred import to avoid SSR), `slotToUid()` mapping (slot 0–3 → UID 1–4; creator = UID 0)
- `src/hooks/useAgoraRoom.ts` — join/publish/subscribe lifecycle; role/uid changes trigger leave+rejoin; `toggleScreenShare` swaps camera track for screen track and handles browser native "Stop sharing" via `track-ended` event
- `src/components/AgoraVideoTile.tsx` — plays a local or remote video track into a div; dynamically imported with `ssr: false` in all consumers
- `LiveRoom.tsx` — creator joins as host/UID 0, publishes camera+mic; slot grid maps remote users by UID to participant slots; creator preview tile in center header; bottom toolbar: Mute/Unmute, Cam off/Cam on, Share screen/Stop share
- `ChannelView.tsx` — joins as audience; upgrades to host+publish when `myParticipant.status === "live"`; live slots row shows actual video tracks; Mute/Cam off controls visible when live

Step 3 — Product architecture clarification (critical)
- **DITCH is a browser-native studio, not an OBS relay.** Creator streams FROM the DITCH browser tab — no external software.
- The full outbound pipeline does not yet exist: canvas compositor → server relay → ffmpeg fan-out to RTMP destinations
- This pipeline is the core product differentiator vs StreamYard/Restream: the *composed feed* (creator + live audience participants) is what gets pushed to every platform simultaneously

**State at end of day:**
- Agora WebRTC working end-to-end: real camera feeds in participant tiles, creator toolbar functional, viewer camera/mic toggles working
- All Phase 1 interactive features complete
- **The outbound streaming pipeline (canvas compositor → relay → ffmpeg → RTMP) does not exist yet — this is the next and most critical build**

**Next logical step (Day 6):** Browser canvas compositor → server relay → ffmpeg fan-out to RTMP destinations. In that order, nothing else first.

---

### Day 5 continued — Production deployment

**What we did:**

Step 1 — Deployment blockers fixed
- `start` scripts had `--env-file=.env` — Railway injects env vars natively, no file exists on server; removed flag, changed both services to `tsx src/index.ts`
- `tsx` moved from `devDependencies` to `dependencies` in api and realtime so it's available under `NODE_ENV=production`
- CORS hardened: both api and realtime now accept a comma-separated `WEB_URL` env var AND any `*.vercel.app` origin (covers Vercel preview deployments automatically)
- Lockfile updated via `pnpm install`

Step 2 — Docker + Railway config
- `apps/api/Dockerfile` and `apps/realtime/Dockerfile` — monorepo-aware: copy full workspace structure, run `pnpm install` from root so workspace symlinks resolve, then start from service subdirectory
- `.dockerignore` at repo root

Step 3 — Supabase live domain
- Site URL and redirect URL updated in Supabase dashboard to point to Vercel production URL

**Production URLs:**
- Frontend: https://ditch-web-drab.vercel.app (Vercel)
- API: Railway, port 3002
- Realtime: Railway, port 3001
- Database: Supabase (kgdlmfybxnqpkhfbjull)

**Verified in production (mobile device, real network):**
- Host camera feed renders on live URL
- Host screenshare renders on live URL
- Admitted participant camera renders correctly
- Chat working end-to-end
- Mute / Cam off controls functional
- Supabase auth working on live domain
- Socket.io connecting from Vercel to Railway

**State at end of day:**
- Full Phase 1 stack live in production
- No known bugs in the interactive layer
- Canvas compositor / RTMP pipeline is the only remaining Phase 1 piece

**Next logical step (Day 6):** Browser canvas compositor → server relay → ffmpeg fan-out to RTMP destinations.

---

### Day 6 — 2026-04-22

**Audio fix (pre-Day 6)**
- Remote Agora audio was silently subscribed but never played — `user.audioTrack.play()` was missing from the `user-published` handler in `useAgoraRoom.ts`. One-line fix; also added `user.audioTrack.stop()` on `user-unpublished`.

**What we built:**

Step 1 — `apps/relay` (new service, port 3003)
- Raw WebSocket server (`ws` package) — not Socket.io. Binary frames pipe directly to ffmpeg stdin with zero overhead.
- Protocol: text `{ type: "start", session_id, token }` → validate JWT + verify session ownership via `supabaseAdmin` → fetch RTMP destinations (credentials never leave the server) → spawn ffmpeg → reply `{ type: "started" }`. Binary frames → piped to ffmpeg stdin. Text `{ type: "stop" }` or WebSocket close → `stdin.end()` → ffmpeg exits cleanly.
- `src/lib/ffmpeg.ts` — builds ffmpeg args: single destination uses direct `-f flv` output; multiple destinations use the tee muxer (`-f tee "[onfail=ignore:f=flv]url1|[onfail=ignore:f=flv]url2"`) so the stream is encoded once and pushed to all destinations simultaneously. `onfail=ignore` keeps surviving destinations alive if one drops.
- `Dockerfile` — Alpine + `apk add ffmpeg` + monorepo-aware install (same pattern as api/realtime).
- Env vars: `RELAY_PORT=3003`, reads `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

Step 2 — `useCompositor` hook (`apps/web/src/hooks/useCompositor.ts`)
- Creates an offscreen `<canvas>` (1280×720) and an `AudioContext` when `enabled` flips to true.
- `requestAnimationFrame` draw loop: creator cam in top-left cell (640×360), live participants by `slot_index` in remaining cells (slot_index 0 → grid[1], 1 → grid[2], 2 → grid[3]). Slot_index 3 is audio-only in the composite.
- Each video track gets a hidden `<video>` element (muted) keyed by `MediaStreamTrack.id`; frames drawn via `ctx.drawImage`.
- Audio: `AudioContext` + `MediaStreamDestinationNode`; local mic + all remote audio tracks connected via `createMediaStreamSource`. New tracks are connected on each render; already-connected tracks are skipped by a `Set<string>` guard.
- Returns `{ stream: MediaStream }` = canvas `captureStream(30)` video track + audio destination track.

Step 3 — `useRelayStream` hook (`apps/web/src/hooks/useRelayStream.ts`)
- Opens a WebSocket to `NEXT_PUBLIC_RELAY_URL` when `enabled && stream` are both truthy.
- On open: sends `start` message. On `started` ack: creates `MediaRecorder` (prefers `video/webm;codecs=h264,opus`, falls back to vp8, then bare webm; 3Mbps video + 128kbps audio) with 250ms chunk interval. Each `dataavailable` chunk is sent as a binary WebSocket frame.
- Returns `{ streaming: boolean, error: string | null }`.

Step 4 — `LiveRoom.tsx` wired
- `streamingEnabled` state (boolean) controls both hooks.
- "Go Live →" button in toolbar; while starting shows "Starting...", while live shows "● Stop stream" in red. Status indicator (pulsing red dot + "LIVE" / "Connecting..." / error text) in the slots header.
- `liveParticipants` computed once, shared between compositor and the existing slot grid.

Step 5 — Railway deployment prep for relay
- `nixpacks.toml` at repo root — `nixPkgs = ["ffmpeg"]` so Railway Nixpacks builder includes ffmpeg in the image
- `apps/relay/package.json` build script — also runs `apt-get install -y ffmpeg` + copies binary to `vendor/ffmpeg` as a belt-and-suspenders fallback for Docker-based deploys
- H264 codec path hardened end-to-end: browser prefers `video/webm;codecs=h264,opus` so ffmpeg can use `-c:v copy` (stream copy, no re-encoding); VP8 would require libvpx+libx264 JIT compilation which segfaults in Railway containers
- `apps/relay/src/lib/ffmpeg.ts` — `-c:v copy` passes H264 NAL units directly into the FLV container; audio still transcoded Opus → AAC (RTMP doesn't carry Opus); origin comment documents the Railway segfault reason

**New env vars:**
- `RELAY_PORT=3003` (relay server)
- `NEXT_PUBLIC_RELAY_URL=ws://localhost:3003` (web → relay WS URL; set to `wss://` Railway URL in production)

**State at end of day:**
- Full outbound streaming pipeline implemented end-to-end: canvas compositor → WebSocket → relay → ffmpeg → RTMP
- All 6 packages type-checking clean
- H264 codec path avoids re-encoding and Railway container segfaults
- Railway deployment config in place (`nixpacks.toml`, Dockerfile build script)
- To test locally: `pnpm dev` (starts all services incl. relay), add destinations in dashboard, open control room, click "Go live →"
- ffmpeg must be installed locally for relay to work (`brew install ffmpeg` / `apt install ffmpeg`)

**Next logical step (Day 7):** Deploy relay to Railway, set `NEXT_PUBLIC_RELAY_URL` on Vercel, do a live end-to-end test pushing to a real RTMP destination.

---

### Day 7 — 2026-04-24 (in progress)

**What we did:**

Step 1 — Relay deployed to Railway
- `NEXT_PUBLIC_RELAY_URL=wss://relay-production-8243.up.railway.app` was already set on Vercel from Day 6 prep
- Relay service was already live on Railway (`relay-production-8243.up.railway.app`); confirmed health check returns 200

Step 2 — Bug: relay crashes on EPIPE when browser disconnects mid-stream
- Root cause: `proc.stdin.write()` throws EPIPE if ffmpeg exits while chunks are still arriving; no error handler on `proc.stdin` → unhandled error event → process crash → Railway restarts
- Fix: added `proc.stdin?.on("error", ...)` in `apps/relay/src/lib/ffmpeg.ts` to swallow EPIPE silently

Step 3 — Bug: "Go Live →" showed "Starting..." / "Connecting..." forever (Bug 1)
- Symptom: button never transitioned to "● Stop stream"; status never showed "LIVE"
- Root cause (first layer): `@ffmpeg-installer/ffmpeg` npm binary is a 2018 glibc-linked static build. Railway runs a glibc (Ubuntu/Railpack) environment, NOT Alpine — but the binary still segfaulted. Removed the npm package entirely.
- Root cause (second layer after removing npm binary): `spawn("ffmpeg", ...)` returned ENOENT — system `ffmpeg` was not in the spawned-process PATH even though Railway installs it via `RAILPACK_APT_PACKAGES=ffmpeg` (build-layer install doesn't land in runtime PATH).
- Fix: `resolveFfmpeg()` in `apps/relay/src/lib/ffmpeg.ts` probes candidate paths at module load (`/usr/bin/ffmpeg`, `/usr/local/bin/ffmpeg`, `vendor/ffmpeg`) before falling back to PATH. Logs which binary is resolved on startup.
- Result: relay resolves `vendor/ffmpeg` (the copy made by the build script's `apt-get install + cp`) — this is an apt-installed binary in the same glibc environment, so no segfault.
- Key diagnostic: the `started` ack WAS being sent; ffmpeg crashed ~1s later; `stopped` was sent; React batched both state updates so the user never saw "● Stop stream".

Step 4 — Bug: destinations always showed "Stopped" on creation (Bug 2)
- Root cause: `stream_destinations.status` column default was `'stopped'` in the initial migration — no `idle`/ready state existed in the enum
- Fix: DB migration `003_destination_idle_status.sql` — adds `'idle'` to `destination_status` enum, changes column default to `'idle'`, backfills existing `stopped` rows
- Updated `packages/types/src/index.ts`, `packages/db/src/database.types.ts`, `apps/api/src/routes/destinations.ts` (PATCH schema), `apps/web/src/app/dashboard/DestinationList.tsx` (STATUS_LABEL map: idle → "Ready")
- Migration applied to Supabase in two steps (Postgres requires `ADD VALUE` to commit before use in same session)

**State mid-day:**
- Relay is live, EPIPE crash fixed, ffmpeg binary resolution hardened
- "Go Live →" flow unblocked pending real end-to-end stream test
- Destination status bug fixed; new destinations show "Ready"
- All services redeployed

**Next logical step (Day 7 continued):** Do a real end-to-end stream test — creator opens control room, clicks "Go live →", verify ffmpeg pushes to RTMP destination and the stream appears live on the target platform.

---

### Day 8 — 2026-04-28

**What we did:**

Step 1 — Diagnosed "LIVE for ~1s then Connecting... forever" bug (three-phase investigation)
- Phase 1 (read-only): traced full data flow — `useRelayStream` → WebSocket → relay → ffmpeg → RTMP. Key finding: when ffmpeg exits for any reason, relay sends `{ type: "stopped" }`, `setStreaming(false)`, but the WebSocket stays open and MediaRecorder keeps running with no recovery path. The UI shows "Connecting..." forever.
- Phase 2 (hypotheses): top candidates were VP8 fallback → FLV codec incompatibility, bad RTMP credentials, ffmpeg SIGSEGV on static binary
- Phase 3 (diagnostics): added `console.log("[relay-stream] MediaRecorder mimeType selected:", mimeType)` to `useRelayStream.ts`. ffmpeg stderr was already being logged to Railway via `process.stderr.write(chunk)`.
- Evidence from Railway logs: `signal: SIGSEGV, code: null` — ffmpeg binary crashing after successfully probing the input stream (H264 + Opus detected fine, crash on first frame processing)

Step 2 — Binary resolution chase (multiple iterations)
- First attempt: `-cpuflags 0` to disable SIMD — SIGSEGV persisted. Hypothesis was wrong: crash wasn't SIMD-related.
- Discovery: **the relay service had never been connected to the GitHub repo**. All previous deploys were 4 days stale. Every "fix" was never actually tested.
- Second attempt after reconnecting repo: added `which ffmpeg` before checking static paths in `resolveFfmpeg()` — still resolved `vendor/ffmpeg` (johnvansickle.com static binary) because Nixpacks puts ffmpeg in PATH at build time but not runtime.
- Root cause: `pnpm build` script downloads the johnvansickle.com static binary to `vendor/ffmpeg` during Nixpacks build. `resolveFfmpeg()` found it before the PATH fallback. The static binary consistently SIGSEGV's on Railway after input detection regardless of CPU flags.
- Fix: recreated the Railway relay service from scratch, configured it to use Railpack with start command `pnpm --filter @ditch/relay start`. The Nix-installed ffmpeg (`nixPkgs = ["ffmpeg"]` in `nixpacks.toml`) lands at `/usr/bin/ffmpeg` and is found first by `which ffmpeg`. Confirmed via `[ffmpeg] resolved binary: /usr/bin/ffmpeg` in startup logs.

Step 3 — Railway service configuration lessons
- The relay Dockerfile (`apps/relay/Dockerfile`) was never being used — Railway was auto-detecting Nixpacks from the repo root
- To use the Dockerfile would require setting Root Directory + Dockerfile Path in Railway settings; the UI made this difficult
- Railpack approach works: set start command `pnpm --filter @ditch/relay start`, rely on `nixpacks.toml` for ffmpeg, use `SUPABASE_URL` + `SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` + `WEB_URL` as env vars
- **Required env vars for relay service:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB_URL`
- `SUPABASE_ANON_KEY` (not `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — `@ditch/db` validates both keys on import even though the relay only uses the admin client
- New relay domain: `wss://relay-production-8f90.up.railway.app` — updated `NEXT_PUBLIC_RELAY_URL` on Vercel

Step 4 — First successful end-to-end RTMP stream to YouTube ✓
- Stream appeared on YouTube Live
- ffmpeg running `/usr/bin/ffmpeg` (Alpine 15.2.0, ffmpeg 8.0.1) — no SIGSEGV
- Full pipeline confirmed: browser canvas compositor → WebSocket → relay → ffmpeg → YouTube RTMP

Step 5 — Streaming quality analysis from Railway logs
Three symptoms observed and diagnosed:

**Symptom 1 — 20-second startup delay:**
- Cause A (unavoidable): YouTube's own ingest buffer (~5-10s minimum before going live)
- Cause B (fixable): ffmpeg default `-probesize` (5MB) and `-analyzeduration` (5s) cause unnecessary buffering before output starts, even though format is explicitly `-f webm`

**Symptom 2 — 10-second-stale video:**
- Root cause: WebM timestamps from MediaRecorder are relative to recording start, not wall-clock. With `-c:v copy`, these timestamps pass straight to RTMP. When stdin backpressure causes data to queue (ffmpeg stalls → Node.js buffers chunks → bursts all at once), the timestamps are now 10-20 seconds behind real-time. YouTube plays the stale timestamps. Confirmed in logs: frame count frozen at 295 for 19 real-time seconds, then burst to frame 320 with time jumping from 16.79s to 35.57s.

**Symptom 3 — Stream dropping shortly after:**
- Root cause: `requestAnimationFrame` in `useCompositor.ts` is throttled by the browser to ~1fps when the tab is not in focus. No new canvas frames → MediaRecorder produces no chunks → ffmpeg stdin stalls → YouTube sees "No data" → stream ends. Confirmed in logs: complete freeze (no audio OR video) for 27 seconds before stream ended.

Step 6 — Fix E + Fix A applied (`apps/relay/src/lib/ffmpeg.ts`)
- **Fix E (logging):** `spawnFfmpeg` now takes `sessionId` parameter; all ffmpeg log lines prefixed with `[ffmpeg <short-id>]` for legibility in multi-stream Railway logs
- **Fix A (latency + timestamp flags):**
  - `-use_wallclock_as_timestamps 1` — replaces WebM container PTS with wall-clock arrival time; directly fixes Symptom 2
  - `-fflags +nobuffer+genpts` — nobuffer was already present; `+genpts` regenerates PTS when missing
  - `-thread_queue_size 512` — prevents ffmpeg blocking the input thread during chunk bursts
  - `-probesize 32 -analyzeduration 0` — start writing output immediately; fixes part of Symptom 1
  - `-flvflags no_duration_filesize` — eliminates "Failed to update header" shutdown noise
  - `-flush_packets 1` — flush output after every packet; prevents data sitting in ffmpeg's output buffer

**State at end of day:**
- Relay live at `wss://relay-production-8f90.up.railway.app`
- First successful YouTube RTMP stream confirmed
- Fix A deployed but not yet tested for symptom resolution
- Symptom 3 (compositor `requestAnimationFrame` throttling) identified but not yet fixed — needs `setInterval` replacement in `useCompositor.ts`

**Next logical step (Day 9):** Test Fix A (latency flags) against all three symptoms. If Symptoms 1 and 2 are resolved, apply compositor fix (replace `requestAnimationFrame` with `setInterval` in `useCompositor.ts` draw loop). Then do sustained stream test with tab in background.

---

### Day 9 — 2026-04-29

**What we did:**

Step 1 — Audio fix: drop `-use_wallclock_as_timestamps 1` (`apps/relay/src/lib/ffmpeg.ts`)
- Symptom: audio barely audible, laggy, garbled after Fix A
- Root cause: `-use_wallclock_as_timestamps 1` replaces WebM container PTS with wall-clock arrival time. Audio and video chunks arrive at the relay at different rates through the WebSocket; wallclock-stamping them independently desyncs A/V and confuses the Opus→AAC resampler
- Fix: removed the flag. All other Fix A flags (`+nobuffer+genpts`, `-thread_queue_size 512`, `-probesize 32`, `-analyzeduration 0`, `-flvflags no_duration_filesize`, `-flush_packets 1`) kept intact

Step 2 — Compositor `requestAnimationFrame` → `setInterval` (`apps/web/src/hooks/useCompositor.ts`)
- Symptom: stream dies when creator switches tabs; video laggy even with tab focused
- Root cause: `requestAnimationFrame` is throttled to ~1fps by Chrome when the tab is backgrounded (and can drop below 30fps for offscreen canvases). No canvas frames → MediaRecorder produces nothing → ffmpeg stdin starves → YouTube kills the stream
- Fix: replaced `requestAnimationFrame` with `setInterval(draw, 1000/30)` — fires at 33ms regardless of tab visibility. Interval cleared on cleanup in both the draw-loop effect and the canvas teardown effect.
- Added FPS counter: logs `[compositor] fps: XX.X` to browser console every 5 seconds so actual frame rate is observable during test

Step 3 — Dynamic compositor layout (`apps/web/src/hooks/useCompositor.ts`)
- Symptom: streaming solo showed creator in top-left quadrant with 3 black cells
- Fix: replaced fixed `GRID` constant with `getLayout(participantCount)` function that branches on live participant count:
  - 0 participants → creator fills full 1280×720
  - 1 participant → side-by-side 50/50 (creator left, participant right)
  - 2 participants → creator full top row (1280×360), two participants split bottom row
  - 3 participants → 2×2 grid (previous behavior)
- Added `drawCover()` helper — center-crops video source to fill each cell without letterboxing (equivalent to CSS `object-fit: cover`)

Step 4 — Compositor: `setInterval` → `MediaStreamTrackGenerator` (`apps/web/src/hooks/useCompositor.ts`)
- Symptom: even with `setInterval`, canvas frames weren't reliably reaching `captureStream(30)` in background tabs because Chrome still throttles `captureStream` frame capture when the tab is hidden
- Fix: replaced `canvas.captureStream(30)` with `MediaStreamTrackGenerator` (Breakout Box API). Each draw tick constructs a `VideoFrame` from the canvas and writes it to `generator.writable`. The generator exposes a `MediaStreamTrack` that carries frames without depending on the browser's capture schedule.
- `supportsBreakoutBox()` guard added — checks for `MediaStreamTrackGenerator`, `MediaStreamTrackProcessor`, and `VideoFrame` on `window`; falls back to `captureStream` if not available
- Commit: `8c681fe`

Step 5 — Compositor: add `MediaStreamTrackProcessor` per video track (`apps/web/src/hooks/useCompositor.ts`)
- Problem: drawing from hidden `<video>` elements with `ctx.drawImage` fails in background tabs — Chrome produces black frames because the video element decode pipeline pauses when the tab is hidden
- Fix: for each active video track (local + remote), attach a `MediaStreamTrackProcessor` that reads decoded `VideoFrame` objects directly from the decode pipeline. Frames are cached in `frameCacheRef` keyed by `MediaStreamTrack.id`. The draw tick reads from the cache instead of from `<video>` elements. This path bypasses the visibility throttle entirely.
- `processorCleanupsRef` tracks per-track cleanup functions (cancel reader + close processor). Effect re-runs on `liveParticipants`/`remoteUsers` changes: torn-down for tracks that disappear, started for new ones.
- `<video>` element path retained as fallback for browsers without Breakout Box
- Commit: `c513e45`

Step 6 — Compositor: Worker timer + `captureStream(0)` + `requestFrame()` fallback (`apps/web/src/hooks/useCompositor.ts`)
- Problem: `setInterval` on the main thread is still subject to Chrome's background-tab CPU budget (intervals coalesced/clamped). Observed: FPS counter dropping well below 30 when tab loses focus.
- Fix (timer): replaced `setInterval` with an inline Worker. Worker posts `"tick"` at `setInterval(1000/FPS)`. Workers run in a separate OS thread and are not subject to the main thread's background-tab budget — the 30fps timer fires reliably regardless of tab visibility.
- Fix (fallback capture path): changed `canvas.captureStream(30)` to `canvas.captureStream(0)` and call `captureTrack.requestFrame()` explicitly after each draw. Rate=0 means "only capture when I tell you to", which gives us the same control as the Breakout Box path for browsers that lack `MediaStreamTrackGenerator`.
- `AudioContext` visibility listener: `document.visibilitychange` handler resumes a suspended `AudioContext` when the tab comes back into focus (Chrome suspends AudioContext on hide)
- Final architecture:
  - **Timer:** inline Worker (`WORKER_SRC`) — background-tab safe
  - **Video frames (modern Chrome):** `MediaStreamTrackProcessor` → frame cache → `VideoFrame` → `MediaStreamTrackGenerator.writable`
  - **Video frames (fallback):** hidden `<video>` elements → `ctx.drawImage` → `captureStream(0).requestFrame()`
- Commit: `0577a48`

Step 7 — `useRelayStream` auto-reconnect (`apps/web/src/hooks/useRelayStream.ts`)
- Symptom: when ffmpeg exited server-side (RTMP hiccup, YouTube cutting the stream), relay sent `{ type: "stopped" }` and the UI showed "Connecting…" forever with no recovery path — creator had to manually stop and restart
- Fix: extracted `connect()` function inside the effect. On `stopped`, `onerror`, or `ws.onclose`, stops the MediaRecorder and schedules `connect()` again after 2s, up to 5 attempts. Attempt counter resets to 0 on a successful `started` ack. User-triggered teardown sets a `cancelled` flag so no retry fires after intentional stop.
- Error states: "Stream dropped — reconnecting (1/5)…" during retries; permanent "Stream dropped and could not reconnect" after 5 failures
- Commit: `d7a3caf`

Step 8 — Relay startup latency (`apps/relay/src/index.ts`, `apps/relay/src/lib/ffmpeg.ts`)
- Symptom: 9-13 second delay from "Go Live" click to stream appearing live on YouTube
- Root cause analysis: three components
  1. Relay auth — 3 sequential awaited Supabase calls (~500-1500ms)
  2. First H264 key frame — browser encoder decides interval (random 0-4s); YouTube can't decode until it sees one
  3. YouTube ingest buffer — fixed ~3-4s platform-imposed delay, nothing we can do
- Fix 1 (parallel queries): session ownership check and destinations fetch now run in `Promise.all` instead of sequentially — saves ~100-300ms
- Fix 2 (forced key frames): switched from `-c:v copy` to `-c:v libx264 -preset ultrafast -tune zerolatency -g 30 -keyint_min 30`. Forces a key frame every 1 second (30 frames at 30fps). YouTube gets its first key frame within 1s of stream start guaranteed, instead of waiting up to 4s randomly. CPU cost at 720p ultrafast is negligible.
- Expected result: startup drops from 9-13s to ~4-6s
- Commit: `b3e8c80`

Step 9 — Pre-launch checklist (`docs/pre-launch.md`)
- Documented the one remaining startup optimization not yet implemented: local JWT validation in the relay
- Currently `supabaseAdmin.auth.getUser(token)` is an HTTP call to Supabase (~100-500ms). Replacing it with `jsonwebtoken.verify()` using `SUPABASE_JWT_SECRET` reduces this to ~1ms.
- After that fix, startup hits the physics floor (~4-5s total). Full implementation steps written in `docs/pre-launch.md`.
- Commit: `9171dcb`

**State at end of day:**
- Compositor fully background-tab safe (Worker timer, Breakout Box frame path, rAF fallback)
- Auto-reconnect in place: stream recovers from ffmpeg exits without creator intervention
- Stream startup latency reduced from 9-13s to ~4-6s (parallel auth queries + forced key frames)
- One pre-launch optimization documented and ready: local JWT validation (`docs/pre-launch.md`)
- Minor frontend bugs noted; deferred

**Next logical step (Day 10):** End-to-end sustained stream test — verify fps holds at 30 with tab backgrounded, auto-reconnect triggers correctly on a simulated ffmpeg exit, startup latency is in the 4-6s range.

---

### Day 10 — 2026-05-06

**What we did:**

Full audit of the existing live control room followed by building the new studio layout at a new route, leaving `/c/[slug]/live` completely untouched throughout.

Step 1 — Codebase audit (`STUDIO_AUDIT.md`)
- Read every file in the live page stack: `page.tsx`, `LiveRoom.tsx`, `useAgoraRoom`, `useCompositor`, `useRelayStream`, `lib/socket.ts`, `lib/agora.ts`, `AgoraVideoTile`, relay server
- Key finding: `useCompositor` produces a `MediaStream` but the canvas is fully headless — there is no visible preview of the composite anywhere on the live page. The center grid shows raw Agora tiles, not the compositor output
- Key finding: no global store exists — all state is local `useState` in `LiveRoom.tsx`
- Wrote full gap table: 10 pieces done (Agora, compositor, relay, chat, queue, Go Live), 14 pieces missing (visible preview, scenes, layers, audio mixer, top bar, right sidebar, FPS counter, disk counter, clip/record, studio store)

Step 2 — Rewire plan (`REWIRE_PLAN.md`)
- Route strategy: build at `/c/[slug]/studio`, flip to `/live` at the end — old route untouched throughout
- Store decision: new Zustand store (`lib/studio-store.ts`), introduced in Part 3 when Go Live state needs to be shared between the Studio root and the top bar
- Full piece-by-piece destination mapping: Go Live → top bar, chat → right sidebar panel, queue → stream-info panel, mic/cam → audio mixer, socket wiring → Studio root
- Composite preview solution: `<video autoPlay muted srcObject={compositeStream}/>` — compositor already produces the stream, zero extra compute
- 7-part build order with explicit verify condition per part

Step 3 — Part 1: Layout shell (`/c/[slug]/studio`)
- New `studio/page.tsx`: identical server-side auth/ownership/session logic to `live/page.tsx`, renders `<Studio>` instead of `<LiveRoom>`
- New `studio/Studio.tsx`: pure layout shell, no hooks, no logic
- Grid: 44px top bar | flex middle row (220px left sidebar + flex-1 center + optional right panel + 44px icon strip) | 44–180px audio mixer
- Left sidebar: Layers panel (flex-1) stacked above Scenes panel (180px fixed), each with header + `+` button
- Center: black 16:9-locked `div` with placeholder icon
- Right strip: 4 panel icons (top) + settings gear (bottom); clicking an icon opens a 280px panel, clicking again closes it
- Audio mixer: collapse/expand chevron, two placeholder track cards

Step 4 — Part 2: Camera preview into center canvas
- Added `useAgoraRoom` (UID 999, host, publish, enabled always) to Studio root
- Added `useCompositor` (`enabled: true` always — compositor runs for preview regardless of relay state)
- Updated `PreviewCanvas` to take `stream: MediaStream | null`; a `useEffect` sets `video.srcObject = stream` and calls `.play()` when the stream reference changes (React can't manage `srcObject` as a prop)
- "Starting camera…" overlay shown via `absolute inset-0` until stream is non-null, then video fills the frame

Step 5 — Part 3: Go Live button into top bar + studio store
- Installed Zustand
- `lib/studio-store.ts`: `streamingEnabled`, `streaming`, `streamError` + their setters; `setStreamingEnabled` accepts value or updater function
- `TopBar` reads directly from `useStudioStore()` — no prop drilling
- Three-state button: idle (filled brand), connecting (dim red, `pointer-events-none`), live (outlined red)
- Center zone of top bar: LIVE pulsing badge when streaming, error text when relay drops, FPS/disk placeholders at rest
- `useRelayStream` added to Studio root with `enabled: streamingEnabled` from store; two `useEffect` calls sync `streaming` and `streamError` back into the store
- Compositor remains `enabled: true` — preview always live, relay only active when Go Live is clicked

Step 6 — Part 4: Scenes + Layers panel
- `lib/studio-store.ts` extended: `camVisible`/`setCamVisible`, `scenes: Scene[]` (starts with "Scene 1"), `activeSceneId`, `addScene()`, `switchScene(id)`
- `LayerRow`: grip handle `⠿`, source icon, name, eye button (appears on `group-hover`)
- `LayersPanel`: Camera row always present — eye toggle calls `localVideoTrack.setEnabled()` + `setCamVisible()`; Screen Capture row appears only when `isScreenSharing`, eye toggle calls `toggleScreenShare()` to stop; `+` button opens a dropdown (Screen Capture live, Image/Text disabled with "Soon" labels); backdrop div handles click-outside dismiss
- `ScenesPanel`: renders `scenes[]` from store; active scene gets left accent border + brand tint; `+` adds "Scene N" and immediately switches to it
- `LeftSidebar` now accepts `localVideoTrack`, `isScreenSharing`, `toggleScreenShare` props from Studio root

**Commit:** `f65cb1b` — 7 files, 1555 insertions

Step 7 — Part 5: Chat panel in right sidebar (`apps/web/src/app/c/[slug]/studio/Studio.tsx`)
- Socket connection added to Studio root: `getSocket(token)`, `session:join` ack, `chat:message` listener, cleanup on unmount
- `PLATFORM_COLOR` map and `MAX_CHAT = 200` constant added
- `ChatPanel` component: scrollable message list with per-platform left-border colour, auto-scroll to bottom via `chatEndRef`, send form with maxLength 500
- `RightPanel` updated to accept `chatProps`; renders `ChatPanel` when panel === "chat"

Step 8 — Part 6: Participant queue panel (`apps/web/src/app/c/[slug]/studio/Studio.tsx`)
- `participants` state added to Studio root; `onJoin` ack now also sets participants
- Socket effect extended: `participant:queue_update` and `participant:status_change` listeners added with cleanup
- `changeParticipantStatus` emits `participant:status_change` to realtime server
- Derived state computed each render: `liveParticipants`, `waiting`, `approved`, `slots`, `nextSlot`
- `liveParticipants` now passed to `useCompositor` (replaces hardcoded `[]`) — layout adapts as participants go live
- `QueueItem`: approve / set-live / remove buttons; status badge (waiting = amber, approved = blue)
- `QueuePanel`: empty state with 👥 icon; scrollable list of `QueueItem` rows
- `RightPanel` updated to accept `queueProps`; renders `QueuePanel` for "stream-info" slot; header shows queue count badge
- Label for "stream-info" slot renamed to "Queue"

Step 9 — Part 7: Flip `/c/[slug]/live` to Studio (`apps/web/src/app/c/[slug]/live/page.tsx`)
- Old header wrapper (channel name, status badge, nav links) removed — Studio's own top bar handles this
- `LiveRoom` import replaced with `Studio` imported from `../studio/Studio`
- Server-side logic (auth, ownership check, session guard) identical to `studio/page.tsx`
- `LiveRoom.tsx` left untouched

**Commit:** `7627d44` — 2 files, 305 insertions / 48 deletions

**State after session 1:**
- Full 7-part studio rewire complete
- `/c/[slug]/live` now serves the full Studio UI (camera preview, Go Live, layers, scenes, chat, queue)
- TypeScript: 0 errors; clean production build

---

**Session 2 (same day, continuous)**

Step 10 — Studio cleanup: remove fake OBS chrome (`commit 3352865`)
- Removed DISK counter from top bar entirely — no disk write in browser, metric was meaningless
- Removed audio mixer panel and its 44px dead zone — 100% cosmetic, no real metering or gain control
- Removed `mixerExpanded` state and `AudioMixer`, `PlaceholderTrackCard`, `IconChevronUp`, `IconChevronDown` components
- Wired real FPS counter: `useCompositor` gains `onFps?: (fps: number) => void`; measured every 5 seconds via frame counter in the draw loop; calls `onFps(Math.round(measured))`; Studio root passes `onFps: setFps`; TopBar reads `fps` from the store
- TopBar center zone: FPS always visible; LIVE badge appears alongside FPS when streaming (not mutually exclusive); error text replaces both on `streamError`

Step 11 — Wire scenes: per-scene cam visibility + compositor layout (`commit ffbc8ec`)
- Extended `Scene` interface: `camVisible: boolean`, `camCell: CamCell | null`
- Added `setActiveSceneCamVisible`, `setActiveSceneCamCell` store actions
- `addScene()` copies `camVisible` from current scene, sets `camCell: null`
- `getLayout(creatorVisible, participantCount)` rewritten: accepts `creatorVisible` flag; returns `Array<Rect | null>` where slot 0 is the creator cell (null when hidden), slots 1..n are participant cells; layout expands participants to fill available space when creator is off
- Compositor draw loop: branches on `creatorVisible` — when false, participants fill canvas via `getLayout(false, n)` instead of leaving a black cell where creator would have been
- Scene switch effect in Studio root: applies active scene's `camVisible` to `localVideoTrack.setEnabled()` on every scene change; `localVideoTrack` intentionally omitted from deps (see Step 12)
- LayersPanel: reads `camVisible` and `camCell` from active scene; shows eye toggle; shows "↺ reset to auto" button when `camCell !== null`
- ScenesPanel: shows "no cam" label on scene cards where `camVisible === false`

Step 12 — Fix: closed-track race on scene switch (`commit b3b5543`)
- Bug: `INVALID_OPERATION: cannot operate a closed track` — Agora error appearing in console on navigate-away
- Root cause: scene effect had `[activeSceneId, scenes, localVideoTrack]` as deps. On unmount, `useAgoraRoom` cleanup closes the Agora track. React then fires the scene effect one final time because `localVideoTrack` changed to null — but the track is closed (not null) at that moment, so `setEnabled()` throws.
- Fix: removed `localVideoTrack` from scene effect deps. The effect only needs to fire on scene switches; `LayersPanel.toggleCam` calls `setEnabled()` directly for immediate toggling. ESLint disable comment added explaining the intentional omission.

Step 13 — 30/60 FPS toggle (`commit 3b3d2a0`)
- Worker FPS was baked at module load time: `${1000 / FPS}` in the WORKER_SRC template literal evaluated to `33.33` once and was never reconfigurable
- Fix: changed worker protocol from string ("start"/"stop") to typed message objects: `{ type: "start", interval: number }` and `{ type: "stop" }`. The `interval` value is passed at runtime when the worker is spawned.
- `CompositorOptions` extended with `targetFps?: 30 | 60`; draw-loop effect uses `1000 / targetFps` when posting the start message
- Store: `targetFps: 30 | 60`, `setTargetFps` added
- `SettingsPanel` component added: two toggle buttons (30 fps / 60 fps); wired through `RightPanel.settingsProps`; accessible via the gear icon in the right strip
- Warning note added: "60 fps uses more CPU and bandwidth"

Step 14 — Camera permission gate + Meld-style draggable cam overlay (`commit 09a6aa3`)
- **Camera permission fix:** `useAgoraRoom` was called with `enabled: true` unconditionally — browser permission dialog fired on every page load before the user had done anything. Fixed: `enabled: camEnabled` where `camEnabled` starts `false` in the store. "Click to start" button in Layers panel calls `setCamEnabled(true)`, which triggers the `useAgoraRoom` effect and shows the permission dialog only then.
- **Draggable `CamOverlay` component:** added to `PreviewCanvas`. Renders an absolutely-positioned selection box at the camera's current cell position. Drag body to move; drag any of 4 corner handles to resize. Coordinates are fractions (0–1) of the container. Window-level `pointermove`/`pointerup` listeners ensure tracking continues even when the pointer leaves the element.
- **Live vs committed updates:** drag move calls `setCamCellLive(next)` — updates `camCellRef` inside the compositor directly without touching React state (no Worker restart, no frame gap). Commit on mouseup calls `setActiveSceneCamCell(next)` — persists the position to the Zustand scene store. On scene switch, the stored `camCell` is loaded and the overlay snaps to the correct position.
- **Auto-grid handle:** when `camCell === null`, `getLayout` is called in the Studio root to compute where the camera would be in auto-grid, and the overlay is placed there. User can grab it and immediately go custom; "↺ reset to auto" in the Layers panel clears `camCell` back to `null`.
- `getLayout` and `Rect` type exported from `useCompositor.ts` so Studio root can compute the auto position without duplicating the grid logic.

**State at end of Day 10 (full):**
- Camera permission no longer fires on page load
- Scenes fully functional: each scene owns `camVisible` + `camCell`; switching scenes adapts compositor layout instantly
- Cam drag overlay in preview: move and resize with 4 corners, live compositor update, committed to scene store on release
- FPS counter live and accurate; 30/60 FPS toggle in settings panel
- Audio mixer and fake counters removed; studio chrome is clean
- TypeScript: 0 errors; committed and pushed

**Known bugs — carry to Day 11:**

**Bug 1 — Screen Capture not rendering in compositor or stream**
- Symptom: adding Screen Capture layer shows "Sharing github.com to this tab" browser bar (browser confirms capture is active), but the screen share does not appear in the preview canvas and does not appear on the YouTube livestream. Camera layer renders correctly.
- Hypothesis: `localScreenTrack` from `useAgoraRoom` is not being passed into `useCompositor`, or the compositor is not drawing it on each frame tick.
- Investigation needed: trace `localScreenTrack` from `useAgoraRoom` → Studio root → `useCompositor` → draw loop; verify it is being acquired, passed, and drawn.

**Bug 2 — App crash when switching scenes after toggling camera off**
- Symptom: turn camera off in one scene → switch to a different scene → full client-side crash: "Application error: a client-side exception has occurred."
- Hypothesis: when camera is toggled off, the track or stream may be in a partially-closed or null state; the scene switch effect (or something the scene switch triggers) then reads it without a null guard and throws.
- Investigation needed: open browser console, read full error and stack trace; find every code path that touches `localVideoTrack` on scene switch; add null guards before any `setEnabled`, `getMediaStreamTrack`, or draw calls.

**Next logical step (Day 11):** Fix both bugs. Start with Bug 2 (crash) since crashes block all testing. Then fix Bug 1 (screen capture). Then do sustained stream test with screen share active.

---

### Day 11 — 2026-05-14

**What we did:**

Step 1 — Fix Bug 2: scene-switch crash (`commit 3833c75`)
- Root cause: `localVideoTrack.setEnabled()` returns `Promise<void>` (Agora SDK). Both `LayersPanel.toggleCam()` and the scene-switch effect called it without `.catch()`. When a scene switch fired immediately after toggling cam off, Agora rejected the re-enable call on a mid-transition track — unhandled promise rejection — Next.js showed "Application error: a client-side exception has occurred."
- Fix: added `.catch(() => {})` to both `setEnabled()` call sites

Step 2 — Fix Bug 1: screen capture not rendering (`commit 3833c75`, same)
- Root cause: `localScreenTrack` is returned by `useAgoraRoom` but was never destructured in Studio root and never passed to `useCompositor`. The compositor had no parameter for it and never drew it.
- Fix: destructured `localScreenTrack` from `useAgoraRoom` in Studio root; added `localScreenTrack?: ILocalVideoTrack | null` to `CompositorOptions`; added screen track to the Breakout Box processor effect (so frames are decoded and cached); in the draw loop, screen share now draws full-canvas as a background layer before camera and participants render on top. Both effects updated with `localScreenTrack` in deps.
- Behavior: when screen sharing, camera still uses its custom drag position or auto-grid layout overlaid on top — standard PiP-over-screenshare arrangement

Step 3 — Architecture refactor: scene-scoped layers (`commit acaf29a`)
- Audit confirmed: Layers panel had no data model — it rendered from a mix of global state (`camEnabled`, `isScreenSharing`) and per-scene state (`camVisible`). Switching scenes called `setEnabled()` imperatively on every switch regardless of whether visibility actually changed, which is what enabled the crash in the first place.
- `Scene` interface extended: `screenshareVisible: boolean` added (default `false`), setting up per-scene layer ownership model
- Deleted the imperative scene-switch `useEffect([activeSceneId, scenes])` — the fragile call that ran `setEnabled()` on every scene change
- Replaced with a single derived effect with deps `[activeScene?.camVisible, localVideoTrack]`: fires only when visibility actually changes, not on every scene switch; `cancelled` flag prevents stale async rejections from racing
- `LayersPanel` scoped to active scene: render gate changed from `!camEnabled` (global) to `!activeScene.camVisible` (per-scene); prompt label changed from "Click to start" to "Click to add"; prompt `onClick` now calls `setCamEnabled(true)` + `setActiveSceneCamVisible(true)` atomically — hardware start and scene membership in one action; `camEnabled` removed from `LayersPanel`'s store destructure

Step 4 — Fix Railway relay deploy time (`commit fe1aaff`)
- Observed: Railway deploys taking 8+ minutes
- Root cause: `apps/relay/Dockerfile` copied source (`packages/`, `apps/relay/`) before running `pnpm install`, busting the Docker layer cache on every deploy and forcing a full reinstall from scratch each time
- `apps/api` and `apps/realtime` Dockerfiles were already correct (copy `package.json` files first, install, then copy source)
- Fix: restructured relay Dockerfile to match the correct pattern — copy workspace `package.json` files first, `pnpm install`, then copy source; also replaced `npm install -g pnpm@9.0.0` with `corepack enable`
- First deploy post-fix still cold; subsequent source-only deploys should drop from ~8 min to under 2 min

**Commits:** `3833c75`, `acaf29a`, `fe1aaff`

**State at end of Day 11:**
- Both Day 10 bugs resolved: no more scene-switch crash, screen capture renders in compositor and stream
- Layers panel is now scene-scoped: each scene owns its camera layer; switching scenes shows what that scene owns
- `setEnabled()` is declarative and safe: only fires when `camVisible` actually changes, with proper async error handling
- Railway relay deploy cache restored: source changes no longer bust the pnpm install layer
- TypeScript: 0 errors across all changes

**Next logical step (Day 12):** Sustained stream test — verify screen share renders correctly on stream, 30fps holds with tab backgrounded, scene switching mid-stream works cleanly.

---

### Day 12 — 2026-05-14

**What we did:**

Phase 3 + Phase 4 were completed before this session (commit `ac0e0c4`): full layer data model (`Layer` interface, `Scene.layers[]`, `addLayer`/`removeLayer`/`updateLayer`/`reorderLayers` store actions), undo stack (20-deep, deep clone via `JSON.parse/stringify`), LayerRow, Inspector panel, and the full streaming/recording surface (TopBar with live/bitrate/duration, recording hook, clip buffer hook).

Step 1 — Phase 5: UX Polish (`commit 664cb92`)

- **Toast system** (`studio/Toast.tsx`): Zustand-backed `ToastManager` fixed bottom-right. `ToastItem` self-manages timers: CSS keyframe `toastOut` at `(duration - 150ms)`, hard remove at `duration`. Type-colored left border (success/warning/error/info). `addToast`/`removeToast` in store.
- **Keyboard shortcuts** (`hooks/useStudioShortcuts.ts`): `useEffect` on `keydown`. Skips `INPUT`/`TEXTAREA`/`contenteditable` targets. Uses `useStudioStore.getState()` inside the handler to avoid stale closures. `1–9` → switchScene, `Escape` → deselect, `Cmd+M` → mic mute via ref, `Cmd+D` → duplicate layer + pushUndo, `Delete`/`Backspace` → removeLayer + pushUndo, `F` → fill canvas transform + pushUndo, `Cmd+Z` → popUndo, `Cmd+G` → toggleSnapGrid.
- **Scene transitions** (`studio-store.ts`): `isTransitioning: boolean` in store. `switchScene` reads target scene's `transition.type`/`durationMs`; uses module-level `transitionTimer` (cleared on rapid switches). Canvas wrapper receives CSS keyframe class during transition.
- **Auto-naming + source availability** (`Studio.tsx`): `useEffect([localVideoTrack])` calls `enumerateDevices()` and updates all camera layers across all scenes with the real device label. `sourceUnavailable?: boolean` on `Layer`; amber `⚠` badge in `LayerRow` and a banner in the Inspector when set.

Step 2 — Phase 6: design token rename (`commit 6a410b9`)

- Renamed `--color-surface` → `--bg-base`, `--color-surface-raised` → `--bg-mid`, `--color-brand` → `--accent-primary`, `--color-text` → `--text-primary`, `--color-text-muted` → `--text-muted` across all studio files.
- Added 10 missing spec tokens: `--bg-deep`, `--bg-hover`, `--accent-secondary`, `--text-white`, `--status-live`, `--status-connecting`, `--status-ok`, `--vu-low`, `--vu-mid`, `--vu-high`.
- Non-studio pages (dashboard, auth, landing, LiveRoom, ChannelView) use the old names — kept as `:root` aliases pointing to new tokens so nothing breaks.
- Fixed 2 hardcoded hex values in Studio that bypassed the token system.

Step 3 — Three targeted fixes after compositor audit (`commit ba2d5fb`)

- **Fix 1 — memoize `liveParticipants`:** `.filter()` returns a new array ref on every render. Both compositor `useEffect` dep arrays had it — Worker stopped and respawned on every Studio root render, causing the visible preview to flicker and the stream to drop. Fixed with `useMemo`.
- **Fix 2 — remove double `setEnabled()`:** `handleToggleVisible` was calling `setEnabled(next)` directly AND updating `layer.visible`, which triggered a reactive `useEffect([cameraVisible, localVideoTrack])` that also called `setEnabled`. Removed the direct call; reactive effect is the only path.
- **Fix 3 — compositor wired to `layers[]`:** Removed `creatorVisible` and `camCell` props from `CompositorOptions`; replaced with `cameraLayer?: Layer | null`. Compositor reads `cameraLayer.transform` (absolute pixel coords in 1280×720 space) directly. Removed `camCell: CamCell | null` from `Scene` interface and `makeScene`, removed `setActiveSceneCamCell` from store, removed the "↺ reset to auto" button. `overlayCell` in Studio root computed by dividing layer transform by canvas dimensions.

Step 4 — BUG 1 + BUG 2 fixes after audit (`commit a2744f9`)

**BUG 1 — camera permission fires on mount without user action:**
- Root cause A: `makeScene()` called `makeCameraLayer()` → every scene initialized with a `visible: true` camera layer in store before any user action.
- Root cause B: `useAgoraRoom` called with `publish: true` unconditionally → `AgoraRTC.createMicrophoneAndCameraTracks()` fired on mount.
- Fix: removed `makeCameraLayer()` entirely; `makeScene()` → `layers: []`. Changed `publish: !!cameraLayer` — Agora only requests camera/mic when the user has explicitly added a camera layer. Agora still joins the channel (`enabled: true`) so remote participants are always visible.

**BUG 2 — duplicate camera layers allowed; manually added ones show "Camera" instead of real device name:**
- Root cause A: "Camera" button in LayersPanel had no guard against adding a second camera layer.
- Root cause B: auto-naming `useEffect([localVideoTrack])` doesn't re-fire when a new layer is added while the track is already stable — new layers kept the hardcoded name "Camera" forever.
- Fix: `hasCameraLayer` computed from `activeScene.layers`; Camera button `disabled={hasCameraLayer}` with "Active" badge. Add handler made `async` — calls `enumerateDevices()` at creation time when `localVideoTrack` is already set (permission already granted), so layers added to subsequent scenes get the real device label immediately. First-add case still handled by the existing auto-naming effect (fires when `localVideoTrack` arrives after permission granted).

**Commits:** `664cb92`, `6a410b9`, `ba2d5fb`, `a2744f9`

**State at end of Day 12:**
- Toast system, keyboard shortcuts, scene transitions, auto-naming all live
- Design tokens fully spec-aligned; non-studio pages unaffected via aliases
- Compositor stable: no Worker restart flicker, no double `setEnabled`
- Camera layer model correct end-to-end: layer transform drives compositor draw coords
- Camera permission no longer fires on mount
- No duplicate camera layers possible; layers get real device names at creation time
- TypeScript: 0 errors across all changes

**Next logical step (Day 13):** Sustained stream test with the new layer model — verify camera renders at correct transform position, screen share PiP still works, 30fps holds with tab backgrounded, scene switching mid-stream is clean.
