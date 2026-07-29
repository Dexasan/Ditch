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

## Current State (as of 2026-07-29)

**Phase 1 complete.** Full stack live in production.

**What's done:**
- All API routes implemented and tested (auth, channels, sessions, destinations, participants)
- Realtime server (Socket.io) — chat, participant queue, session state
- All web pages built — `/auth`, `/onboarding`, `/dashboard`, `/c/[slug]`, `/c/[slug]/live`
- Agora WebRTC — camera, mic, screenshare for creator and participants
- Canvas compositor (`useCompositor`) — background-tab safe via Worker timer + Breakout Box API
- Relay service (`apps/relay`, port 3003) — WebSocket → ffmpeg → RTMP fan-out
- Auto-reconnect in `useRelayStream` (5 attempts, 2s delay)
- Stream startup latency ~4-6s (parallel auth queries + forced H264 key frames)
- DB migrations 001–003 applied to Supabase

**Production URLs:**
- Frontend: https://ditch-web-drab.vercel.app (Vercel)
- API: Railway, port 3002
- Realtime: Railway, port 3001
- Relay: `wss://relay-production-8f90.up.railway.app` (Railway, port 3003)
- Database: Supabase (`kgdlmfybxnqpkhfbjull`)

**Relay env vars (Railway):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WEB_URL`
Note: `@ditch/db` requires both anon + service role keys even though relay only uses the admin client.

**Local JWT validation shipped (Jul 20, 2026):** `verifyAccessToken()` in `packages/db/src/auth.ts` verifies Supabase tokens locally (relay, api, realtime). This project uses Supabase **JWT Signing Keys**, so tokens are ES256 and are verified against the cached public JWKS derived from `SUPABASE_URL`; `SUPABASE_JWT_SECRET` only covers legacy HS256 projects. **Never revoke the legacy JWT secret** - the `anon`/`service_role` keys are signed with it. See `docs/pre-launch.md`.

**Browser-side key frame control shipped (Jul 25, 2026) — awaiting live verification:** `apps/web/src/lib/webcodecsRelay.ts` encodes H264 + Opus via WebCodecs/Mediabunny into fragmented MP4 with a guaranteed 2s key frame, streamed to the relay (`container: "mp4"`); `useRelayStream` probes capability at the real settings and falls back to MediaRecorder (`container: "webm"`) per-session on any failure. Relay picks the demuxer by container. YouTube/Twitch are **still transcoded** — `RELAY_REENCODE_PLATFORMS` (default `youtube,twitch`) makes moving a verified destination to `-c:v copy` a config change. Selectable **1080p** output is now enabled (compositor renders the 1280x720 design space scaled up). See `docs/pre-launch.md`.

**Agora token auth ENFORCED (Jul 29, 2026):** the Agora project has the Primary
Certificate enabled and "Unauthorised Access" disabled, so Agora rejects tokenless
joins. Before this the project ran in App-ID-only mode, where a `null` token joined
fine and hid every auth bug. Consequences:
- `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` must stay set on the Railway **API**
  service. If either goes missing, `makeToken()` returns null and every join fails.
  `agora.ts` fails closed with a 503 in production rather than issuing nulls.
- `NEXT_PUBLIC_AGORA_APP_ID` is public by construction (inlined into the bundle).
  Enforcement is the only thing stopping a stranger who reads it from publishing
  into a live session.
- Guests with **no account** reach a slot via a signed `participant_token` issued by
  `POST /participants` (`apps/api/src/lib/participantToken.ts`), not via `auth.uid()`.
  The credential only proves which participant row is asking; the RTC routes still
  require that row to be `live` and hold the requested slot.

**Security pass shipped (Jul 29, 2026):** migration 008 narrowed two `using (true)`
RLS policies that were readable by anyone holding the public anon key (`participants`
exposed the waiting/removed roster keyed by `user_id`; `community_votes` exposed
per-user ballots the API deliberately aggregates). Agora/LiveKit token routes now
validate the session for audience callers too. Relay no longer prints RTMP stream
keys: `redactStreamKeys()` covers the spawn line and ffmpeg's own stderr, which was
the actual leak path.

**Relay stream stability fixed (Jul 29, 2026):** a participant joining used to make
the stream cycle endlessly. Cause was overlapping ffmpeg processes for one session:
`stop()` was fire-and-forget, so a replacement spawned while the old process still
held the RTMP sockets, and platforms accept only one publisher per stream key
(`error opening: I/O error` then `All tee outputs failed`). `stop()` now resolves
only after the process actually exits, and `activeSessions` is keyed to process life
rather than socket life so an orphan stays visible to the next connection.

**Verified live on Jul 29, 2026:** creator streamed under enforcement, a guest with
no account joined and appeared on screen, and the stream stayed stable through the
join.

**Next logical step:** the sustained stream test is still outstanding in part. Verify
30fps holds with the tab backgrounded, first key frame is immediate on the `mp4` path
at 720p and 1080p, and the WebCodecs to MediaRecorder fallback recovers a session.
Then move verified destinations off `RELAY_REENCODE_PLATFORMS`.

Full session history: `docs/session-log.md`

