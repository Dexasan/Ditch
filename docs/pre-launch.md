# Pre-Launch Checklist

Items that are identified, understood, and ready to implement — just not done yet.

---

## Pending

### Relay: browser-side key frame control (WebCodecs) — IMPLEMENTED, awaiting sustained live verification

**Status (2026-07-31):** Browser key-frame control and first-generation MP4 passthrough
are implemented behind a capability gate with a MediaRecorder fallback. **Not yet marked
Done** — it moves to the Done section only after a sustained live test confirms the copy
path on real YouTube/Twitch ingest and target FPS holds with the tab backgrounded. The
legacy MediaRecorder/WebM fallback still uses relay transcoding.

**Why:** With `-c:v copy` in ffmpeg, key frames came from the browser's `MediaRecorder`
on its own schedule — a random 0-4s gap at stream start (YouTube can't decode until it
sees the first key frame). Forcing key frames via `-c:v libx264 -g` on the server causes
double-transcode generation loss (browser drops to ~200-500 Kbps on static scenes; ffmpeg
decodes that and re-encodes it → pixelated). So: encode once, in the browser, with
explicit key frame control.

**What shipped:**
- `apps/web/src/lib/webcodecsRelay.ts` — wraps **Mediabunny** (not `webm-muxer`, which
  can't carry H264 and ignores audio). `MediaStreamVideoTrackSource` pulls frames from the
  compositor's output track and encodes **H264** with a key frame every 2s; audio is
  encoded to **Opus**; both are muxed into **fragmented MP4** and streamed to the relay via
  `AppendOnlyStreamTarget` (append-only, low latency — not the 16 MiB chunked target).
- `useRelayStream.ts` — probes capability (`canUseWebCodecsRelay`) at the *actual*
  resolution/fps/bitrate before connecting, sends `container: "mp4" | "webm"` in the start
  message, and on any WebCodecs runtime failure latches to MediaRecorder for the rest of
  the session.
- Relay `ffmpeg.ts` — selects the demuxer by `container` (`-f mp4` with a larger probesize
  for the fMP4 moov, else `-f webm`). Keyframe-controlled MP4 video now passes through
  unchanged to RTMP and DITCH HLS; Opus audio is still converted to AAC. Legacy WebM keeps
  the platform-matched x264 branch so the relay can enforce its GOP.
- `RELAY_REENCODE_WEB_CODECS=true` is the emergency rollback to the former MP4 re-encode
  policy if a destination rejects the browser-produced H264 bitstream.
- Selectable **1080p** output enabled (720p default): the compositor renders the 1280x720
  design space scaled up to 1920x1080; `recommendedBitrateKbps` targets 6-8 Mbps.

**Latency note:** Mediabunny finalizes an fMP4 fragment only on a key frame boundary, so
first-key-frame delivery is deterministic at ~2s (vs the old random 0-4s) and steady-state
relay latency tracks the 2s key frame interval — acceptable on the broadcast-out RTMP path
(destinations buffer; the interactive path runs over Agora, not this relay).

**Remaining to reach Done:** sustained live test on real destinations, confirming stable
background-tab FPS, two-second key frames, accepted MP4 passthrough, and no growing socket
or encoder queues.

---

## Done

### Local JWT validation — shipped July 20, 2026

Landed across the relay, api and realtime services (the original entry scoped
it to the relay only).

**What shipped:** `verifyAccessToken()` in `packages/db/src/auth.ts`, used by
`apps/relay/src/index.ts`, `apps/api/src/lib/authenticate.ts` and
`apps/realtime/src/middleware/auth.ts`. It verifies the token's signature
locally instead of calling `supabaseAdmin.auth.getUser(token)` over HTTP,
picking key material by algorithm:

- **ES256/RS256/PS256** (what this project uses) — verified against the public
  JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. `jose` caches the
  key set in memory, so it is one fetch per process, not per request.
- **HS256** — verified against the legacy shared `SUPABASE_JWT_SECRET`.

This project has migrated to Supabase's **JWT Signing Keys**, so access tokens
are signed with ES256 and the JWKS path is the live one. `SUPABASE_JWT_SECRET`
is not used for verification here; it is kept only for HS256 projects and as a
fallback. Do not assume the secret alone is enough — check the JWKS endpoint
(and the token header's `alg`) before concluding which path is active.

**Gain:** ~300ms off stream startup, and no per-request Auth round trip
anywhere in the stack. Note this runs once in the WebSocket handshake, not in
the video path — ongoing stream latency to YouTube/Twitch is unaffected.

**Second reason, learned the hard way:** on July 20 a Railway egress incident
made Supabase unreachable from the API container. Every request hung ~49s on
`getUser()` (undici's 10s connect timeout plus retries), which blew past
Vercel's function limit and 500'd every page that touched the API. With local
verification, authenticated traffic keeps serving through an Auth outage.

**Deviations from the original plan:**
- Used `jose` rather than `jsonwebtoken` — ESM-native and dependency-free,
  which avoids CommonJS interop friction in realtime's NodeNext setup.
- Placed in `@ditch/db` so all three services share one implementation.
- Also validates the `authenticated` audience, falls back to the network path
  for projects on asymmetric signing keys, and falls back when
  `SUPABASE_JWT_SECRET` is unset (so a missing env var degrades instead of
  locking everyone out).

**Trade-off:** revocation is no longer instant. A signed-out or banned session
stays valid until the token expires (~1 hour), since we no longer consult
Supabase's live session state per request.

**Deployment requirement:** `SUPABASE_URL` must be set on the **api**,
**realtime** and **relay** services (it already is) — that is what the JWKS
endpoint is derived from. `SUPABASE_JWT_SECRET` is set too but is inert while
the project signs with ES256.

**Do NOT revoke the legacy JWT secret.** The `anon` and `service_role` API keys
are themselves JWTs signed with it; revoking it invalidates them and takes down
the web app and all three services at once. Migrating to the newer
`sb_publishable_…` / `sb_secret_…` API keys is a prerequisite for ever
retiring it, and that means a coordinated env-var change across Vercel and
Railway.

Shipped alongside two resilience fixes from the same incident: an 8s
`AbortSignal.timeout` in `apps/web/src/lib/api.ts` (so a stalled API rejects
and pages render their offline state instead of hard-failing), and an 8s
ceiling on all Supabase HTTP calls in `packages/db/src/client.ts`
(`SUPABASE_FETCH_TIMEOUT_MS` to override).
