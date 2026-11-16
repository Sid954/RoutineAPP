const assert = require('assert');

// Mock browser environment
global.window = {};

const { State } = require('../src/core/state.js');
const {
  getOverridesByDateMap,
  getOverrideBadgeSlots,
  getCalendarBackgroundType
} = require('../src/announcements/overrides.js');

console.log('Testing multi-override indicators (week strip badges, calendar colouring)...');

// 1. Date map tracks every distinct type, highest priority first
State.announcementsList = [
  { id: 1, type: 'assignment', date_override: '2026-11-20', announcement: '{}' },
  { id: 2, type: 'class_test', date_override: '2026-11-20', announcement: '{}' },
  { id: 3, type: 'online_class', date_override: '2026-11-20', announcement: '{}' },
  { id: 4, type: 'cancellation', date_override: '2026-11-20', subject_override: 'X' },
  { id: 5, type: 'assignment', date_override: '2026-11-20', announcement: '{}' }, // duplicate type
  { id: 6, type: 'general', date_override: '2026-11-20' },                        // ignored
  { id: 7, type: 'rescheduled', date_override: '2026-11-21',
    announcement: JSON.stringify({ original_date: '2026-11-21', new_date: '2026-11-20' }) }
];
const map = getOverridesByDateMap();
const day = map.get('2026-11-20');
assert.strictEqual(day.type, 'cancellation', 'highest priority drives the main badge');
assert.deepStrictEqual(day.types, ['cancellation', 'class_test', 'rescheduled', 'online_class', 'assignment']);
assert.strictEqual(day.count, 6, 'count includes duplicates and the rescheduled destination');
assert.deepStrictEqual(map.get('2026-11-21').types, ['rescheduled']);
console.log('✅ Test 1: per-date distinct types in priority order');

// 2. Badge slots: <=3 shown as-is, more collapses into a +N chip in the 3rd slot
assert.deepStrictEqual(getOverrideBadgeSlots([]), { icons: [], more: 0 });
assert.deepStrictEqual(getOverrideBadgeSlots(['holiday']), { icons: ['holiday'], more: 0 });
assert.deepStrictEqual(getOverrideBadgeSlots(['a', 'b', 'c']), { icons: ['a', 'b', 'c'], more: 0 });
assert.deepStrictEqual(getOverrideBadgeSlots(day.types), { icons: ['cancellation', 'class_test'], more: 3 });
assert.deepStrictEqual(getOverrideBadgeSlots(undefined), { icons: [], more: 0 });
console.log('✅ Test 2: badge stack caps at 3 slots with +N overflow');

// 3. Calendar background: only class_test / assignment; class_test wins
assert.strictEqual(getCalendarBackgroundType(day.types), 'class_test');
assert.strictEqual(getCalendarBackgroundType(['holiday', 'assignment']), 'assignment');
assert.strictEqual(getCalendarBackgroundType(['holiday', 'cancellation', 'online_class']), null);
assert.strictEqual(getCalendarBackgroundType(null), null);
console.log('✅ Test 3: calendar tint priority (class test > assignment > none)');

console.log('All override indicator tests passed.');
