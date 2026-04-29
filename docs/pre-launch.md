# Pre-Launch Checklist

Items that are identified, understood, and ready to implement — just not done yet.

---

## Relay: browser-side key frame control (WebCodecs VideoEncoder)

**What:** Replace `MediaRecorder` in `useRelayStream.ts` with `VideoEncoder` (WebCodecs API) so we can call `encode(frame, { keyFrame: true })` on every Nth frame.

**Why:** With `-c:v copy` in ffmpeg, key frames come from the browser encoder on its own schedule — random 0-4s gap at stream start. YouTube can't decode until it sees the first key frame, so startup feels slow. We tried forcing key frames via `-c:v libx264 -g 30` on the server but it causes double-transcode generation loss: the browser's encoder drops to ~200-500 Kbps on static scenes, ffmpeg decodes that degraded signal and re-encodes it, producing pixelated video at 221 Kbps. Not acceptable.

**The correct fix:** Encode once, in the browser, with explicit key frame control. Pull frames from the compositor's `MediaStreamTrackGenerator` output via `MediaStreamTrackProcessor`, encode each frame with `VideoEncoder` (requesting a key frame every 60 frames = 2s at 30fps), mux the encoded chunks into WebM clusters manually, send to relay. Keep `-c:v copy` on the server.

**Expected gain:** First key frame at t=0 (guaranteed), startup drops to ~4-5s. No generation loss.

**Complexity:** Medium. Requires a WebM muxer in the browser (the `webm-muxer` npm package handles this). `VideoEncoder` is available in all modern Chrome/Edge/Safari.

---

Items that are identified, understood, and ready to implement — just not done yet.

---

## Relay: local JWT validation

**What:** Replace `supabaseAdmin.auth.getUser(token)` in `apps/relay/src/index.ts` with local JWT verification using `jsonwebtoken`.

**Why:** `getUser()` is an HTTP call from Railway to Supabase (~100-500ms). Local verification is ~1ms and equally secure — the signature is checked against our own secret.

**Expected gain:** ~300ms off stream startup time.

**How to implement:**

1. Get the JWT secret: Supabase dashboard → Settings → API → JWT Secret

2. Add env var to Railway relay service:
   ```
   SUPABASE_JWT_SECRET=<your-jwt-secret>
   ```
   Also add to `.env` and `.env.example`.

3. Add to `apps/relay/src/lib/env.ts` validation.

4. Install dep:
   ```bash
   pnpm --filter @ditch/relay add jsonwebtoken
   pnpm --filter @ditch/relay add -D @types/jsonwebtoken
   ```

5. In `apps/relay/src/index.ts`, replace:
   ```typescript
   const { data: authData, error: authError } = await supabaseAdmin!.auth.getUser(token);
   if (authError || !authData.user) {
     send(ws, { type: "error", message: "Unauthorized" });
     return;
   }
   const userId = authData.user.id;
   ```
   With:
   ```typescript
   import jwt from "jsonwebtoken";

   let userId: string;
   try {
     const payload = jwt.verify(token, process.env.SUPABASE_JWT_SECRET!) as { sub: string };
     userId = payload.sub;
   } catch {
     send(ws, { type: "error", message: "Unauthorized" });
     return;
   }
   ```

**Context:** After this, startup latency hits the floor (~4-5s total). The remainder is YouTube's ingest buffer (~3-4s) plus network physics — nothing left to optimize on our side.
