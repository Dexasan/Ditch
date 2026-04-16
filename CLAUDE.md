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
- `3001` — api (Fastify)
- `3002` — realtime (Socket.io)

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
