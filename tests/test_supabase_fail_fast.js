// Verifies api/_lib/supabase-options.js makes supabase-js fail FAST when Supabase is down
// (no 3x retry back-off on network errors, hard timeout on hangs). Uses local sockets only.
const assert = require('assert');
const http = require('http');
const net = require('net');
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_OPTIONS, SUPABASE_TIMEOUT_MS } = require('../api/_lib/supabase-options.js');

async function closedPort() {
  return new Promise(resolve => {
    const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

(async () => {
  console.log('Testing Supabase fail-fast client options...');

  // 1. Connection refused (dead/paused host): must fail once, not retry with back-off
  const port = await closedPort();
  const down = createClient(`http://127.0.0.1:${port}`, 'dummy-key', SUPABASE_OPTIONS);
  let t = Date.now();
  let { error } = await down.from('announcements').select('*');
  let ms = Date.now() - t;
  assert.ok(error, 'expected an error for an unreachable host');
  assert.ok(ms < 1500, `unreachable host should fail fast (no retries), took ${ms}ms`);
  console.log(`✅ Test 1: unreachable Supabase fails in ${ms}ms (no retry back-off)`);

  // 2. Hanging server: aborted at the timeout, not retried (~6s, not ~30s)
  const hang = http.createServer(() => {}).listen(0);
  await new Promise(r => hang.once('listening', r));
  const slow = createClient(`http://127.0.0.1:${hang.address().port}`, 'dummy-key', SUPABASE_OPTIONS);
  t = Date.now();
  ({ error } = await slow.from('announcements').select('*'));
  ms = Date.now() - t;
  hang.closeAllConnections(); hang.close();
  assert.ok(error, 'expected an error for a hanging host');
  assert.ok(ms >= SUPABASE_TIMEOUT_MS - 200 && ms < SUPABASE_TIMEOUT_MS + 2500, `hang should abort at ~${SUPABASE_TIMEOUT_MS}ms once, took ${ms}ms`);
  console.log(`✅ Test 2: hanging Supabase aborted once after ${ms}ms`);

  // 3. Healthy server still works through the wrapper
  const ok = http.createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('[{"id":1}]'); }).listen(0);
  await new Promise(r => ok.once('listening', r));
  const good = createClient(`http://127.0.0.1:${ok.address().port}`, 'dummy-key', SUPABASE_OPTIONS);
  const { data, error: okErr } = await good.from('announcements').select('*');
  ok.closeAllConnections(); ok.close();
  assert.ok(!okErr, 'healthy request should not error: ' + (okErr && okErr.message));
  assert.deepStrictEqual(data, [{ id: 1 }]);
  console.log('✅ Test 3: healthy Supabase responses pass through unchanged');

  console.log('All Supabase fail-fast tests passed.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
