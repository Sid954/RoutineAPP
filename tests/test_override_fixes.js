const assert = require('assert');

// Mock browser environment
global.window = {};

const { State } = require('../src/core/state.js');
const { getEffectiveRoomClasses, isSubjMatch } = require('../src/rooms/room-overrides.js');
const { getEffectiveClassesForDay, getActiveClass, getNextClass } = require('../src/schedule/queries.js');

console.log('=== Running Override Display & Subject Matching Tests ===');

// --- Test 1: Subject Matching Precision ---
assert.strictEqual(isSubjMatch('DS', 'DS'), true);
assert.strictEqual(isSubjMatch('ds', 'DS'), true);
assert.strictEqual(isSubjMatch('DS', 'DSL'), false, 'DS should NOT match DSL');
assert.strictEqual(isSubjMatch('DS', 'DATASET'), false, 'DS should NOT match DATASET');
assert.strictEqual(isSubjMatch('BS', 'BS'), true);
assert.strictEqual(isSubjMatch('BS', 'BS Lab'), false, 'BS should NOT match BS Lab');
console.log('✅ Test 1: Subject matching precision (exact match only) verified.');

// --- Test 2: Room Override Flagging (Not Removing) ---
const baseRoomClasses = [
  { start: '10:10 AM', end: '11:50 AM', startM: 610, endM: 710, subject: 'DS', instructor: 'MHE', type: 'Theory', semSec: 'Sem 3-B' },
  { start: '12:00 PM', end: '01:20 PM', startM: 720, endM: 800, subject: 'DSL', instructor: 'DAB', type: 'Lab', semSec: 'Sem 3-B' }
];

State.allAnnouncementsList = [
  {
    id: 301,
    type: 'cancellation',
    date_override: '2026-08-30',
    subject_override: 'DS',
    semester: '3',
    section: 'B'
  }
];

const roomResult = getEffectiveRoomClasses('403', 'Sunday', '2026-08-30', baseRoomClasses);

// Both classes still present in room timeline array!
assert.strictEqual(roomResult.length, 2, 'Classes should not be removed from room schedule array');
// DS is marked cancelled
assert.strictEqual(roomResult[0].subject, 'DS');
assert.strictEqual(roomResult[0].isCancelled, true, 'DS must be marked isCancelled = true');
// DSL is NOT marked cancelled
assert.strictEqual(roomResult[1].subject, 'DSL');
assert.strictEqual(Boolean(roomResult[1].isCancelled), false, 'DSL must NOT be marked isCancelled');
console.log('✅ Test 2: Cancelled room classes marked with isCancelled flag (not removed), and DSL unaffected.');

// --- Test 3: Rescheduled Class Flagging in Room ---
State.allAnnouncementsList = [
  {
    id: 302,
    type: 'rescheduled',
    date_override: '2026-08-30',
    subject_override: 'DS',
    semester: '3',
    section: 'B',
    announcement: JSON.stringify({
      target_subject: 'DS',
      original_date: '2026-08-30',
      new_date: '2026-09-01',
      new_start_time: '02:00 PM',
      new_end_time: '03:20 PM',
      new_room: 'Room 403',
      teacher: 'MHE'
    })
  }
];

const reschedOriginRoom = getEffectiveRoomClasses('403', 'Sunday', '2026-08-30', baseRoomClasses);
assert.strictEqual(reschedOriginRoom.length, 2);
assert.strictEqual(reschedOriginRoom[0].isRescheduled, true, 'Origin class marked isRescheduled = true');
assert.strictEqual(reschedOriginRoom[0].rescheduledTo, '2026-09-01');

const reschedDestRoom = getEffectiveRoomClasses('403', 'Tuesday', '2026-09-01', []);
assert.strictEqual(reschedDestRoom.length, 1);
assert.strictEqual(reschedDestRoom[0].subject, 'DS');
assert.strictEqual(reschedDestRoom[0].isRescheduledOverride, true);
console.log('✅ Test 3: Rescheduled origin marked isRescheduled, destination inserted.');

// --- Test 4: Online Class Replacement in Room ---
State.allAnnouncementsList = [
  {
    id: 303,
    type: 'online_class',
    date_override: '2026-08-30',
    subject_override: 'DS',
    semester: '3',
    section: 'B',
    announcement: JSON.stringify({
      is_online: true,
      platform: 'Google Meet'
    })
  }
];

const onlineRoom = getEffectiveRoomClasses('403', 'Sunday', '2026-08-30', baseRoomClasses);
assert.strictEqual(onlineRoom.length, 2);
assert.strictEqual(onlineRoom[0].isMovedOnline, true, 'Online class marked isMovedOnline = true');
console.log('✅ Test 4: Online class replacement marked isMovedOnline = true.');

// --- Test 5: Student Schedule Queries (getEffectiveClassesForDay) ---
State.schedule = {
  0: [
    { title: 'DS', start: '10:00', end: '11:15', room: '403', instructor: 'MHE', type: 'Theory' },
    { title: 'DSL', start: '11:30', end: '13:00', room: '503', instructor: 'DAB', type: 'Lab' }
  ]
};

State.announcementsList = [
  {
    id: 304,
    type: 'cancellation',
    date_override: '2026-08-30',
    subject_override: 'DS'
  }
];

const studentEffective = getEffectiveClassesForDay(0, '2026-08-30');
assert.strictEqual(studentEffective.length, 2, 'Timeline retains both classes');
assert.strictEqual(studentEffective[0].isCancelled, true, 'DS is marked isCancelled');
assert.strictEqual(Boolean(studentEffective[1].isCancelled), false, 'DSL is not cancelled');

// getActiveClass at 10:30 (during DS) skips cancelled DS -> returns null
const activeClass = getActiveClass(studentEffective, 630);
assert.strictEqual(activeClass, null, 'Active class skips cancelled class');

// getNextClass at 10:30 skips cancelled DS -> returns DSL
const nextClass = getNextClass(studentEffective, 630);
assert.strictEqual(nextClass.title, 'DSL', 'Next class skips cancelled DS and returns DSL');

console.log('✅ Test 5: getEffectiveClassesForDay, getActiveClass, and getNextClass verified.');

console.log('\n🎉 ALL 5 TEST SUITES PASSED CLEANLY!');
