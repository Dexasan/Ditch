# DITCH — Claude Code Context

## What is DITCH

DITCH is a **video-first live platform**: go live once, stream everywhere, bring viewers back into one interactive space.

Three things at once:
1. **Multi-stream gateway** — one RTMP source pushed to Twitch, YouTube, TikTok, Kick, and others simultaneously. DITCH is the origin, so platform cross-streaming restrictions don't apply.
2. **Interaction hub** — the creator's DITCH channel is the live control center. Viewers from any platform can enter and become on-screen participants, broadcast back across all destinations.
3. **Participatory ad network** — brands sponsor participant slots. Real humans, voluntarily present, live across all platforms simultaneously.

**Core growth loop:** viewer finds stream on Platform X → moves to DITCH channel → appears live on stream → inspires others → audience acquires itself.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript throughout |
| Web frontend | Next.js 14 (App Router) |
| API server | Fastify (Node.js) |
| Realtime server | Socket.io (Node.js) |
| Database | Supabase (Postgres + Auth + RLS) |
| Shared types | `@ditch/types` workspace package |
| DB client | `@ditch/db` workspace package |

---

## Project Structure

```
ditch/
├── apps/
│   ├── web/          @ditch/web      Next.js frontend — channel pages, creator dashboard, viewer experience
│   ├── api/          @ditch/api      REST API — auth, sessions, destinations, participants
│   └── realtime/     @ditch/realtime Socket.io — chat aggregation, participant signaling, stream state
├── packages/
│   ├── types/        @ditch/types    Shared TypeScript domain types (used by all apps)
│   └── db/           @ditch/db       Supabase client factory (browser-safe + server admin)
├── .env.example                      Copy to .env, fill in Supabase credentials
├── turbo.json
├── pnpm-workspace.yaml
└── CLAUDE.md
```

### Port assignments
- `3000` — web (Next.js dev server)
- `3001` — realtime (Socket.io)
- `3002` — api (Fastify)

---

## Key Domain Concepts

**Channel** — a creator's live home base on DITCH. Has a unique `slug` (URL). The channel is always present; sessions come and go.

**LiveSession** — one broadcast event. A creator starts a session → it becomes `live` → they end it → status becomes `ended`. Each session can have multiple destinations and participants.

**StreamDestination** — a platform (Twitch, YouTube, etc.) that the session is being pushed to via RTMP. RTMP credentials (stream key) are stored server-side only, never returned to the browser.

**Participant** — a viewer who has moved from watching passively to appearing on stream. Flow: `waiting` (requested) → `approved` (creator accepted) → `live` (on screen, assigned a slot) → `removed`.

**ChatMessage** — a message from any connected platform, normalized into one shape and pushed to the creator's unified chat view via the realtime server.

**StreamPlatform** — `"twitch" | "youtube" | "tiktok" | "kick" | "ditch"`. `"ditch"` means the message/participant originated natively inside DITCH.

---

## Environment Setup

```bash
# Install dependencies
pnpm install

# Copy env file and fill in Supabase credentials
cp .env.example .env

# Start all services in dev mode
pnpm dev
```

Supabase credentials come from your Supabase project dashboard:
- `SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_URL` — Project URL
- `SUPABASE_ANON_KEY` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `anon` public key
- `SUPABASE_SERVICE_ROLE_KEY` — `service_role` key (server-side only, never expose)

For local Supabase dev (optional): `supabase start` via the Supabase CLI.
Generate TypeScript types from local schema: `pnpm --filter @ditch/db generate-types`.

---

## Phase 1 Scope

The goal of Phase 1 is a working end-to-end session: creator authenticates, configures destinations, goes live, viewers join the DITCH channel, chat is unified, participants can request and be placed on stream.

**API routes** (`apps/api`):
- `POST /auth/signup` / `POST /auth/signin`
- `GET /channels/:slug`
- `POST /sessions` — start a live session
- `PATCH /sessions/:id` — update session state
- `DELETE /sessions/:id` — end session
- `GET|POST /sessions/:id/destinations` — manage RTMP destinations
- `DELETE /sessions/:id/destinations/:did`
- `GET /sessions/:id/participants`
- `PATCH /sessions/:id/participants/:pid` — approve or remove

**Realtime events** (`apps/realtime`):

| Direction | Event | Purpose |
|-----------|-------|---------|
| Client → Server | `join-channel` | Viewer enters a channel |
| Client → Server | `chat-message` | Viewer sends a DITCH chat message |
| Client → Server | `participant-request` | Viewer requests to appear on stream |
| Client → Server | `participant-approve` | Creator approves a participant |
| Client → Server | `participant-remove` | Creator removes a participant |
| Server → Room | `stream-update` | Session state / participant slots changed |
| Server → Creator | `participant-queue` | Updated waiting list |
| Server → Room | `chat-ingest` | Normalized message from any platform |

**Web pages** (`apps/web`):
- `/` — landing / marketing
- `/auth` — sign up / sign in
- `/dashboard` — creator's home, start/end sessions, manage destinations
- `/c/[slug]` — public channel page (viewer + participant experience)
- `/c/[slug]/live` — creator's live control room

---

## Architectural Decisions

**Why Supabase for auth?** Supabase Auth handles JWT issuance, session refresh, and email verification out of the box. The API server validates Supabase JWTs rather than maintaining its own auth system.

**Why a separate realtime server?** Socket.io has state (rooms, connected sockets) that doesn't map cleanly to serverless. Keeping it as a standalone Node process avoids cold starts and enables persistent room management.

**Why `@ditch/types` as source-only (no build step)?** All consumers (Next.js, Fastify, Socket.io server) are TypeScript and resolve types directly. No emit needed, no stale dist to manage.

**RTMP credentials** are never returned from the API to the browser. Only `StreamDestination` shape without `rtmp_url`/`stream_key` is sent to clients. Server holds credentials and passes them to the media relay layer.

---

## Conventions

- All database column names use `snake_case` (Postgres convention).
- All TypeScript interfaces mirror the DB column names directly — no camelCase conversion at the boundary.
- Supabase RLS policies enforce that users can only read/write their own channels and sessions. The `supabaseAdmin` client (service role) is used only in trusted server-side contexts.
- Socket.io rooms are named by `channel_slug`. Joining a channel = joining that room.
- When adding a new entity, define the type in `packages/types/src/index.ts` first, then build the DB table and API route.

---

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
