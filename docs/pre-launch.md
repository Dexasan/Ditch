# Pre-Launch Checklist

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
