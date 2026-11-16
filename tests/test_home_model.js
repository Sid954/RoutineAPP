const assert = require('assert');

global.window = {};
global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem() {} };
const stubEl = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild() {}, addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [] });
global.document = { getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], addEventListener() {}, createElement: stubEl, body: stubEl(), documentElement: { getAttribute: () => 'dark' } };

const { State } = require('../src/core/state.js');
const M = require('../src/home/home-model.js');

console.log('Testing Home model (now card, day timeline, summary)...');

// Saturday 21 Nov 2026 (a class day), local time
const SAT = new Date(2026, 10, 21);
const at = (h, m) => new Date(2026, 10, 21, h, m);
const dow = SAT.getDay();
assert.strictEqual(dow, 6);
const base = () => ({
  [dow]: [
    { title: 'DSA', start: '09:00', end: '10:15', room: '905', instructor: 'MHE', type: 'Theory' },
    { title: 'DSAL', start: '10:30', end: '11:45', room: '704', instructor: 'MHE', type: 'Lab' },
    { title: 'MATH', start: '13:00', end: '14:15', room: '501', instructor: 'ABC', type: 'Theory' }
  ],
  0: [{ title: 'ENG', start: '09:45', end: '11:00', room: '301', instructor: 'XYZ', type: 'Theory' }]
});
State.schedule = base();
State.announcementsList = [];
State.allAnnouncementsList = [];

// 1. Day normalisation
let day = M.getDay(dow, SAT);
assert.strictEqual(day.length, 3);
assert.deepStrictEqual(day.map(c => c.startM), [540, 630, 780]);
assert.ok(day[1].isLab && !day[0].isLab);
assert.strictEqual(day[0].status, 'normal');
assert.strictEqual(day[0].room, '905');
console.log('✅ Test 1: day classes normalised and sorted');

// 2. Summary: count, span, busy time, longest break, labs
const sum = M.daySummary(day);
assert.strictEqual(sum.count, 3);
assert.strictEqual(sum.first, 540);
assert.strictEqual(sum.last, 855);
assert.strictEqual(sum.busyMins, 225);
assert.strictEqual(sum.longestGap, 75);
assert.strictEqual(sum.labs, 1);
console.log('✅ Test 2: day summary');

// 3. Timeline: gaps between classes, live/next/past states, now-gap
let tl = M.buildTimeline(day, [], { isToday: true, nowM: 12 * 60 });
assert.deepStrictEqual(tl.map(i => i.kind), ['class', 'gap', 'class', 'gap', 'class']);
assert.deepStrictEqual(tl.filter(i => i.kind === 'class').map(i => i.state), ['past', 'past', 'next']);
assert.ok(tl[3].isNow && !tl[1].isNow, 'the 11:45-13:00 break is "now" at noon');
tl = M.buildTimeline(day, [], { isToday: true, nowM: 9 * 60 + 30 });
assert.strictEqual(tl[0].state, 'live');
assert.strictEqual(tl.filter(i => i.kind === 'class')[1].state, 'next');
tl = M.buildTimeline(day, [{ id: 'd1', title: 'Report', dueM: 1439, dueText: '11:59 PM' }], { isToday: false });
assert.strictEqual(tl[tl.length - 1].kind, 'deadline', 'deadline sorts by due time');
assert.ok(tl.filter(i => i.kind === 'class').every(i => i.state === 'later'), 'no states on other days');
console.log('✅ Test 3: timeline gaps, states and deadlines');

// 4. Now card states through the day
assert.strictEqual(M.nowState(at(8, 0)).kind, 'before');
assert.strictEqual(M.nowState(at(8, 0)).inMins, 60);
let s = M.nowState(at(9, 30));
assert.strictEqual(s.kind, 'live');
assert.strictEqual(s.c.title, 'DSA');
assert.strictEqual(s.leftMins, 45);
assert.strictEqual(Math.round(s.pct), 40);
assert.strictEqual(s.after.title, 'DSAL');
assert.strictEqual(s.index, 1);
s = M.nowState(at(12, 0));
assert.strictEqual(s.kind, 'break');
assert.strictEqual(s.c.title, 'MATH');
assert.strictEqual(s.inMins, 60);
assert.strictEqual(s.left, 1);
s = M.nowState(at(15, 0));
assert.strictEqual(s.kind, 'done');
assert.ok(s.upcoming && s.upcoming.c.title === 'ENG', 'done -> next class is Sunday ENG');
assert.strictEqual(s.upcoming.date.getDay(), 0);
console.log('✅ Test 4: now card (before / live / break / done + next class)');

// 5. Cancellation is flagged (kept), never live, and the next held class takes over
State.announcementsList = [{ id: 1, type: 'cancellation', date_override: '2026-11-21', subject_override: 'DSA', announcement: 'Teacher on leave' }];
day = M.getDay(dow, SAT);
assert.strictEqual(day.length, 3, 'flagged, not removed');
assert.strictEqual(day[0].status, 'cancelled');
assert.strictEqual(day[0].cancelReason, 'Teacher on leave');
s = M.nowState(at(9, 30));
assert.strictEqual(s.kind, 'before', 'cancelled class is not live; DSAL is first');
assert.strictEqual(s.c.title, 'DSAL');
assert.strictEqual(M.daySummary(day).cancelled, 1);
assert.strictEqual(M.daySummary(day).count, 2);
console.log('✅ Test 5: cancellations flagged, skipped by now card');

// 6. Class test flag + exam alert
State.announcementsList = [{ id: 2, type: 'class_test', date_override: '2026-11-21', subject_override: 'MATH', announcement: JSON.stringify({ exam_name: 'CT-2', topics: 'Ch 3' }) }];
day = M.getDay(dow, SAT);
const math = day.find(c => c.title === 'MATH');
assert.ok(math.isExam && math.exam.name === 'CT-2' && math.exam.topics === 'Ch 3');
assert.strictEqual(M.nowState(at(9, 0)).exams.length, 1, 'today test surfaces in the now card');
assert.strictEqual(M.daySummary(day).tests, 1);
console.log('✅ Test 6: class tests flagged');

// 7. Holiday: all classes flagged cancelled, now card shows the holiday
State.announcementsList = [{ id: 3, type: 'holiday', date_override: '2026-11-21', title: 'Victory Day', announcement: 'Off' }];
day = M.getDay(dow, SAT);
assert.ok(day.every(c => c.status === 'cancelled'));
s = M.nowState(at(10, 0));
assert.strictEqual(s.kind, 'holiday');
assert.strictEqual(s.holiday.title, 'Victory Day');
console.log('✅ Test 7: holiday');

// 8. Reschedule: moved away from Sat, moved in on Sunday
State.announcementsList = [{ id: 4, type: 'rescheduled', date_override: '2026-11-21', subject_override: 'MATH',
  announcement: JSON.stringify({ target_subject: 'MATH', original_date: '2026-11-21', new_date: '2026-11-22', new_start_time: '02:00 PM', new_room: '601' }) }];
day = M.getDay(dow, SAT);
assert.strictEqual(day.find(c => c.title === 'MATH').status, 'moved_away');
assert.strictEqual(M.daySummary(day).count, 2);
const sun = M.getDay(0, new Date(2026, 10, 22));
const movedIn = sun.find(c => c.title === 'MATH');
assert.ok(movedIn && movedIn.status === 'moved_in' && movedIn.startM === 840 && movedIn.room === '601');
console.log('✅ Test 8: rescheduled away / in');

// 9. Off day and academic week
State.announcementsList = [];
const thu = new Date(2026, 10, 19);
assert.strictEqual(M.nowState(new Date(2026, 10, 19, 10, 0)).kind, 'off');
assert.ok(!M.isClassDay(thu.getDay()));
const wk = M.academicWeek(SAT);
assert.strictEqual(wk.length, 7);
assert.strictEqual(wk[0].getDay(), 4, 'week starts Thursday');
assert.strictEqual(wk[6].getDay(), 3, 'week ends Wednesday');
assert.ok(wk.some(d => d.getDate() === 21));
assert.strictEqual(M.relDay(new Date(2026, 10, 22), at(9, 0)), 'Tomorrow');
assert.strictEqual(M.dur(75), '1h 15m');
assert.strictEqual(M.t12(780), '1:00 PM');
console.log('✅ Test 9: off day, academic week, labels');

console.log('All Home model tests passed.');
