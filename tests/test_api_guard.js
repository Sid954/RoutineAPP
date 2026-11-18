// guard(): per-endpoint limits, 429 + Retry-After, and the 15-minute block after repeated strikes.
const assert = require('assert');
const { guard } = require('../api/_lib/security.js');

function mk(ip, method = 'GET') {
  const res = { headers: {}, code: 200, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  return { req: { method, headers: { 'x-forwarded-for': ip } }, res };
}
const lim = { read: { max: 3, windowMs: 60000 }, write: { max: 1, windowMs: 60000 } };

// under the limit passes, over it gets 429 + Retry-After
let ip = '10.0.0.1';
for (let i = 0; i < 3; i++) { const { req, res } = mk(ip); assert.strictEqual(guard(req, res, 't', lim), false); }
let r = mk(ip); assert.strictEqual(guard(r.req, r.res, 't', lim), true);
assert.strictEqual(r.res.code, 429); assert.ok(r.res.headers['Retry-After']);

// reads and writes count separately; other IPs are unaffected
r = mk(ip, 'POST'); assert.strictEqual(guard(r.req, r.res, 't', lim), false);
r = mk('10.0.0.2'); assert.strictEqual(guard(r.req, r.res, 't', lim), false);

// 3 strikes -> blocked on every endpoint, even a fresh one
for (let i = 0; i < 2; i++) { r = mk(ip); guard(r.req, r.res, 't', lim); }
r = mk(ip); assert.strictEqual(guard(r.req, r.res, 'other-endpoint'), true);
assert.strictEqual(r.res.code, 429);
assert.ok(Number(r.res.headers['Retry-After']) > 60, 'block lasts minutes');
console.log('api guard tests passed');
