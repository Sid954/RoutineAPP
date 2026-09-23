const assert = require('assert');

// Mock browser environment for node testing
global.window = {};

const {
  evaluateRoomStatus,
  getRoomDayTimeline,
  formatMinuteTo12h
} = require('../src/rooms/room-engine.js');

console.log('Testing Room Occupancy Contiguous-Block Merging (Issue 1)...');

const cls = (startM, endM, subject) => ({
  start: formatMinuteTo12h(startM),
  end: formatMinuteTo12h(endM),
  startM,
  endM,
  subject,
  instructor: 'TST',
  type: 'Theory',
  semSec: 'Sem 1-A'
});

const ROOM = { id: '404', name: 'Room 404', floor: 4, type: 'classroom', capacity: 60 };

// Room 404's real Wednesday blocks: five back-to-back 75-min classes, 08:30 -> 14:45
// 08:30=510  09:45=585  11:00=660  12:15=735  13:30=810  14:45=885
const CONTIGUOUS = [
  cls(510, 585, 'GE'),
  cls(585, 660, 'GE'),
  cls(660, 735, 'GE'),
  cls(735, 810, 'PF'),
  cls(810, 885, 'DIC')
];
const AT_1206 = 726; // 12:06 PM

// ---------------------------------------------------------------------------
// Test 1: zero-gap back-to-back blocks must merge into one occupied streak
// ---------------------------------------------------------------------------
{
  const s = evaluateRoomStatus(ROOM, CONTIGUOUS, AT_1206);
  assert.strictEqual(s.status, 'OCCUPIED', 'room must read as OCCUPIED mid-streak');
  assert.strictEqual(s.occupiedUntilMins, 885, 'streak must extend to 14:45, not stop at 12:15');
  assert.strictEqual(s.minsUntilFree, 159, 'true time until free = 14:45 - 12:06 = 159 min');
  assert.strictEqual(s.occupiedUntilStr, '02:45 PM');
  // The reported bug: this rendered "Free in 9m" because minsUntilFree was 9.
  assert.ok(s.minsUntilFree > 30, 'must not fall into the <=30m "freeing soon" tier');
  console.log('✅ Test 1: Back-to-back blocks merge — occupied until 02:45 PM, not "Free in 9m"');
}

// ---------------------------------------------------------------------------
// Test 2: merging must STOP at a genuine gap (no over-merging)
// 10:00->11:00, then a 15-minute gap, then 11:15->12:30
// ---------------------------------------------------------------------------
{
  const withGap = [cls(600, 660, 'A'), cls(675, 750, 'B')];
  const s = evaluateRoomStatus(ROOM, withGap, 630); // 10:30 AM, inside block A
  assert.strictEqual(s.status, 'OCCUPIED');
  assert.strictEqual(s.occupiedUntilMins, 660, 'must stop at 11:00 — real gap before next class');
  assert.strictEqual(s.minsUntilFree, 30);
  // And the room is genuinely free during the gap, with next class at 11:15
  const sInGap = evaluateRoomStatus(ROOM, withGap, 665); // 11:05 AM
  assert.strictEqual(sInGap.status, 'FREE');
  assert.strictEqual(sInGap.freeUntilMins, 675, 'free only until 11:15');
  assert.strictEqual(sInGap.freeDurationMins, 10);
  console.log('✅ Test 2: Merge stops at a real 15-minute gap; gap itself reported as free');
}

// ---------------------------------------------------------------------------
// Test 3: regression guard — single isolated class behaves exactly as before
// ---------------------------------------------------------------------------
{
  const single = [cls(540, 600, 'SOLO')]; // 09:00 -> 10:00
  const s = evaluateRoomStatus(ROOM, single, 570); // 09:30
  assert.strictEqual(s.status, 'OCCUPIED');
  assert.strictEqual(s.occupiedUntilMins, 600);
  assert.strictEqual(s.minsUntilFree, 30);
  const before = evaluateRoomStatus(ROOM, single, 480); // 08:00, class not started
  assert.strictEqual(before.status, 'FREE');
  assert.strictEqual(before.freeUntilMins, 540);
  const after = evaluateRoomStatus(ROOM, single, 700); // 11:40, class finished
  assert.strictEqual(after.status, 'FREE');
  assert.strictEqual(after.isFreeRestOfDay, true);
  console.log('✅ Test 3: Single-class room (before / during / after) unchanged');
}

// ---------------------------------------------------------------------------
// Test 4: overlapping (not just touching) blocks also merge; conflict still detected
// ---------------------------------------------------------------------------
{
  const overlapping = [cls(660, 735, 'X'), cls(700, 800, 'Y'), cls(800, 850, 'Z')];
  const s = evaluateRoomStatus(ROOM, overlapping, 710); // 11:50 — both X and Y live
  assert.strictEqual(s.status, 'OCCUPIED');
  assert.strictEqual(s.hasConflict, true, 'two classes active at once is still a conflict');
  assert.strictEqual(s.occupiedUntilMins, 850, '08:00 PM-ish chain: 660->800 then 800->850');
  assert.strictEqual(s.minsUntilFree, 140);
  console.log('✅ Test 4: Overlapping blocks merge and conflict flag survives');
}

// ---------------------------------------------------------------------------
// Test 5: no classes today at all (empty-day path untouched)
// ---------------------------------------------------------------------------
{
  const s = evaluateRoomStatus(ROOM, [], AT_1206);
  assert.strictEqual(s.status, 'FREE');
  assert.strictEqual(s.isFreeRestOfDay, true);
  console.log('✅ Test 5: Empty schedule still reports free all day');
}

// ---------------------------------------------------------------------------
// Test 6: detail-sheet timeline must not invent free gaps inside a streak
// ---------------------------------------------------------------------------
{
  const blocks = getRoomDayTimeline(ROOM, CONTIGUOUS, AT_1206);
  const gaps = blocks.filter(b => b.isGap);
  assert.strictEqual(gaps.length, 0, 'five contiguous blocks have zero free gaps');
  console.log('✅ Test 6a: Timeline emits no phantom gaps for contiguous blocks');

  // A 09:00-10:30, B 09:30-10:00 (fully inside A), C 11:00-12:00
  // The real free window is 10:30 -> 11:00, NOT 10:00 -> 11:00.
  const nested = [cls(540, 630, 'A'), cls(570, 600, 'B'), cls(660, 720, 'C')];
  const nb = getRoomDayTimeline(ROOM, nested, 480);
  const ngaps = nb.filter(b => b.isGap);
  assert.strictEqual(ngaps.length, 1, 'exactly one free gap expected');
  assert.strictEqual(ngaps[0].startM, 630, 'gap must start at the true streak end 10:30, not 10:00');
  assert.strictEqual(ngaps[0].endM, 660);
  assert.strictEqual(ngaps[0].durationMins, 30);
  console.log('✅ Test 6b: Timeline gap starts at merged streak end (10:30), not the nested block end');
}

// ---------------------------------------------------------------------------
// Test 7: cancelled Room 404 blocks must free the room and open timeline gaps
// ---------------------------------------------------------------------------
{
  const cancelledRoom404 = CONTIGUOUS.map(c => (
    c.startM === 660 || c.startM === 735 ? { ...c, isCancelled: true } : c
  ));
  const s = evaluateRoomStatus(ROOM, cancelledRoom404, AT_1206);
  assert.strictEqual(s.status, 'FREE');
  assert.strictEqual(s.freeUntilMins, 810, 'next physical class is the 01:30 PM block');

  const blocks = getRoomDayTimeline(ROOM, cancelledRoom404, AT_1206);
  const gaps = blocks.filter(b => b.isGap);
  assert.ok(gaps.some(gap => gap.startM === 660 && gap.endM === 810), 'cancelled blocks must create a 11:00 AM–01:30 PM free gap');
  console.log('✅ Test 7: Cancelled Room 404 blocks free the room and create timeline gaps');
}

// ---------------------------------------------------------------------------
// Test 8: an origin reschedule frees its original room and time
// ---------------------------------------------------------------------------
{
  const originVacated = [cls(660, 735, 'Moved'), cls(810, 885, 'Later')];
  originVacated[0].isRescheduled = true;
  const s = evaluateRoomStatus(ROOM, originVacated, 700);
  assert.strictEqual(s.status, 'FREE');
  assert.strictEqual(s.freeUntilMins, 810);
  console.log('✅ Test 8: Origin-rescheduled class does not occupy its old room');
}

// ---------------------------------------------------------------------------
// Test 9: a destination reschedule remains a physical room occupancy
// ---------------------------------------------------------------------------
{
  const destinationInserted = [cls(660, 735, 'Moved')];
  destinationInserted[0].isRescheduledOverride = true;
  const s = evaluateRoomStatus(ROOM, destinationInserted, 700);
  assert.strictEqual(s.status, 'OCCUPIED');
  assert.strictEqual(s.occupiedUntilMins, 735);
  console.log('✅ Test 9: Destination-rescheduled class occupies its new room');
}

// ---------------------------------------------------------------------------
// Test 10: online replacements and university-wide holidays free rooms
// ---------------------------------------------------------------------------
{
  const onlineReplacement = [Object.assign(cls(660, 735, 'Online'), { isMovedOnline: true })];
  const onlineStatus = evaluateRoomStatus(ROOM, onlineReplacement, 700);
  assert.strictEqual(onlineStatus.status, 'FREE');
  assert.strictEqual(onlineStatus.isFreeRestOfDay, true);

  const universityHoliday = CONTIGUOUS.map(c => ({ ...c, isCancelled: true }));
  const holidayStatus = evaluateRoomStatus(ROOM, universityHoliday, AT_1206);
  assert.strictEqual(holidayStatus.status, 'FREE');
  assert.strictEqual(holidayStatus.isFreeRestOfDay, true);
  console.log('✅ Test 10: Online replacements and university-wide holidays free rooms');
}

// ---------------------------------------------------------------------------
// Test 11: cancelled entries cannot hide a simultaneous real class
// ---------------------------------------------------------------------------
{
  const mixed = [
    Object.assign(cls(660, 735, 'Cancelled'), { isCancelled: true }),
    cls(660, 735, 'Physical')
  ];
  const s = evaluateRoomStatus(ROOM, mixed, 700);
  assert.strictEqual(s.status, 'OCCUPIED');
  assert.strictEqual(s.currentClasses.length, 1, 'only the physical class is active');
  assert.strictEqual(s.currentClasses[0].subject, 'Physical');
  assert.strictEqual(s.hasConflict, false, 'cancelled entry cannot create a conflict');
  console.log('✅ Test 11: Mixed real and cancelled classes retain only real occupancy');
}

console.log('\n🎉 ALL ROOM OCCUPANCY MERGE TESTS PASSED CLEANLY!');
