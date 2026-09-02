import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { createHmac } from "node:crypto";

process.env.SUPABASE_URL = "https://security-test.supabase.co";
process.env.SUPABASE_ANON_KEY = "test-anon";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-secret";
process.env.SUPABASE_JWT_SECRET = "security-test-key-long-enough-for-hmac";
process.env.AGORA_APP_ID = "a".repeat(32);
process.env.AGORA_APP_CERTIFICATE = "b".repeat(32);
process.env.LIVEKIT_URL = "wss://security-test.invalid";
process.env.LIVEKIT_API_KEY = "test-key";
process.env.LIVEKIT_API_SECRET = "test-secret";
const { supabaseAdmin, issueServiceTicket, verifyServiceTicket, issueParticipantToken, verifyParticipantToken } = await import("@ditch/db");
const { participantRoutes } = await import("../src/routes/participants");
const { agoraRoutes } = await import("../src/routes/agora");
const { livekitRoutes } = await import("../src/routes/livekit");
const { sessionRoutes } = await import("../src/routes/sessions");
const { authRoutes } = await import("../src/routes/auth");
const { relayRoutes } = await import("../src/routes/relay");
const { registerSessionHandlers } = await import("../../realtime/src/handlers/session");
const { registerParticipantHandlers } = await import("../../realtime/src/handlers/participant");
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const sid = "33333333-3333-4333-8333-333333333333";
const pid = "44444444-4444-4444-8444-444444444444";
let rows: Record<string, any[]>;
let writes: string[];
function reset() {
  writes = [];
  rows = {
    channels: [{ id: "55555555-5555-4555-8555-555555555555", owner_id: owner }],
    live_sessions: [{ id: sid, status: "live", channels: { owner_id: owner } }],
    participants: [{ id: pid, session_id: sid, user_id: other, status: "waiting", slot_index: null, live_sessions: { id: sid, channels: { owner_id: owner } } }],
  };
}
(supabaseAdmin as any).from = (table: string) => {
  let result = rows[table] ?? [];
  const query: any = {
    select() { return query; },
    eq(k: string, v: unknown) { result = result.filter(r => r[k] === v); return query; },
    neq(k: string, v: unknown) { result = result.filter(r => r[k] !== v); return query; },
    in(k: string, v: unknown[]) { result = result.filter(r => v.includes(r[k])); return query; },
    order() { return query; }, limit() { return query; },
    insert() { writes.push(table); return query; },
    update() { writes.push(table); return query; },
    delete() { writes.push(table); return query; },
    single: async () => ({ data: result[0] ?? null, error: null }),
    maybeSingle: async () => ({ data: result[0] ?? null, error: null }),
    then(resolve: any) { return Promise.resolve({ data: result, error: null }).then(resolve); },
  };
  return query;
};
async function jwt(id: string) {
  const head = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub: id, aud: "authenticated", iss: `${process.env.SUPABASE_URL}/auth/v1`, exp: Math.floor(Date.now()/1000)+300 })).toString("base64url");
  const value = `${head}.${body}`;
  return `${value}.${createHmac("sha256", process.env.SUPABASE_JWT_SECRET!).update(value).digest("base64url")}`;
}
const app = Fastify();
for (const routes of [participantRoutes, agoraRoutes, livekitRoutes, sessionRoutes, authRoutes, relayRoutes]) await app.register(routes);
await app.ready();
test.after(() => app.close());

test("cross-owner host operations reject before writes", async () => {
  for (const [method, url, payload] of [
    ["PATCH", `/participants/${pid}`, { status: "approved" }],
    ["PATCH", `/sessions/${sid}`, { status: "ended" }],
    ["DELETE", `/sessions/${sid}`, undefined],
    ["POST", "/relay/ticket", { session_id: sid }],
  ] as const) {
    reset();
    const response = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${await jwt(other)}` } });
    assert.equal(response.statusCode, 403, `${method} ${url}`);
    assert.deepEqual(writes, []);
  }
});
test("waiting and removed guests cannot mint publisher tokens or impersonate creators", async () => {
  for (const provider of ["agora", "livekit"]) {
    for (const status of ["waiting", "removed"]) {
      reset(); rows.participants[0].status = status;
      const token = issueParticipantToken(pid, sid);
      const response = await app.inject({ url: `/`+provider+`/token?session_id=${sid}&uid=1`, headers: { "x-participant-token": token } });
      assert.equal(response.statusCode, 403);
    }
    reset();
    const response = await app.inject({ url: `/${provider}/token?session_id=${sid}&uid=999`, headers: { authorization: `Bearer ${await jwt(other)}` } });
    assert.equal(response.statusCode, 403);
  }
});
test("public participant listing excludes waiting users", async () => {
  reset();
  const response = await app.inject(`/participants?session_id=${sid}`);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().participants, []);
});
test("realtime exposes private queues only to owners or the specific participant", async () => {
  for (const identity of [null, owner, other]) {
    reset();
    const handlers: Record<string, Function> = {};
    const rooms = new Set<string>();
    const socket: any = { data: { user_id: identity }, rooms, on: (name: string, handler: Function) => { handlers[name] = handler; }, join: async (room: string) => rooms.add(room) };
    registerSessionHandlers({} as any, socket);
    let state: any;
    await handlers["session:join"]({ session_id: sid }, (error: unknown, result: unknown) => { assert.equal(error, null); state = result; });
    assert.equal(state.participants.length, identity ? 1 : 0);
    assert.ok(state.participants.every((p: any) => p.user_id === null));
    assert.equal(rooms.has(`host:${sid}`), identity === owner);
  }
});
test("realtime host controls reject a different creator", async () => {
  reset();
  const handlers: Record<string, Function> = {};
  let error: any;
  const socket: any = { data: { user_id: other }, on: (name: string, handler: Function) => { handlers[name] = handler; }, emit: (_name: string, payload: unknown) => { error = payload; } };
  registerParticipantHandlers({} as any, socket);
  await handlers["participant:status_change"]({ session_id: sid, participant_id: pid, status: "approved" });
  assert.equal(error.message, "Forbidden"); assert.deepEqual(writes, []);
});
test("removed authenticated user cannot request a new participant row", async () => {
  reset(); rows.participants[0].status = "removed";
  const response = await app.inject({ method: "POST", url: "/participants", headers: { authorization: `Bearer ${await jwt(other)}` }, payload: { session_id: sid, display_name: "Test", platform_origin: "ditch" } });
  assert.equal(response.statusCode, 409); assert.deepEqual(writes, []);
});
test("tickets reject tampering, wrong audience and wrong session", async () => {
  const user = { id: owner, email: null, display_name: "Test" };
  const ticket = await issueServiceTicket(user, "relay", sid);
  assert.equal((await verifyServiceTicket(ticket, "relay", sid))?.id, owner);
  assert.equal(await verifyServiceTicket(ticket, "realtime"), null);
  assert.equal(await verifyServiceTicket(ticket, "relay", pid), null);
  assert.equal(await verifyServiceTicket(ticket.slice(0, -8) + "tampered", "relay", sid), null);
  const guest = issueParticipantToken(pid, sid);
  assert.equal(verifyParticipantToken(guest, sid), pid);
  assert.equal(verifyParticipantToken(guest, pid), null);
  assert.equal(verifyParticipantToken(guest + "tampered", sid), null);
});
test("signout sends the access JWT, checks errors, and legacy token endpoints are disabled", async () => {
  const token = await jwt(owner);
  let supplied: string | undefined;
  (supabaseAdmin!.auth.admin as any).signOut = async (value: string) => { supplied = value; return { error: null }; };
  const response = await app.inject({ method: "POST", url: "/auth/signout", headers: { authorization: `Bearer ${token}` } });
  assert.equal(response.statusCode, 200); assert.equal(supplied, token);
  (supabaseAdmin!.auth.admin as any).signOut = async () => ({ error: { code: "failure" } });
  assert.equal((await app.inject({ method: "POST", url: "/auth/signout", headers: { authorization: `Bearer ${token}` } })).statusCode, 503);
  assert.equal((await app.inject({ method: "POST", url: "/auth/signin", payload: {} })).statusCode, 410);
});
