# DITCH

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

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env file and fill in Supabase credentials
cp .env.example .env

# Start all services
pnpm dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
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