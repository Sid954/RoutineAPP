// api/suggestions.js against an in-memory fake Supabase: suggest, duplicate, vote scope,
// auto-approve, admin approve/reject, daily device cap, hidden filtering.
const assert = require('assert');
const Module = require('module');

// ---- minimal in-memory Supabase fake -------------------------------------------------------
const db = { suggestions: [], suggestion_votes: [], announcements: [] };
let nextId = 1;
function builder(table) {
  const st = { op: 'select', filters: [], rows: null, patch: null, head: false, limit: null, order: null };
  const match = r => st.filters.every(f => f(r));
  const run = () => {
    const rows = db[table];
    if (st.op === 'insert') {
      const out = st.rows.map(r => {
        const row = { ...r };
        if (table !== 'suggestion_votes') {
          row.id = nextId++;
          row.created_at = row.created_at || new Date().toISOString();
          if (table === 'suggestions') row.status = 'pending';
        }
        rows.push(row);
        return row;
      });
      return { data: out, error: null };
    }
    if (st.op === 'upsert') {
      st.rows.forEach(r => {
        const i = rows.findIndex(x => x.suggestion_id === r.suggestion_id && x.device_id === r.device_id);
        if (i >= 0) rows[i] = { ...rows[i], ...r }; else rows.push({ ...r });
      });
      return { data: st.rows, error: null };
    }
    if (st.op === 'update') { const hit = rows.filter(match); hit.forEach(r => Object.assign(r, st.patch)); return { data: hit, error: null }; }
    if (st.op === 'delete') { db[table] = rows.filter(r => !match(r)); return { data: null, error: null }; }
    let out = rows.filter(match);
    if (st.order) out = out.slice().sort((a, b) => (a[st.order] < b[st.order] ? 1 : -1));
    if (st.limit) out = out.slice(0, st.limit);
    return st.head ? { data: null, count: out.length, error: null } : { data: out, error: null };
  };
  const b = {
    select(_c, o) { if (o && o.head) st.head = true; return b; },
    insert(r) { st.op = 'insert'; st.rows = r; return b; },
    upsert(r) { st.op = 'upsert'; st.rows = r; return b; },
    update(p) { st.op = 'update'; st.patch = p; return b; },
    delete() { st.op = 'delete'; return b; },
    eq(k, v) { st.filters.push(r => r[k] === v); return b; },
    gte(k, v) { st.filters.push(r => r[k] >= v); return b; },
    in(k, vs) { st.filters.push(r => vs.includes(r[k])); return b; },
    order(k) { st.order = k; return b; },
    limit(n) { st.limit = n; return b; },
    then(res, rej) { try { return Promise.resolve(run()).then(res, rej); } catch (e) { return Promise.reject(e); } }
  };
  return b;
}
const origLoad = Module._load;
Module._load = function (req, ...a) {
  if (req === '@supabase/supabase-js') return { createClient: () => ({ from: builder }) };
  if (req === 'firebase-admin') return { apps: [], initializeApp() {}, credential: {}, messaging: () => ({}) };
  return origLoad.call(this, req, ...a);
};
process.env.SUPABASE_URL = 'http://fake';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake';
process.env.ANNOUNCEMENT_PASSWORD = 'pw-test';
const handler = require('../api/suggestions.js');

let ipN = 0;
async function call(method, body, query = {}) {
  const res = {
    code: 200, headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.code = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; }
  };
  await handler({ method, body, query, headers: { 'x-forwarded-for': '9.9.9.' + (++ipN % 250) } }, res);
  return res;
}
const dev = n => 'device-' + String(n).padStart(4, '0');
const cancel = (extra = {}) => Object.assign({
  action: 'suggest', device: dev(1), name: 'Rafi', title: 'DS class cancelled', announcement: 'Teacher is sick',
  type: 'cancellation', subject: 'DS', date_override: '2026-11-20', semester: '4', section: 'C'
}, extra);

(async () => {
  // suggest creates a pending row with the suggester's up-vote
  let r = await call('POST', cancel());
  assert.strictEqual(r.code, 201, JSON.stringify(r.body));
  assert.strictEqual(r.body.up, 1);
  assert.ok(!('device_id' in r.body));
  const id = r.body.id;

  // same suggestion again -> 409 duplicate
  r = await call('POST', cancel({ device: dev(2) }));
  assert.strictEqual(r.code, 409);
  assert.strictEqual(r.body.duplicateId, id);

  // half-audience (semester without section) and bad device rejected
  r = await call('POST', cancel({ device: dev(3), section: '', date_override: '2026-11-25' }));
  assert.strictEqual(r.code, 400);
  r = await call('POST', cancel({ device: 'x', date_override: '2026-11-26' }));
  assert.strictEqual(r.code, 400);

  // list: my section sees it, another section does not
  r = await call('GET', null, { semester: '4', section: 'c' });
  assert.strictEqual(r.body.length, 1);
  assert.strictEqual(r.body[0].up, 1);
  r = await call('GET', null, { semester: '4', section: 'D' });
  assert.strictEqual(r.body.length, 0);

  // vote scope: other section cannot vote; own section can; vote is changeable and removable
  r = await call('POST', { action: 'vote', device: dev(9), id, value: 1, semester: '4', section: 'D' });
  assert.strictEqual(r.code, 403);
  r = await call('POST', { action: 'vote', device: dev(2), id, value: 1, semester: '4', section: 'C' });
  assert.strictEqual(r.body.up, 2);
  assert.strictEqual(r.body.state, 'applied');
  r = await call('POST', { action: 'vote', device: dev(2), id, value: -1, semester: '4', section: 'C' });
  assert.strictEqual(r.body.up, 1);
  assert.strictEqual(r.body.down, 1);
  r = await call('POST', { action: 'vote', device: dev(2), id, value: 0, semester: '4', section: 'C' });
  assert.strictEqual(r.body.down, 0);

  // 8 votes from different devices -> auto-approve publishes a community notice exactly once
  for (let i = 10; i < 16; i++) r = await call('POST', { action: 'vote', device: dev(i), id, value: 1, semester: '4', section: 'C' });
  assert.notStrictEqual(r.body.state, 'approved'); // 7 votes so far
  r = await call('POST', { action: 'vote', device: dev(16), id, value: 1, semester: '4', section: 'C' });
  assert.strictEqual(r.body.state, 'approved');
  assert.strictEqual(db.announcements.length, 1);
  assert.strictEqual(db.announcements[0].source, 'community');
  assert.strictEqual(db.announcements[0].section, 'C');
  assert.strictEqual(db.suggestions.find(s => s.id === id).status, 'approved');
  r = await call('POST', { action: 'vote', device: dev(17), id, value: 1, semester: '4', section: 'C' });
  assert.strictEqual(r.code, 404); // closed
  assert.strictEqual(db.announcements.length, 1);

  // hidden at 5 net down-votes: not listed publicly, still in admin_list
  r = await call('POST', cancel({ device: dev(30), subject: 'OS', title: 'OS test' }));
  const id2 = r.body.id;
  for (let i = 40; i < 47; i++) await call('POST', { action: 'vote', device: dev(i), id: id2, value: -1, semester: '4', section: 'C' });
  r = await call('GET', null, { semester: '4', section: 'C' });
  assert.ok(!r.body.some(s => s.id === id2));
  r = await call('POST', { action: 'admin_list' });
  assert.strictEqual(r.code, 401);
  r = await call('POST', { action: 'admin_list', password: 'pw-test' });
  assert.ok(r.body.some(s => s.id === id2));

  // admin reject / approve; wrong password refused
  r = await call('POST', { action: 'approve', id: id2, password: 'nope' });
  assert.strictEqual(r.code, 401);
  r = await call('POST', { action: 'reject', id: id2, password: 'pw-test' });
  assert.strictEqual(r.body.state, 'rejected');
  r = await call('POST', cancel({ device: dev(31), subject: 'DBMS', title: 'DBMS moved' }));
  const id3 = r.body.id;
  r = await call('POST', { action: 'approve', id: id3, password: 'pw-test' });
  assert.strictEqual(r.body.state, 'approved');
  assert.ok(!db.announcements.find(a => a.title === 'DBMS moved').source, 'admin approval is a normal notice');

  // department-wide suggestion: voters from any section can vote
  r = await call('POST', cancel({ device: dev(50), semester: '', section: '', type: 'holiday', subject: '', title: 'Holiday', announcement: 'Strike', date_override: '2026-11-30' }));
  assert.strictEqual(r.code, 201);
  r = await call('POST', { action: 'vote', device: dev(51), id: r.body.id, value: 1, semester: '1', section: 'A' });
  assert.strictEqual(r.body.up, 2);

  // device cap: 5 suggestions a day
  let last;
  for (let i = 0; i < 6; i++) last = await call('POST', cancel({ device: dev(70), subject: 'S' + i, title: 'T' + i, date_override: '2026-12-0' + (i + 1) }));
  assert.strictEqual(last.code, 429);

  console.log('suggestions api tests passed');
})().catch(e => { console.error(e); process.exit(1); });
