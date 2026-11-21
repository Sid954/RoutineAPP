const assert = require('assert');
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
global.window = global.window || {};

(async () => {
  const A = await import('../src/attendance/attendance.js');
  const H = await import('../src/attendance/held-classes.js');
  const N = await import('../src/notes/notes-store.js');
  const E = await import('../src/exams/exams-store.js');
  const L = await import('../src/home/layout-store.js');
  console.log('Testing Home stores (attendance, held classes, notes, exams, layout)...');

  // 1. Can miss / need in a row (75%)
  assert.strictEqual(A.canMissMore(9, 10, 75), 2, '9/10: 9/12 = 75%');
  assert.strictEqual(A.canMissMore(3, 4, 75), 0);
  assert.strictEqual(A.needInRow(5, 10, 75), 10, '(0.75*10-5)/0.25 = 10');
  assert.strictEqual(A.needInRow(8, 10, 75), 0);
  console.log('✅ can miss / need in a row');

  // 2. Held classes: cancelled and moved-away classes do not count, today's only once ended
  const week = {
    '2026-11-02': [{ title: 'DS', start: '09:45 AM', end: '11:00 AM' }, { title: 'DSL', start: '11:00 AM', end: '01:30 PM', isCancelled: true }],
    '2026-11-03': [{ title: 'DS', start: '09:45 AM', end: '11:00 AM', rescheduledTo: '2026-11-05' }],
    '2026-11-04': [{ title: 'DS', start: '09:45 AM', end: '11:00 AM' }, { title: 'DSL', start: '11:00 AM', end: '01:30 PM' }]
  };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const get = d => week[ymd(d)] || [];
  const now = new Date(2026, 10, 4, 12, 0); // Wed 4 Nov, 12:00: DSL still running
  const held = H.heldClassesBetween('2026-11-02', get, now);
  assert.deepStrictEqual(held.map(h => `${h.date} ${h.subject}`), ['2026-11-02 DS', '2026-11-04 DS']);
  assert.strictEqual(held[0].key, '2026-11-02|DS@585');
  assert.deepStrictEqual(H.heldClassesBetween('', get, now), []);
  console.log('✅ held classes');

  // 3. Marks + base counts -> stats; labs are their own subject
  A.setMark(held[0].key, 'present');
  A.setMark(held[1].key, 'absent');
  A.setBase('DSL', { attended: 4, held: 5 });
  let st = A.computeStats(held, A.getAttendance());
  const ds = st.find(s => s.subject === 'DS');
  const dsl = st.find(s => s.subject === 'DSL');
  assert.strictEqual(ds.pct, 50); assert.strictEqual(ds.atRisk, true); assert.strictEqual(ds.needInRow, 2);
  assert.strictEqual(dsl.pct, 80); assert.strictEqual(dsl.canMiss, 0); assert.strictEqual(dsl.atRisk, false);
  A.setMark(held[1].key, null);
  st = A.computeStats(held, A.getAttendance());
  assert.strictEqual(st.find(s => s.subject === 'DS').unknown, 1);
  assert.strictEqual(st.find(s => s.subject === 'DS').pct, 50, 'unanswered counts as absent');
  A.setMinPercent(80); assert.strictEqual(A.getAttendance().min, 80); A.setMinPercent(75);
  assert.strictEqual(A.getSemesterStart('2026-11-02'), '2026-11-02');
  A.setSemesterStartOverride('2026-11-09'); assert.strictEqual(A.getSemesterStart('2026-11-02'), '2026-11-09');
  A.setSemesterStartOverride(''); assert.strictEqual(A.getSemesterStart('2026-11-02'), '2026-11-02');
  assert.deepStrictEqual(H.unmarkedEnded(held, A.getAttendance().marks, ['2026-11-04']).map(h => h.subject), ['DS']);
  assert.strictEqual(A.isSkipped('2026-11-20|DS@660'), false);
  A.setSkipped('2026-11-20|DS@660', true);
  assert.strictEqual(A.isSkipped('2026-11-20|DS@660'), true);
  A.setSkipped('2026-11-20|DS@660', false);
  assert.strictEqual(A.isSkipped('2026-11-20|DS@660'), false);
  const ek = A.addExtra('2026-11-10', 'ds', 'absent');
  assert.strictEqual(ek, '2026-11-10|DS@extra');
  assert.strictEqual(A.getAttendance().marks[ek], 'absent');
  assert.strictEqual(A.getAttendance().extra[ek].subject, 'DS');
  assert.strictEqual(A.addExtra('bad', 'ds', 'absent'), null);
  assert.strictEqual(A.addExtra('2026-11-10', 'ds', 'maybe'), null);
  A.removeExtra(ek);
  assert.strictEqual(A.getAttendance().marks[ek], undefined);
  assert.strictEqual(Object.keys(A.getAttendance().extra).length, 0);
  console.log('✅ attendance stats, base counts, semester start, skips');

  // 4. Notes
  const n1 = N.addNote({ text: '  Bring lab report ', subject: 'dsl', date: '2026-11-05' });
  N.addNote({ text: 'Read chapter 3' });
  assert.strictEqual(N.addNote({ text: '   ' }), null);
  assert.strictEqual(N.notesForSubject('DSL').length, 1);
  N.toggleNote(n1.id);
  assert.strictEqual(N.listNotes({ openOnly: true }).length, 1);
  N.removeNote(n1.id);
  assert.strictEqual(N.listNotes().length, 1);
  console.log('✅ notes');

  // 5. Exams: own + class tests, soonest first, past ones dropped
  E.addExam({ subject: 'ds', kind: 'midterm', date: '2026-12-01' });
  E.addExam({ subject: 'old', kind: 'final', date: '2026-10-01' });
  assert.strictEqual(E.addExam({ subject: 'x', date: 'bad' }), null);
  const up = E.upcomingExams(E.listOwnExams(), [{ id: 7, subject: 'icmp', date: '2026-11-22', name: 'CT-2' }], '2026-11-20');
  assert.deepStrictEqual(up.map(e => `${e.subject} ${e.label}`), ['ICMP CT-2', 'DS Midterm']);
  assert.strictEqual(E.daysUntil('2026-12-01', '2026-11-20'), 11);
  console.log('✅ exams');

  // 6. Layout: header first, unknown ids dropped, new cards appended
  mem.home_layout_v1 = JSON.stringify({ order: ['teachers', 'bogus', 'now', 'teachers'], hidden: ['exams', 'header'] });
  const lay = L.getLayout();
  assert.strictEqual(lay.order[0], 'header');
  assert.deepStrictEqual(lay.order.slice(1, 3), ['teachers', 'now']);
  assert.strictEqual(lay.order.length, L.CARDS.length);
  assert.deepStrictEqual(lay.hidden, ['exams']);
  assert.strictEqual(L.resetLayout().order[1], 'now');
  assert.deepStrictEqual(L.getLayout().hidden, ['teachers', 'suggestions']); // off by default
  console.log('✅ layout');
  console.log('All Home store tests passed.');
})().catch(e => { console.error(e); process.exit(1); });
