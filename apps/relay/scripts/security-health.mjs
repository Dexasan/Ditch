import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
const port = 3193;
const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  env: { ...process.env, NODE_ENV: 'production', RELAY_PORT: String(port),
    SUPABASE_URL: 'https://security-test.supabase.co', SUPABASE_ANON_KEY: 'test-anon',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service', RELAY_HEALTH_TOKEN: 'test-health-secret',
    WEB_URL: 'https://ditchlive.app', RTMP_INGEST_ENABLED: 'false' }, stdio: 'pipe',
});
try {
  let response;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { response = await fetch(`http://localhost:${port}/health`); break; } catch { await delay(100); }
  }
  assert.ok(response, 'relay must start');
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal((await fetch(`http://localhost:${port}/internal/health`)).status, 401);
  const internal = await fetch(`http://localhost:${port}/internal/health`, { headers: { Authorization: 'Bearer test-health-secret' } });
  assert.equal(internal.status, 200);
  assert.equal((await internal.json()).active_streams, 0);
  assert.equal((await fetch(`http://localhost:${port}/unknown`)).status, 404);
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`, { origin: 'https://attacker.invalid' });
    ws.once('open', () => { ws.close(); reject(new Error('Unexpected cross-origin socket')); });
    ws.once('error', error => { try { assert.match(error.message, /40[13]/); resolve(); } catch (e) { reject(e); } });
  });
  console.log('PASS: bare relay health, authenticated diagnostics, 404 for unknown paths, cross-origin WebSocket rejection.');
} finally { child.kill('SIGTERM'); }
