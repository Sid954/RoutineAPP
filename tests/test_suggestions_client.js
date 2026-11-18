// Client side of community suggestions: device id, optimistic voting + rollback, and that an
// "applied" suggestion reaches the routine flagged as not confirmed (while a "listed" one does not).
const assert = require('assert');

const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const noop = () => {};
function stub() { return { addEventListener: noop, removeEventListener: noop, style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, setAttribute: noop, querySelector: () => stub(), querySelectorAll: () => [], appendChild: noop }; }
global.document = { getElementById: stub, documentElement: { getAttribute: () => 'dark', setAttribute: noop }, querySelector: () => null, querySelectorAll: () => [], addEventListener: noop, createElement: () => ({ style: {}, classList: { add: noop, remove: noop }, appendChild: noop, setAttribute: noop }), body: { appendChild: noop, classList: { add: noop, remove: noop } } };
global.window = global;
global.window.crypto = require('crypto').webcrypto;
global.window.addEventListener = noop;
global.window.dispatchEvent = noop;
global.window.Capacitor = undefined;

let calls = [];
let reply = () => ({ ok: true, json: async () => ({}) });
global.fetch = async (url, opts) => { calls.push({ url, opts }); return reply(url, opts); };

(async () => {
  const { Suggestions, attachAnnouncements } = await import('../src/announcements/suggestions.js');
  const { State } = await import('../src/core/state.js');
  const { Storage } = await import('../src/storage/storage.js');
  Storage.saveSemester && Storage.saveSemester('4');
  Storage.saveSection && Storage.saveSection('C');

  // Minimal Announcements stand-in: the real one sets State.announcementsList = list + applied rows
  const Ann = {
    list: [{ id: 1, type: 'general', title: 'Official', announcement: 'x' }],
    _syncRoutine() { State.announcementsList = this.list.concat(Suggestions.appliedRows()); },
    fetchAll: async () => true
  };
  attachAnnouncements(Ann);

  // applied vs listed
  Suggestions.list = [
    { id: 10, name: 'A', title: 'DS cancelled', announcement: 'sick', type: 'cancellation', subject: 'DS', subject_override: 'DS', date_override: '2026-11-20', semester: '4', section: 'c', up: 2, down: 0, state: 'applied' },
    { id: 11, name: 'B', title: 'OS test', announcement: '{}', type: 'class_test', subject: 'OS', date_override: '2026-11-21', semester: '4', section: 'c', up: 1, down: 0, state: 'listed' }
  ];
  Ann._syncRoutine();
  assert.strictEqual(State.announcementsList.length, 2, 'official + one applied');
  const applied = State.announcementsList.find(a => a.id === 's10');
  assert.ok(applied && applied.is_unconfirmed === true && applied.is_pinned === false);
  assert.ok(!State.announcementsList.some(a => a.id === 's11'), 'listed suggestions never reach the routine');

  // voting: optimistic update, server response wins
  calls = [];
  reply = () => ({ ok: true, json: async () => ({ id: 11, up: 2, down: 0, state: 'applied' }) });
  const p = Suggestions.vote(11, 1);
  assert.strictEqual(Suggestions.list[1].up, 2, 'optimistic');
  assert.strictEqual(Suggestions.myVote(11), 1);
  await p;
  const sent = JSON.parse(calls[0].opts.body);
  assert.strictEqual(sent.action, 'vote');
  assert.strictEqual(sent.value, 1);
  assert.strictEqual(sent.semester, '4');
  assert.ok(/^[A-Za-z0-9_-]{8,64}$/.test(sent.device), 'device id is valid');
  assert.strictEqual(Suggestions.list[1].state, 'applied');
  assert.ok(State.announcementsList.some(a => a.id === 's11'), 'now applied -> reaches the routine');

  // same device id every time
  calls = [];
  await Suggestions.vote(11, 1); // tapping again removes the vote
  assert.strictEqual(JSON.parse(calls[0].opts.body).value, 0);
  assert.strictEqual(Suggestions.myVote(11), 0);

  // failed vote rolls back
  reply = () => ({ ok: false, status: 500, json: async () => ({ error: 'boom' }), clone() { return this; } });
  const up0 = Suggestions.list[1].up;
  await Suggestions.vote(11, -1);
  assert.strictEqual(Suggestions.list[1].up, up0);
  assert.strictEqual(Suggestions.myVote(11), 0, 'rolled back');

  // duplicate suggestion surfaces the existing id
  reply = () => ({ ok: false, status: 409, json: async () => ({ error: 'Someone already suggested this.', duplicateId: 10 }), clone() { return this; } });
  const r = await Suggestions.suggest({ name: 'A', title: 'DS cancelled', announcement: 'sick', type: 'cancellation', semester: '4', section: 'c' });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.duplicateId, 10);

  // The Suggestions box renders real API rows (numeric ids) into #ntSuggest
  const box = { hidden: true, innerHTML: '', _h: null, querySelector: () => null };
  const realGet = global.document.getElementById;
  global.document.getElementById = id => (id === 'ntSuggest' ? box : realGet(id));
  const view = await import('../src/announcements/notices-view.js');
  const { Announcements: RealAnn } = await import('../src/announcements/announcements.js');
  RealAnn.tab = 'suggestions'; // the list lives in the Suggestions tab
  Suggestions.list = [{ id: 10, name: 'A', title: 'DS cancelled', announcement: 'sick', type: 'cancellation', subject: 'DS', subject_override: 'DS', date_override: '2026-11-20', semester: '4', section: 'c', created_at: new Date().toISOString(), up: 3, down: 1, state: 'applied' }];
  view.renderSuggestions();
  assert.strictEqual(box.hidden, false);
  assert.ok(/class="sg-card/.test(box.innerHTML) && /data-sid="10"/.test(box.innerHTML), 'card rendered');
  assert.ok(/Unconfirmed/.test(box.innerHTML), 'short status tag');
  assert.ok(/class="sg-score is-pos"[^>]*>2</.test(box.innerHTML), 'score = 3 agree - 1 disagree');
  assert.ok(/4\/8 votes/.test(box.innerHTML), 'votes so far out of the 8 needed');
  assert.ok(/ICMP cancelled|DS cancelled/.test(box.innerHTML), 'headline says it once');
  global.document.getElementById = realGet;

  // Rendering regression: ids are numbers from the API; escapeHtml must not choke on them
  const { escapeHtml } = await import('../src/core/utils.js');
  assert.strictEqual(escapeHtml(10), '10');
  assert.strictEqual(escapeHtml('<b>'), '&lt;b&gt;');
  assert.strictEqual(escapeHtml(null), '');

  console.log('suggestions client tests passed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
