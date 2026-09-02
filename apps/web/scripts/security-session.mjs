// Opt-in integration test against the configured Supabase project. Creates one
// isolated, confirmed test account (no email), then deletes it in finally.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { parseEnv } from 'node:util';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
if (process.env.RUN_LIVE_AUTH_TEST !== 'true') throw new Error('Set RUN_LIVE_AUTH_TEST=true explicitly');
const env = parseEnv(fs.readFileSync('../../.env', 'utf8'));
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `security-${randomBytes(12).toString('hex')}@example.invalid`;
const password = randomBytes(32).toString('base64url');
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) throw new Error(`Test account creation failed: ${created.error.code}`);
const id = created.data.user.id;
try {
  const jar = new Map();
  const writes = [];
  const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookieOptions: { name: 'ditch-auth', httpOnly: true, secure: true, sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: values => values.forEach(cookie => { writes.push(cookie); if (cookie.options.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name, cookie.value); }),
    },
  });
  const login = await client.auth.signInWithPassword({ email, password });
  assert.equal(login.error, null);
  assert.ok(writes.length);
  assert.ok(writes.every(c => c.options.httpOnly && c.options.secure && c.options.sameSite === 'lax'));
  const before = login.data.session.refresh_token;
  const rotated = await client.auth.refreshSession();
  assert.equal(rotated.error, null);
  assert.notEqual(rotated.data.session.refresh_token, before);
  const refresh = rotated.data.session.refresh_token;
  const cookie = [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
  const origin = 'http://localhost:3100';
  const headers = { Origin: origin, 'X-Ditch-Request': '1', Cookie: cookie, 'Content-Type': 'application/json' };
  const session = await fetch(`${origin}/api/auth/session`, { method: 'POST', headers, body: '{}' });
  assert.equal(session.status, 200);
  const projection = await session.text();
  assert.equal(JSON.parse(projection).user.id, id);
  assert.ok(!projection.includes(refresh) && !projection.includes(rotated.data.session.access_token));
  const denied = await fetch(`${origin}/api/auth/signout`, { method: 'POST', headers: { ...headers, Origin: 'https://attacker.invalid' }, body: '{}' });
  assert.equal(denied.status, 403);
  const noHeader = await fetch(`${origin}/api/backend/sessions`, { method: 'POST', headers: { Origin: origin, Cookie: cookie }, body: '{}' });
  assert.equal(noHeader.status, 403);
  const logout = await fetch(`${origin}/api/auth/signout`, { method: 'POST', headers, body: '{}' });
  assert.equal(logout.status, 200);
  assert.ok(logout.headers.getSetCookie().some(c => c.includes('HttpOnly') && c.includes('Secure') && c.includes('Max-Age=0')));
  const freshClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const revoked = await freshClient.auth.refreshSession({ refresh_token: refresh });
  assert.ok(revoked.error, 'server-side signout must revoke the refresh token');
  console.log('PASS: Secure/HttpOnly/SameSite cookies, token rotation, token-free BFF response, CSRF rejection, server-side signout and refresh-token revocation.');
} finally {
  const removed = await admin.auth.admin.deleteUser(id);
  if (removed.error) throw new Error(`Test account cleanup failed: ${removed.error.code}`);
  console.log('Temporary auth test account removed.');
}
