# Audit — Anonymous Watch, Gated Chat

**Date:** 2026-05-22
**Branch:** main (998aa32)
**Scope:** Four questions from the brief — auth gates, chat send path, signup component, Agora lifecycle.

---

## 1 — Auth gates on `/c/[slug]` (the watch page)

**Short answer:** The watch page is already public at every layer. There is no signup wall at the route level. The experience the user describes ("hits a signup wall, bounces") is most likely the chat input silently failing — the input renders and accepts text for anonymous users, but sends nothing and shows no feedback.

### Middleware
`apps/web/src/middleware.ts`

```
PROTECTED = ["/dashboard", "/onboarding"]
AUTH_ONLY  = ["/auth"]
```

`/c/*` routes are not in either list. Anonymous requests pass straight through.

### Page
`apps/web/src/app/c/[slug]/page.tsx:14`

Comment reads: `"Public — no auth required to view"`. The page calls `supabase.auth.getSession()` (line 25) for UI purposes only — pre-filling display name and checking ownership. If the session is absent, nothing redirects.

### ChannelView component
`apps/web/src/app/c/[slug]/ChannelView.tsx`

`token` prop is typed `string | null`. The component renders in full regardless of its value. Chat list, video tiles, and the send input all mount for anonymous users.

**The real problem:** When an anonymous user sends a chat message, `socket.emit("chat:message", ...)` fires (line 125) with no auth check on the frontend. The backend emits `chat:error { code: "auth_required" }` back. ChannelView has **no listener for `chat:error`** — the failure is completely silent. The user typed something, hit Send, nothing happened.

### `/c/[slug]/live`
`apps/web/src/app/c/[slug]/live/page.tsx:15–19`

Hard auth gate — redirects to `/auth` if no session. **This is the creator's control room, not the viewer watch page.** It stays gated. No changes needed here.

### Layout files
There are no layout files under `apps/web/src/app/c/` or `apps/web/src/app/c/[slug]/`. Root layout (`apps/web/src/app/layout.tsx`) has no auth logic.

---

## 2 — Chat send path

### Frontend
**Component:** `ChannelView.tsx:255–271`
**Send handler:** `ChannelView.tsx:121–132`

```typescript
function sendChat(e: React.FormEvent) {
  e.preventDefault();
  if (!chatBody.trim()) return;
  const socket = getSocket(token ?? undefined);     // token is null for anon
  socket.emit("chat:message", {
    session_id: sessionId,
    body: chatBody.trim(),
    display_name: viewerName ?? "Viewer",           // falls back to "Viewer" for anon
    platform_origin: "ditch",
  });
  setChatBody("");
}
```

No frontend auth check. The `getSocket()` call is the only place `token` touches the socket — it's passed at connect time, not checked before emit.

**Subscribe:** `ChannelView.tsx:62–64`

```typescript
socket.on("chat:message", ({ message }) => {
  setMessages((prev) => [...prev.slice(-MAX_CHAT + 1), message]);
});
```

Chat subscription is open to all connected sockets. Anonymous users receive live chat messages today — this is the behavior the product decision changes (anon users should see no chat list at all).

### Backend

**Socket handler:** `apps/realtime/src/handlers/chat.ts:20`

```typescript
if (!socket.data.user_id) {
  socket.emit("chat:error", { code: "auth_required", message: "Sign in to chat" });
  return;
}
```

This guard (added in commit `998aa32`) is the only server-side enforcement. The write is blocked before it reaches the database.

**How the socket gets `user_id`:** `apps/realtime/src/middleware/auth.ts:12–40`

Anonymous connections are allowed — `user_id` is set to `null`, not rejected. Authenticated connections validate the JWT via `supabaseAdmin.auth.getUser(token)` and populate `socket.data.user_id` and `socket.data.display_name`.

**Database RLS:** `supabase/migrations/001_initial_schema.sql:373–387`

```sql
-- Anyone can read chat
create policy "chat_messages: public read"
  on public.chat_messages for select using (true);

-- Authenticated users can insert
create policy "chat_messages: authenticated insert"
  on public.chat_messages for insert
  with check (auth.uid() is not null);
```

Important caveat: the realtime server writes using `supabaseAdmin` (service role), which **bypasses RLS**. The `authenticated insert` policy only blocks direct Supabase REST API calls. The actual security enforcement for the chat pipeline is the socket-layer `user_id` check — not RLS. Test the RLS curl scenario against the REST endpoint directly; the socket endpoint is already locked.

---

## 3 — Signup component

### Current state

**File:** `apps/web/src/app/auth/page.tsx`

- Full-page component only. No modal variant exists anywhere in the codebase.
- Renders a tab strip (Sign in / Sign up), email + password fields.
- **No `display_name` field at any point in the signup flow.** The display name currently comes from `user_metadata.display_name`, which is set later via the dashboard or profile page (never during initial signup).
- On successful sign-in: `router.push("/dashboard")` (line 43). This navigation would kill the Agora connection — it is the exact failure mode the brief flags.
- On successful signup: shows a "Check your email" confirmation screen (line 57–75). Email verification is required before the account activates. **This is a complication for the "sign up and immediately chat" conversion flow** — see edge case section below.

### Can it be reused as a modal?

No, not without a refactor. Issues:

1. `router.push("/dashboard")` on sign-in — incompatible with modal use. The success handler needs to be injectable (callback prop) so the modal can close instead of navigate.
2. The "Check your email" state after signup puts the user in a waiting loop — they can't chat immediately, so the "prefill draft and send" flow breaks unless we either (a) disable email verification for this path, or (b) treat sign-in as the conversion event and allow the signup-then-verify flow to redirect to the channel on return.
3. The full-page wrapper (`min-h-screen flex items-center justify-center`) needs to be stripped for modal rendering.

The auth logic is self-contained enough that the cleanest approach is a new `SignInModal` component that owns only the sign-in form (not signup — see design note below), calls `supabase.auth.signInWithPassword`, and accepts an `onSuccess` callback instead of routing.

**Design note on signup vs sign-in in the modal:** Full signup (email → verify → return) breaks the "type draft, sign up, send immediately" loop because of the email confirmation step. The modal should lead with sign-in and offer sign-up as a secondary path that acknowledges the "verify email, then come back and your draft will be there" flow.

---

## 4 — Agora lifecycle and route change behavior

**Hook:** `apps/web/hooks/useAgoraRoom.ts`

The `useEffect` cleanup (lines 102–121) fires on:
- Component unmount
- Change to any dep: `[enabled, channelName, uid, role, publish]`

When a modal opens *over* `ChannelView`, none of these deps change. **Agora stays alive.** The stream keeps playing. This is exactly the behavior we need.

When a route change happens — i.e., the browser navigates to `/auth` — `ChannelView` unmounts, the effect cleanup fires, `client.leave()` is called, all tracks are closed. **This is the failure mode.** A redirect to `/auth` drops the Agora connection, causes a reconnect on return, and produces the black-frame + viewer-count blip the brief describes.

In `ChannelView`, the `enabled` prop is hardcoded `true` (line 104), so Agora is running for the full lifetime of the component. The hook has no conditional "pause" path — it's all-or-nothing by design.

**Conclusion:** Modal overlay is mandatory for this conversion flow. Redirect is not acceptable.

---

## 5 — Viewer count (bonus finding)

`ChannelView.tsx:346–349`

```tsx
{participants.filter((p) => p.status !== "removed").length} participant
{participants.length !== 1 ? "s" : ""}
```

This counts **participants** (people who requested to join the stream), not viewers. Anonymous users who are just watching are not counted anywhere today — not in Agora presence, not in a socket room count, nothing. Making the page public does not affect this count (there is nothing to change). If we want a real viewer count that includes anonymous watchers, that is a separate piece of work (socket `session:join` counter on the server, emitted back to the room).

---

## Summary table

| Question | Finding |
|---|---|
| Auth gate on `/c/[slug]` | None. Page is already public. Anon users see stream + chat list + broken-silent send input. |
| Auth gate on `/c/[slug]/live` | Hard gate (creator only). Unchanged — correct. |
| Chat frontend gate | None — send fires for anon users. Fails silently, no `chat:error` handler in UI. |
| Chat backend gate | Socket handler blocks at `user_id == null`. Correct. RLS is secondary (admin client bypasses it). |
| Signup component | Full page only. No modal. Success handler navigates away. No display_name field. Email verify required. |
| Agora on route change | Unmounts, leaves channel, closes tracks. Modal overlay is required — redirect is a hard no. |
| Viewer count | Participant count only. Anonymous watchers invisible. No change needed unless we add presence tracking separately. |

---

## What the rewire actually needs to do

1. **ChannelView:** Branch on `token !== null`. Authed → chat list + send input as today. Anon → no chat list, locked input with "Sign in to chat" label.
2. **`SignInModal` component:** Wraps sign-in form. Accepts `onSuccess(token: string)` callback. Does not navigate. Stream plays underneath.
3. **Draft state:** `useState<string>` in `ChannelView`, persisted across modal open/close. Pre-fills chat input on successful auth.
4. **Display name:** Add `display_name` field to the signup path. The sign-in path already pulls it from `user_metadata`. First-chat message has a real name.
5. **Auth page sign-in redirect:** Only affects the standalone `/auth` page, not the modal. No change needed to the existing page — modal uses its own success handler.
6. **Server security:** Already locked. Verify with `curl` against the relay socket endpoint without a token → `auth_required`. Supabase REST endpoint → blocked by RLS. Both layers covered.
