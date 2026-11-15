const assert = require('assert');

// Mock browser environment
global.window = {};

const { State } = require('../src/core/state.js');
const { isPastAnnouncement } = require('../src/announcements/overrides.js');
const { shouldRollOver, getDefaultViewDate, ROLLOVER_HOUR } = require('../src/schedule/queries.js');
const { localDateStr } = require('../src/core/utils.js');

console.log('Testing past-announcement expiry and 6pm rollover...');

// ── isPastAnnouncement ────────────────────────────────────────────────
const TODAY = '2026-11-16';
assert.strictEqual(isPastAnnouncement({ type: 'cancellation', date_override: '2026-11-15' }, TODAY), true);
assert.strictEqual(isPastAnnouncement({ type: 'cancellation', date_override: '2026-11-16' }, TODAY), false, 'today is not past');
assert.strictEqual(isPastAnnouncement({ type: 'class_test', date_override: '2026-11-20' }, TODAY), false);
assert.strictEqual(isPastAnnouncement({ type: 'general' }, TODAY), false, 'undated never expires');
assert.strictEqual(isPastAnnouncement({ type: 'general', date_override: 'garbage' }, TODAY), false, 'unparseable date never expires');
assert.strictEqual(isPastAnnouncement({ type: 'holiday', date_override: '2026-11-10T00:00:00Z' }, TODAY), true, 'ISO timestamp handled');
// Rescheduled: judged by NEW date, not the original
assert.strictEqual(isPastAnnouncement({
  type: 'rescheduled', date_override: '2026-11-10',
  announcement: JSON.stringify({ original_date: '2026-11-10', new_date: '2026-11-18' })
}, TODAY), false, 'rescheduled to a future date stays visible');
assert.strictEqual(isPastAnnouncement({
  type: 'rescheduled', date_override: '2026-11-20',
  announcement: JSON.stringify({ original_date: '2026-11-20', new_date: '2026-11-14' })
}, TODAY), true, 'rescheduled to a past date expires');
console.log('✅ Test 1: isPastAnnouncement expiry rules');

// ── shouldRollOver / getDefaultViewDate ───────────────────────────────
const base = new Date(2026, 10, 16); // Monday 16 Nov 2026 (local)
const at = (h, m = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
const dayIdx = base.getDay();

State.announcementsList = [];
State.schedule = {
  [dayIdx]: [
    { title: 'MATH', start: '09:45 AM', end: '11:00 AM', room: '403', instructor: 'ABC', type: 'Theory' },
    { title: 'PHYS', start: '02:45 PM', end: '04:00 PM', room: '404', instructor: 'XYZ', type: 'Theory' }
  ]
};

assert.strictEqual(shouldRollOver(at(17, 59)), false, 'before 6pm never rolls over');
assert.strictEqual(shouldRollOver(at(ROLLOVER_HOUR, 0)), true, 'at 6pm with classes done rolls over');
let view = getDefaultViewDate(at(19));
assert.strictEqual(view.isTomorrow, true);
assert.strictEqual(view.dayIdx, (dayIdx + 1) % 7);
assert.strictEqual(localDateStr(view.date), '2026-11-17');
view = getDefaultViewDate(at(10));
assert.strictEqual(view.isTomorrow, false);
assert.strictEqual(localDateStr(view.date), '2026-11-16');
console.log('✅ Test 2: rollover after 6pm when the day is done');

// A late class still running/upcoming keeps today on screen
State.schedule[dayIdx].push({ title: 'LAB', start: '06:00 PM', end: '07:30 PM', room: '905', instructor: 'LAB', type: 'Lab' });
assert.strictEqual(shouldRollOver(at(18, 30)), false, 'class running at 6:30pm blocks rollover');
assert.strictEqual(shouldRollOver(at(19, 31)), true, 'after the late class ends it rolls over');
console.log('✅ Test 3: late class blocks rollover until it ends');

// A cancelled late class does not block rollover
State.announcementsList = [
  { id: 9, type: 'cancellation', date_override: '2026-11-16', subject_override: 'LAB', title: 'Lab cancelled' }
];
assert.strictEqual(shouldRollOver(at(18, 30)), true, 'cancelled late class ignored');
console.log('✅ Test 4: cancelled late class does not block rollover');

console.log('All rollover / past-announcement tests passed.');
