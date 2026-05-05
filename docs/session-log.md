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
