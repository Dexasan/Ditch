# Low-cost media architecture

This branch makes the media stack replaceable without changing the studio UI.
All new paths are opt-in, so deploying the branch with existing environment
variables continues to use Agora and the current Railway relay.

## What is implemented

- `NEXT_PUBLIC_RTC_PROVIDER=agora|livekit` selects interactive RTC. Agora is the default.
- `/livekit/token` applies the same creator/participant authorization rules as Agora.
- Passive viewers can use an R2-backed HLS program feed through `NEXT_PUBLIC_HLS_BASE_URL`.
- Viewers in the participant flow remain on RTC for low latency.
- The relay produces RTMP and HLS from one H264 encode branch, so viewer count adds no relay CPU.
- `MAX_ACTIVE_STREAMS` rejects excess streams before the server becomes unstable.
- `/health` exposes relay capacity and HLS status.
- `/relay/assignment` deterministically distributes creator sessions over `RELAY_URLS`.
- `deploy/media` runs a relay behind automatic HTTPS on a dedicated server.

## Recommended rollout

1. Deploy this branch with all new flags left at their defaults. Verify current Agora/RTMP streaming.
2. Create an R2 bucket, custom public domain, and CORS rule allowing the web origin. Set the R2 server variables and `R2_HLS_ENABLED=true` on one relay.
3. Set `NEXT_PUBLIC_HLS_BASE_URL` on a preview web deployment. Confirm passive playback and participant promotion fallback.
4. Deploy one dedicated relay with `deploy/media/docker-compose.yml`, set `RELAY_URLS=wss://relay.example.com`, and then enable `NEXT_PUBLIC_RELAY_DISCOVERY=true`.
5. Create a LiveKit Cloud development project. Configure `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`, then set `NEXT_PUBLIC_RTC_PROVIDER=livekit` only on preview.
6. Run sustained tests before changing production flags. Start with `MAX_ACTIVE_STREAMS=2`, measure CPU, then raise it one stream at a time.

## R2 CORS

Allow `GET` and `HEAD` from the production and preview web origins. The public
base URL must serve the bucket prefix unchanged; playlists are written to
`live/<session-id>/index.m3u8`.

## Dedicated relay

Copy `deploy/media/.env.example` to `deploy/media/.env`, fill in secrets, point
the relay domain's DNS record at the server, then run:

```bash
docker compose -f deploy/media/docker-compose.yml up -d --build
```

Caddy obtains TLS automatically. Keep the relay port private; expose only ports
80 and 443. The public health endpoint reports current and maximum stream count.

## Cost behavior

- Zero traffic: LiveKit Cloud development allowance and R2 free allowance can keep media usage at zero; only always-on hosting remains.
- Each creator adds one RTC publisher session and one relay ffmpeg process.
- Passive audience adds R2/CDN delivery but no ffmpeg process and no RTC subscriber minutes.
- Participants add RTC usage only while they are in the interactive flow.

HLS normally trails live by roughly 6-12 seconds. That tradeoff is intentional:
the inexpensive path is for passive viewing, while RTC remains available where
interaction needs sub-second latency.

## Safety notes

- Keep R2 and LiveKit secrets server-side. Never add them to `NEXT_PUBLIC_*` variables.
- The API authorizes composite UID `997`, creator camera/screen UIDs `998-999`, and participant UIDs `1-4`.
- R2 output is disabled unless every required variable is present and `R2_HLS_ENABLED=true`.
- Keep Agora configured until LiveKit preview and sustained-stream tests pass.
