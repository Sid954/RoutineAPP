const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Minimal browser mocks (modules touch window/localStorage lazily)
global.window = {};
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const stubEl = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {}, addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => []
});
global.document = {
  getElementById: () => null, querySelector: () => stubEl(), querySelectorAll: () => [],
  addEventListener() {}, createElement: stubEl, body: { appendChild() {}, classList: { add() {}, remove() {} } },
  documentElement: { getAttribute: () => 'dark' }
};

const { State } = require('../src/core/state.js');
const { DAY_NAMES } = require('../src/core/config.js');
const { getDateForDayIndex } = require('../src/announcements/overrides.js');
const {
  activeDays, getTeacherDay, getTeacherWeek, getTeacherStatus, summarizeTeaching,
  getMyTeacherCodes, getTeacherDisplay, fmtMins, semSecShort
} = require('../src/teachers/faculty-data.js');
const { statusLine } = require('../src/teachers/faculty-directory.js');

console.log('Testing Faculty directory data + status logic...');

const master = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'master_teachers_schedule.json'), 'utf8'));
State.schedule = {};               // no personal routine overlay
State.announcementsList = [];
State.allAnnouncementsList = [];

// 1. Formatting helpers
assert.strictEqual(fmtMins(615), '10:15 AM');
assert.strictEqual(fmtMins(780), '1:00 PM');
assert.strictEqual(fmtMins(0), '12:00 AM');
assert.strictEqual(semSecShort('Sem 3-B'), '3-B');
assert.strictEqual(semSecShort('Personal Schedule'), '');
console.log('✅ Test 1: time and section formatting');

// 2. Status kinds from a day's classes
const day = [
  { subject: 'A', startM: 600, endM: 675 },
  { subject: 'B', startM: 700, endM: 775 }
];
assert.strictEqual(getTeacherStatus(day, 610).kind, 'in_class');
assert.strictEqual(getTeacherStatus(day, 610).next.subject, 'B');
assert.strictEqual(getTeacherStatus(day, 680).kind, 'next');
assert.strictEqual(getTeacherStatus(day, 800).kind, 'done');
assert.strictEqual(getTeacherStatus([], 600).kind, 'none');
assert.strictEqual(getTeacherStatus(day, 610, false).kind, 'off');
// Cancelled class is never "in class"; moved (rescheduled) class neither
const withCancel = [{ ...day[0], isCancelled: true }, day[1]];
assert.strictEqual(getTeacherStatus(withCancel, 610).kind, 'next', 'cancelled current class -> free, next is B');
assert.strictEqual(getTeacherStatus([{ ...day[0], isRescheduled: true }], 610).kind, 'none');
// Online class still counts as teaching
assert.strictEqual(getTeacherStatus([{ ...day[0], isMovedOnline: true }], 610).kind, 'in_class');
console.log('✅ Test 2: status kinds (cancelled/moved excluded, online kept)');

// 3. Status line copy
assert.match(statusLine(getTeacherStatus(day, 610)).text, /^In class/);
assert.match(statusLine(getTeacherStatus(day, 680)).text, /^Next at 11:40 AM/);
assert.strictEqual(statusLine(getTeacherStatus(day, 800)).text, 'Done for today');
assert.strictEqual(statusLine(getTeacherStatus([], 600)).text, 'No classes today');
assert.strictEqual(statusLine(getTeacherStatus(day, 0, false)), null, 'no status line on off days');
console.log('✅ Test 3: status line text');

// 4. Real data: pick a teacher with a sectioned class on an active day
const anchor = new Date();
let pick = null;
for (const d of activeDays()) {
  const daySched = (master.schedule || {})[DAY_NAMES[d]] || {};
  for (const t of Object.keys(daySched)) {
    const c = daySched[t].find(x => /Sem\s*\d+-[A-Z0-9]+/i.test(x.semSec || '') && x.subject);
    if (c) { pick = { teacher: t, dayIdx: d, cls: c }; break; }
  }
  if (pick) break;
}
assert.ok(pick, 'bundled master schedule has at least one sectioned class');
const base = getTeacherDay(pick.teacher, pick.dayIdx, anchor, master);
assert.ok(base.length > 0, 'getTeacherDay returns the teacher\'s classes');
assert.ok(base.every((c, i) => i === 0 || base[i - 1].startM <= c.startM), 'sorted by start');
assert.ok(base.every(c => c.dayIdx === pick.dayIdx && c.dateStr), 'tagged with day + date');
console.log(`✅ Test 4: real data (${pick.teacher}, ${DAY_NAMES[pick.dayIdx]}) loads ${base.length} class(es)`);

// 5. Cancellation announcement flags (not removes) that class for this teacher
const m = String(pick.cls.semSec).match(/Sem\s*(\d+)-([A-Z0-9]+)/i);
const dateStr = getDateForDayIndex(pick.dayIdx, anchor);
State.allAnnouncementsList = [{
  id: 99, type: 'cancellation', date_override: dateStr,
  subject_override: pick.cls.subject, semester: m[1], section: m[2].toLowerCase(), title: 'Cancelled'
}];
const eff = getTeacherDay(pick.teacher, pick.dayIdx, anchor, master);
assert.strictEqual(eff.length, base.length, 'override flags, never removes');
const hit = eff.find(c => c.subject === pick.cls.subject && c.semSec === pick.cls.semSec);
assert.ok(hit && hit.isCancelled, 'matching class flagged isCancelled');
const nowInside = hit.startM + 1;
const st = getTeacherStatus(eff.filter(c => c.startM === hit.startM), nowInside);
assert.notStrictEqual(st.kind, 'in_class', 'cancelled class does not show as in class');
// Substring subjects must not match (exact === rule)
State.allAnnouncementsList = [{ ...State.allAnnouncementsList[0], subject_override: pick.cls.subject.slice(0, -1) || 'X' }];
const eff2 = getTeacherDay(pick.teacher, pick.dayIdx, anchor, master);
assert.ok(!eff2.some(c => c.isCancelled), 'partial subject code does not cancel anything');
State.allAnnouncementsList = [];
console.log('✅ Test 5: cancellations flag the teacher\'s class (exact subject match only)');

// 6. Week summary: one entry per course, sections sorted, per-week count
const week = getTeacherWeek(pick.teacher, anchor, master);
const courses = summarizeTeaching(week);
const totalClasses = Object.values(week).reduce((n, l) => n + l.length, 0);
assert.ok(courses.length > 0);
assert.strictEqual(courses.reduce((n, c) => n + c.perWeek, 0), totalClasses, 'perWeek sums to the week');
assert.strictEqual(new Set(courses.map(c => c.subject)).size, courses.length, 'no duplicate courses');
const synth = summarizeTeaching({ 6: [
  { subject: 'CSE', semSec: 'Sem 10-A' }, { subject: 'CSE', semSec: 'Sem 2-B' }, { subject: 'CSE', semSec: 'Sem 2-B' }
] });
assert.deepStrictEqual(synth[0].sections, ['2-B', '10-A'], 'sections numeric-sorted and de-duplicated');
assert.strictEqual(synth[0].perWeek, 3);
console.log('✅ Test 6: courses-taught summary');

// 7. "My teachers" from the user's routine, including combined codes
const mine = getMyTeacherCodes({ 0: [{ instructor: 'abc' }, { instructor: 'XYZ/DEF' }, { instructor: 'TBA' }, { instructor: '—' }] });
assert.ok(mine.has('ABC') && mine.has('XYZ') && mine.has('DEF'));
assert.ok(!mine.has('TBA') && !mine.has('—'));
console.log('✅ Test 7: my-teacher codes from the routine');

// 8. Display info: unknown code falls back to code, never yields a script link
const disp = getTeacherDisplay('ZZQ');
assert.strictEqual(disp.name, 'ZZQ');
assert.strictEqual(disp.hasName, false);
assert.strictEqual(disp.profileUrl, '');
assert.ok(disp.initials.length >= 1);
console.log('✅ Test 8: display fallbacks');

console.log('All Faculty directory tests passed.');
