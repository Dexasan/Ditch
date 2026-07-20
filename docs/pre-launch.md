# Pre-Launch Checklist

Items that are identified, understood, and ready to implement — just not done yet.

---

## Pending

### Relay: browser-side key frame control (WebCodecs VideoEncoder)

**What:** Replace `MediaRecorder` in `useRelayStream.ts` with `VideoEncoder` (WebCodecs API) so we can call `encode(frame, { keyFrame: true })` on every Nth frame.

**Why:** With `-c:v copy` in ffmpeg, key frames come from the browser encoder on its own schedule — random 0-4s gap at stream start. YouTube can't decode until it sees the first key frame, so startup feels slow. We tried forcing key frames via `-c:v libx264 -g 30` on the server but it causes double-transcode generation loss: the browser's encoder drops to ~200-500 Kbps on static scenes, ffmpeg decodes that degraded signal and re-encodes it, producing pixelated video at 221 Kbps. Not acceptable.

**The correct fix:** Encode once, in the browser, with explicit key frame control. Pull frames from the compositor's `MediaStreamTrackGenerator` output via `MediaStreamTrackProcessor`, encode each frame with `VideoEncoder` (requesting a key frame every 60 frames = 2s at 30fps), mux the encoded chunks into WebM clusters manually, send to relay. Keep `-c:v copy` on the server.

**Expected gain:** First key frame at t=0 (guaranteed), startup drops to ~4-5s. No generation loss.

**Complexity:** Medium. Requires a WebM muxer in the browser (the `webm-muxer` npm package handles this). `VideoEncoder` is available in all modern Chrome/Edge/Safari.

---

## Done

### Local JWT validation — shipped July 20, 2026

Landed across the relay, api and realtime services (the original entry scoped
it to the relay only).

**What shipped:** `verifyAccessToken()` in `packages/db/src/auth.ts`, used by
`apps/relay/src/index.ts`, `apps/api/src/lib/authenticate.ts` and
`apps/realtime/src/middleware/auth.ts`. It checks the token's HS256 signature
against `SUPABASE_JWT_SECRET` locally instead of calling
`supabaseAdmin.auth.getUser(token)` over HTTP.

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

**Deployment requirement:** `SUPABASE_JWT_SECRET` must be set on the **api**,
**realtime** and **relay** services (Supabase dashboard → Settings → API → JWT
Secret). Without it the code silently keeps using the slower network path.

Shipped alongside two resilience fixes from the same incident: an 8s
`AbortSignal.timeout` in `apps/web/src/lib/api.ts` (so a stalled API rejects
and pages render their offline state instead of hard-failing), and an 8s
ceiling on all Supabase HTTP calls in `packages/db/src/client.ts`
(`SUPABASE_FETCH_TIMEOUT_MS` to override).
