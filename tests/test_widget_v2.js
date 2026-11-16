const assert = require('assert');
global.window = {};
const stubEl = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild() {}, addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [] });
global.document = { getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], addEventListener: () => {}, createElement: stubEl, body: { appendChild() {} }, documentElement: { getAttribute: () => 'dark' } };

const { State } = require('../src/core/state.js');
const { buildWidgetScheduleV2 } = require('../src/widget/widget.js');

console.log('Testing widget schedule v2 (dated payload)...');
const now = new Date(2026, 10, 21, 8, 0); // Saturday
const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
State.schedule = {
  6: [
    { title: 'DSA', start: '09:00', end: '10:15', room: '905', instructor: 'MHE', type: 'Theory' },
    { title: 'MATH', start: '01:00 PM', end: '02:15 PM', room: '501', instructor: 'ABC', type: 'Theory' }
  ],
  0: [{ title: 'ENG', start: '09:45', end: '11:00', room: '301', instructor: 'XYZ', type: 'Lab' }]
};
State.announcementsList = [
  { id: 1, type: 'cancellation', date_override: '2026-11-21', subject_override: 'DSA', announcement: 'Teacher on leave' },
  { id: 2, type: 'class_test', date_override: '2026-11-21', subject_override: 'MATH', announcement: JSON.stringify({ exam_name: 'CT-2' }) },
  { id: 3, type: 'holiday', date_override: '2026-11-22', title: 'Victory Day', announcement: 'Off' }
];

const p = JSON.parse(buildWidgetScheduleV2(now));
assert.strictEqual(p.v, 2);
assert.strictEqual(Object.keys(p.days).length, 14, '14 dated days');
assert.ok(p.days['2026-11-21'] && p.days['2026-12-04'] && !p.days['2026-12-05']);
const sat = p.days['2026-11-21'].classes;
assert.deepStrictEqual(sat.map(c => [c.t, c.s, c.e, c.st]), [['DSA', 540, 615, 'cancelled'], ['MATH', 780, 855, 'normal']], 'cancelled kept + marked; times in minutes');
assert.strictEqual(sat[0].n, 'Teacher on leave');
assert.strictEqual(sat[1].x, true, 'class test flagged');
assert.strictEqual(p.days['2026-11-22'].holiday, 'Victory Day');
assert.ok(p.days['2026-11-22'].classes.every(c => c.st === 'cancelled'), 'holiday cancels classes');
assert.strictEqual(p.days['2026-11-28'].classes[0].st, 'normal', 'next Saturday: the one-off cancellation does not repeat');
assert.deepStrictEqual(p.week['6'].map(c => c.t), ['DSA', 'MATH'], 'weekly routine fallback');
assert.strictEqual(p.week['0'][0].ty, 'Lab');
console.log('✅ v2 payload: 14 dates, flags, holiday, weekly fallback');
console.log('All widget v2 tests passed.');
