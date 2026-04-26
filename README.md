# DITCH

<img width="1887" height="1056" alt="image" src="https://github.com/user-attachments/assets/ea2b837d-2496-4a3e-b156-ec31dcebe9fc" />


A video-first live platform: go live once, stream everywhere, bring viewers back into one interactive space.

## What is DITCH

DITCH is a **video-first live platform** with three core capabilities:

1. **Multi-stream gateway** — one RTMP source pushed to Twitch, YouTube, TikTok, Kick, and others simultaneously. DITCH is the origin, so platform cross-streaming restrictions don't apply.

2. **Interaction hub** — the creator's DITCH channel is the live control center. Viewers from any platform can enter and become on-screen participants, broadcast back across all destinations.

3. **Participatory ad network** — brands sponsor participant slots. Real humans, voluntarily present, live across all platforms simultaneously.

**Core growth loop:** viewer finds stream on Platform X → moves to DITCH channel → appears live on stream → inspires others → audience acquires itself.

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript throughout |
| Web frontend | Next.js 14 (App Router) |
| API server | Fastify (Node.js) |
| Realtime server | Socket.io (Node.js) |
| Database | Supabase (Postgres + Auth + RLS) |
| Media relay | WebSocket + ffmpeg |

## Project Structure

```
ditch/
├── apps/
│   ├── web/          @ditch/web      Next.js frontend
│   ├── api/          @ditch/api      REST API
│   ├── realtime/     @ditch/realtime Socket.io server
│   └── relay/       @ditch/relay    WebSocket → RTMP relay
├── packages/
│   ├── types/        @ditch/types    Shared TypeScript types
│   └── db/          @ditch/db       Supabase client
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

### Port Assignments

- `3000` — web (Next.js)
- `3001` — realtime (Socket.io)
- `3002` — api (Fastify)
- `3003` — relay (WebSocket → RTMP)

## Database Setup (Supabase Migrations)

DITCH uses Supabase for the database. Migrations are stored in `supabase/migrations/` and can be applied two ways:

### Option A — Supabase CLI (recommended for production)

Requires a [Supabase access token](https://supabase.com/dashboard/project/_/settings/api).

```bash
# Set your token once
export SUPABASE_ACCESS_TOKEN=your-token-here

# Link to your Supabase project (creates .config.yml)
pnpm db:link --project-ref kgdlmfybxnqpkhfbjull

# Push migrations to the linked project
pnpm db:push

# Or apply step by step:
pnpm db:migrate:new your_migration_name  # create a new migration file
pnpm db:migrate:status                   # check applied vs unapplied
pnpm db:push                             # apply pending migrations
pnpm db:reset                            # destroy + re-apply all (dev only)
```

### Option B — SQL Editor

1. Go to your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/editor)
2. Open each file in `supabase/migrations/` and run it in order

### Local Development with Supabase CLI

```bash
pnpm db:start   # start a local Supabase instance (Docker)
pnpm db:stop    # stop it
pnpm db:reset   # reset local database
```

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env file and fill in Supabase credentials
cp .env.example .env

# Run database migrations (Option A or B above)
# Then start all services
pnpm dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI access token (for `db:push` and `db:link` scripts) |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `NEXT_PUBLIC_SUPABASE_URL` | Public project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) |
| `NEXT_PUBLIC_API_URL` | Fastify API URL (default: http://localhost:3002) |
| `NEXT_PUBLIC_REALTIME_URL` | Socket.io URL (default: http://localhost:3001) |
| `NEXT_PUBLIC_RELAY_URL` | Relay WebSocket URL (default: ws://localhost:3003) |

## Key Features

### For Creators

- Start live sessions from the dashboard
- Add RTMP destinations (Twitch, YouTube, TikTok, Kick)
- Control room with participant queue management
- Real-time canvas compositor for multi-participant layout
- One-click streaming to all platforms simultaneously

### For Viewers

- Join creator's DITCH channel from any platform
- Unified chat across all streaming platforms
- Request to appear on stream as a participant
- Contribute video/audio when admitted to the live session

## Architecture

- **Supabase Auth** handles JWT issuance and session management
- **Socket.io rooms** are keyed by `session_id` for real-time collaboration
- **RTMP credentials** are stored server-side only, never exposed to the browser
- **Canvas compositor** (1280×720) combines creator + up to 4 participants
- **WebSocket relay** streams composed output to multiple RTMP destinations via ffmpeg

## License

MIT
