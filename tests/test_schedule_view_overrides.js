const assert = require('assert');

// Mock browser environment
global.window = {};

const { State } = require('../src/core/state.js');
const { getEffectiveClassesForDay, getActiveClass, getNextClass } = require('../src/schedule/queries.js');

console.log('Testing Schedule View Override Integration...');

// Setup base schedule for Sunday (dayIdx 0) and Tuesday (dayIdx 2)
State.schedule = {
  0: [
    { title: 'MATH', start: '09:45', end: '11:00', room: '403', instructor: 'ABC', type: 'Theory' },
    { title: 'PHYSICS', start: '11:15', end: '12:30', room: '404', instructor: 'XYZ', type: 'Theory' }
  ],
  2: [
    { title: 'CHEM', start: '10:00', end: '11:15', room: '503', instructor: 'DEF', type: 'Theory' }
  ]
};

// 1. Test Base Schedule without overrides
const baseSun = getEffectiveClassesForDay(0, '2026-08-30');
assert.strictEqual(baseSun.length, 2);
assert.strictEqual(baseSun[0].title, 'MATH');
assert.strictEqual(baseSun[1].title, 'PHYSICS');
console.log('✅ Test 1: Base routine returned cleanly without overrides');

// 2. Test Cancellation of MATH on 2026-08-30
State.announcementsList = [
  {
    id: 201,
    type: 'cancellation',
    date_override: '2026-08-30',
    subject_override: 'MATH',
    title: 'Math Cancelled'
  }
];

const cancelledSun = getEffectiveClassesForDay(0, '2026-08-30');
// Per commit 9ba2156, overrides FLAG classes instead of removing them from the
// array (so the UI can render a strikethrough/badge instead of a gap). Cancelled
// classes stay in the returned array with isCancelled: true.
assert.strictEqual(cancelledSun.length, 2);
assert.strictEqual(cancelledSun[0].title, 'MATH');
assert.strictEqual(cancelledSun[0].isCancelled, true);
assert.strictEqual(cancelledSun[1].title, 'PHYSICS');
assert.ok(!cancelledSun[1].isCancelled);
console.log('✅ Test 2: Cancelled class flagged isCancelled (not removed) in effective routine');

// Test current / next class with cancellation
// At 10:00 AM (600 mins): MATH was scheduled 09:45-11:00. Since MATH is cancelled, getActiveClass is null!
const currentAt10 = getActiveClass(cancelledSun, 600);
assert.strictEqual(currentAt10, null);
console.log('✅ Test 2b: Cancelled class not marked active');

// Next class at 10:00 AM becomes PHYSICS (starts at 11:15)
const nextAt10 = getNextClass(cancelledSun, 600);
assert.strictEqual(nextAt10.title, 'PHYSICS');
console.log('✅ Test 2c: Next class advances past cancelled class to PHYSICS');

// 3. Test Rescheduled Class (PHYSICS moving to Tuesday 2026-09-01 at 02:00 PM)
State.announcementsList = [
  {
    id: 202,
    type: 'rescheduled',
    date_override: '2026-08-30',
    subject_override: 'PHYSICS',
    announcement: JSON.stringify({
      target_subject: 'PHYSICS',
      original_date: '2026-08-30',
      new_date: '2026-09-01',
      new_start_time: '02:00 PM',
      new_end_time: '03:15 PM',
      new_room: '404',
      teacher: 'XYZ'
    })
  }
];

// On origin Sunday (2026-08-30): PHYSICS stays in the array but flagged isRescheduled
// (per commit 9ba2156's flag-not-filter fix, it no longer disappears from the origin date)
const reschedSun = getEffectiveClassesForDay(0, '2026-08-30');
assert.strictEqual(reschedSun.length, 2);
assert.strictEqual(reschedSun[0].title, 'MATH');
assert.strictEqual(reschedSun[1].title, 'PHYSICS');
assert.strictEqual(reschedSun[1].isRescheduled, true);
console.log('✅ Test 3a: Moved class flagged isRescheduled (not removed) on origin date routine');

// On destination Tuesday (2026-09-01): CHEM (10:00 AM) + incoming PHYSICS (02:00 PM)
const reschedTue = getEffectiveClassesForDay(2, '2026-09-01');
assert.strictEqual(reschedTue.length, 2);
assert.strictEqual(reschedTue[0].title, 'CHEM');
assert.strictEqual(reschedTue[1].title, 'PHYSICS');
assert.strictEqual(reschedTue[1].start, '02:00 PM');
assert.strictEqual(reschedTue[1].isRescheduled, true);
console.log('✅ Test 3b: Moved class added to destination date routine');

// 4. Test Extra Class on Tuesday
State.announcementsList.push({
  id: 203,
  type: 'online_class',
  date_override: '2026-09-01',
  subject_override: 'ALGO EXTRA',
  title: 'Extra Algorithm Session',
  announcement: JSON.stringify({
    is_extra_class: true,
    is_online: false,
    start_time: '12:00 PM',
    end_time: '01:15 PM',
    room: '601',
    teacher: 'MHE'
  })
});

const extraTue = getEffectiveClassesForDay(2, '2026-09-01');
assert.strictEqual(extraTue.length, 3);
assert.strictEqual(extraTue[0].title, 'CHEM'); // 10:00 AM
assert.strictEqual(extraTue[1].title, 'ALGO EXTRA'); // 12:00 PM
assert.strictEqual(extraTue[2].title, 'PHYSICS'); // 02:00 PM
console.log('✅ Test 4: Extra class inserted and sorted chronologically');

// 5. Test Holiday Override
State.announcementsList = [
  {
    id: 204,
    type: 'holiday',
    date_override: '2026-08-30',
    title: 'National Holiday'
  }
];

const holidaySun = getEffectiveClassesForDay(0, '2026-08-30');
// Per commit 9ba2156, holidays flag every class isCancelled instead of clearing
// the array — the UI renders the day's classes with a cancelled/holiday badge.
assert.strictEqual(holidaySun.length, 2);
assert.ok(holidaySun.every(c => c.isCancelled === true));
console.log('✅ Test 5: Holiday flags all classes as cancelled (not removed) from effective routine');

console.log('\n🎉 ALL SCHEDULE VIEW OVERRIDE TESTS PASSED CLEANLY!');
