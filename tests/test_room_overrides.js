const assert = require('assert');

// Mock browser environment for node testing
global.window = {};

// Import room overrides module
const {
  parseTimeToMins,
  normalizeRoomId,
  matchesSemSec,
  isSubjMatch,
  getEffectiveRoomClasses
} = require('../src/rooms/room-overrides.js');

const { State } = require('../src/core/state.js');

console.log('Testing Room Override Resolver...');

// Test 1: Time parsing
assert.strictEqual(parseTimeToMins('10:10 AM'), 610);
assert.strictEqual(parseTimeToMins('11:50 AM'), 710);
assert.strictEqual(parseTimeToMins('02:30 PM'), 870);
assert.strictEqual(parseTimeToMins('12:00 PM'), 720);
assert.strictEqual(parseTimeToMins('12:30 AM'), 30);
console.log('✅ Test 1: parseTimeToMins passed');

// Test 2: Room ID Normalization
assert.strictEqual(normalizeRoomId('Room 403'), '403');
assert.strictEqual(normalizeRoomId('403'), '403');
assert.strictEqual(normalizeRoomId('Room 1002'), '1002');
console.log('✅ Test 2: normalizeRoomId passed');

// Test 3: semSec Matching
assert.strictEqual(matchesSemSec('Sem 3-B', '3', 'b'), true);
assert.strictEqual(matchesSemSec('Sem 3-B', '3', 'a'), false);
assert.strictEqual(matchesSemSec('Sem 3-B', '2', 'b'), false);
assert.strictEqual(matchesSemSec('Sem 3-B', '3', ''), true); // Announcement targets whole semester 3
assert.strictEqual(matchesSemSec('Sem 3-B', '', ''), true); // Global announcement
console.log('✅ Test 3: matchesSemSec passed');

// Test 4: Subject matching (EXACT match only)
assert.strictEqual(isSubjMatch('BS', 'BS'), true);
assert.strictEqual(isSubjMatch('ICMP', 'ICMP'), true);
assert.strictEqual(isSubjMatch('DS', 'DSL'), false); // Precision test: DS should NOT match DSL!
assert.strictEqual(isSubjMatch('DSL', 'DS'), false);
assert.strictEqual(isSubjMatch('BS Theory', 'BS'), false);
assert.strictEqual(isSubjMatch('Math', 'BS'), false);
console.log('✅ Test 4: isSubjMatch exact match passed');

// Test 5: Cancellation override (Marks class as isCancelled: true)
const baseClasses = [
  { start: '10:10 AM', end: '11:50 AM', startM: 610, endM: 710, subject: 'BS', instructor: 'AZMAIN', type: 'Theory', semSec: 'Sem 3-B' },
  { start: '12:00 PM', end: '01:20 PM', startM: 720, endM: 800, subject: 'ICMP', instructor: 'DAB', type: 'Theory', semSec: 'Sem 2-A' }
];

State.allAnnouncementsList = [
  {
    id: 101,
    type: 'cancellation',
    date_override: '2026-08-30',
    subject_override: 'BS',
    semester: '3',
    section: 'B'
  }
];

const cancelledResult = getEffectiveRoomClasses('403', 'Sunday', '2026-08-30', baseClasses);
assert.strictEqual(cancelledResult.length, 2);
assert.strictEqual(cancelledResult[0].subject, 'BS');
assert.strictEqual(cancelledResult[0].isCancelled, true);
assert.strictEqual(cancelledResult[1].subject, 'ICMP');
assert.strictEqual(cancelledResult[1].isCancelled, undefined);
console.log('✅ Test 5: Cancellation marked class with isCancelled: true without removing it');

// Different date -> base classes unchanged
const otherDateResult = getEffectiveRoomClasses('403', 'Monday', '2026-08-31', baseClasses);
assert.strictEqual(otherDateResult.length, 2);
assert.strictEqual(otherDateResult[0].isCancelled, undefined);
console.log('✅ Test 5b: Different date retains all classes unmarked');

// Test 6: Rescheduled class
State.allAnnouncementsList = [
  {
    id: 102,
    type: 'rescheduled',
    date_override: '2026-08-30',
    subject_override: 'BS',
    semester: '3',
    section: 'B',
    announcement: JSON.stringify({
      target_subject: 'BS',
      original_date: '2026-08-30',
      new_date: '2026-09-01',
      new_start_time: '02:00 PM',
      new_end_time: '03:20 PM',
      new_room: 'Room 403',
      teacher: 'AZMAIN'
    })
  }
];

// On origin date (2026-08-30), class is marked isRescheduled: true in Room 403
const sourceDateResult = getEffectiveRoomClasses('403', 'Sunday', '2026-08-30', baseClasses);
assert.strictEqual(sourceDateResult.length, 2);
assert.strictEqual(sourceDateResult[0].subject, 'BS');
assert.strictEqual(sourceDateResult[0].isRescheduled, true);
assert.strictEqual(sourceDateResult[0].rescheduledTo, '2026-09-01');
console.log('✅ Test 6a: Reschedule source slot marked isRescheduled: true');

// On destination date (2026-09-01), class is added to Room 403
const destDateResult = getEffectiveRoomClasses('403', 'Tuesday', '2026-09-01', []);
assert.strictEqual(destDateResult.length, 1);
assert.strictEqual(destDateResult[0].subject, 'BS');
assert.strictEqual(destDateResult[0].startM, 840);
assert.strictEqual(destDateResult[0].endM, 920);
assert.strictEqual(destDateResult[0].isRescheduledOverride, true);
console.log('✅ Test 6b: Reschedule destination slot inserted');

// Test 7: Extra In-Person Class
State.allAnnouncementsList = [
  {
    id: 103,
    type: 'online_class',
    title: 'Extra Class for Algorithms',
    date_override: '2026-08-30',
    subject_override: 'DS',
    semester: '4',
    section: 'A',
    announcement: JSON.stringify({
      is_extra_class: true,
      is_online: false,
      room: '403',
      teacher: 'MHE',
      start_time: '03:00 PM',
      end_time: '04:20 PM'
    })
  }
];

const extraClassResult = getEffectiveRoomClasses('403', 'Sunday', '2026-08-30', baseClasses);
assert.strictEqual(extraClassResult.length, 3);
assert.strictEqual(extraClassResult[2].subject, 'DS');
assert.strictEqual(extraClassResult[2].startM, 900);
assert.strictEqual(extraClassResult[2].endM, 980);
assert.strictEqual(extraClassResult[2].isExtraClassOverride, true);
console.log('✅ Test 7: Extra In-Person Class inserted into room timeline');

// Test 8: University-wide Holiday marks classes as isCancelled
State.allAnnouncementsList = [
  {
    id: 104,
    type: 'holiday',
    date_override: '2026-08-30',
    title: 'National Holiday'
  }
];

const holidayResult = getEffectiveRoomClasses('403', 'Sunday', '2026-08-30', baseClasses);
assert.strictEqual(holidayResult.length, 2);
assert.strictEqual(holidayResult[0].isCancelled, true);
assert.strictEqual(holidayResult[1].isCancelled, true);
console.log('✅ Test 8: Holiday marks all room classes for the date as isCancelled: true');

console.log('\n🎉 ALL 8 TEST SUITES PASSED CLEANLY!');
