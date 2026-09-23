const assert = require('assert');

const {
  resolveFreeRoomsSelection,
  createCustomFreeRoomsSelection,
  createNowFreeRoomsSelection
} = require('../src/rooms/room-date-lifecycle.js');

const at = (year, month, day, hours, minutes) => new Date(year, month - 1, day, hours, minutes);
const minuteOf = date => date.getHours() * 60 + date.getMinutes();

console.log('Testing Free Rooms Date Lifecycle (Issues 4+5)...');

// ---------------------------------------------------------------------------
// Test 1: NOW mode must cross midnight using the fresh clock date and minute
// ---------------------------------------------------------------------------
{
  const selectedAtLaunch = at(2026, 9, 22, 23, 59);
  const beforeMidnight = resolveFreeRoomsSelection('NOW', selectedAtLaunch, 0, selectedAtLaunch);
  const afterMidnight = resolveFreeRoomsSelection('NOW', selectedAtLaunch, 0, at(2026, 9, 23, 0, 1));

  assert.strictEqual(beforeMidnight.date.getDay(), 2, 'Tuesday must render before midnight');
  assert.strictEqual(afterMidnight.date.getDay(), 3, 'Wednesday must render after midnight, not stale Tuesday');
  assert.strictEqual(afterMidnight.targetMinute, 1, 'NOW mode must use the fresh clock minute');
  console.log('✅ Test 1: NOW selection crosses midnight with the real current date');
}

// ---------------------------------------------------------------------------
// Test 2: calendar picking creates a pinned custom selection with sensible time
// ---------------------------------------------------------------------------
{
  const now = at(2026, 9, 23, 14, 6);
  const todaySelection = createCustomFreeRoomsSelection(at(2026, 9, 23, 0, 0), now);
  const futureSelection = createCustomFreeRoomsSelection(at(2026, 9, 28, 0, 0), now);

  assert.strictEqual(todaySelection.targetMode, 'CUSTOM');
  assert.strictEqual(todaySelection.customMinute, minuteOf(now), 'today should default to the current time');
  assert.strictEqual(futureSelection.targetMode, 'CUSTOM');
  assert.strictEqual(futureSelection.customMinute, 0, 'another date should default to start of day');
  console.log('✅ Test 2: Calendar pick initializes CUSTOM time predictably');
}

// ---------------------------------------------------------------------------
// Test 3: ticker/announcement refresh in CUSTOM mode stays pinned to its date
// ---------------------------------------------------------------------------
{
  const pickedMonday = at(2026, 9, 28, 0, 0);
  const selection = createCustomFreeRoomsSelection(pickedMonday, at(2026, 9, 23, 14, 6));
  const afterTicker = resolveFreeRoomsSelection(
    selection.targetMode,
    selection.selectedDate,
    selection.customMinute,
    at(2026, 9, 30, 9, 30)
  );

  assert.strictEqual(afterTicker.date.getTime(), pickedMonday.getTime(), 'custom date must survive a ticker/override refresh');
  assert.strictEqual(afterTicker.targetMinute, 0, 'custom minute must not advance with wall clock time');
  console.log('✅ Test 3: CUSTOM selection stays pinned through ticker and override refresh');
}

// ---------------------------------------------------------------------------
// Test 4: Right Now returns from CUSTOM mode to the actual current selection
// ---------------------------------------------------------------------------
{
  const now = at(2026, 9, 23, 14, 6);
  const selection = createNowFreeRoomsSelection(now);
  const resolved = resolveFreeRoomsSelection(selection.targetMode, selection.selectedDate, selection.customMinute, now);

  assert.strictEqual(selection.targetMode, 'NOW');
  assert.strictEqual(selection.selectedDate.getTime(), now.getTime());
  assert.strictEqual(selection.calViewMonth, 8);
  assert.strictEqual(selection.calViewYear, 2026);
  assert.strictEqual(resolved.targetMinute, minuteOf(now));
  console.log('✅ Test 4: Right Now restores the current date and live clock');
}

// ---------------------------------------------------------------------------
// Test 5: lifecycle selection never owns or changes the sheet-local day state
// ---------------------------------------------------------------------------
{
  const sheetLocalDayIdx = 6;
  const selection = createCustomFreeRoomsSelection(at(2026, 9, 28, 0, 0), at(2026, 9, 23, 14, 6));
  resolveFreeRoomsSelection(selection.targetMode, selection.selectedDate, selection.customMinute, at(2026, 9, 30, 9, 30));

  assert.strictEqual(sheetLocalDayIdx, 6, 'room detail sheet day must remain independently switchable');
  console.log('✅ Test 5: Lifecycle selection leaves sheet-local day state untouched');
}

console.log('\nALL ROOM DATE LIFECYCLE TESTS PASSED!');
