const assert = require('assert');
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };

(async () => {
  const G = await import('../src/announcements/pw-guard.js');
  console.log('Testing the posting-password guard...');
  const t0 = 1_000_000_000_000;

  assert.deepStrictEqual({ ...G.getGuard(t0), until: 0 }, { fails: 0, until: 0, locked: false, remainingMs: 0 });
  let g = G.recordFailure(t0);
  assert.strictEqual(g.fails, 1); assert.strictEqual(g.locked, false, 'first wrong try: no lock yet');
  g = G.recordFailure(t0 + 1000);
  assert.strictEqual(g.locked, false);
  g = G.recordFailure(t0 + 2000);
  assert.strictEqual(g.fails, 3); assert.strictEqual(g.locked, true, '3rd wrong try locks');
  assert.strictEqual(Math.round(g.remainingMs / 60000), 5);
  assert.strictEqual(G.getGuard(t0 + 2000 + 5 * 60000 + 1).locked, false, 'lock ends after 5 minutes');
  g = G.recordFailure(t0 + 400000); assert.strictEqual(g.fails, 4); assert.strictEqual(g.locked, false);
  G.recordFailure(t0 + 400100);
  g = G.recordFailure(t0 + 400200);
  assert.strictEqual(g.fails, 6); assert.strictEqual(Math.round(g.remainingMs / 60000), 15, '6th locks for 15 minutes');
  console.log('✅ locks grow with repeated wrong passwords');

  G.recordSuccess();
  assert.strictEqual(G.getGuard(t0).fails, 0, 'a right password clears the count');
  G.recordFailure(t0);
  assert.strictEqual(G.getGuard(t0 + 25 * 3600 * 1000).fails, 0, 'a quiet day clears it too');
  G.recordSuccess();
  g = G.recordServerLock(t0);
  assert.strictEqual(g.locked, true); assert.strictEqual(Math.round(g.remainingMs / 60000), 15);
  assert.strictEqual(G.formatRemaining(272000), '4:32');
  assert.strictEqual(G.formatRemaining(0), '0:00');
  console.log('✅ reset, server lock, countdown text');
  console.log('All password guard tests passed.');
})().catch(e => { console.error(e); process.exit(1); });
