const assert = require('assert');

// Mock browser environment (widget.js pulls in toast.js, which touches the DOM at load)
global.window = {};
const stubEl = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {}, addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => []
});
global.document = {
  getElementById: () => stubEl(),
  querySelector: () => stubEl(),
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: stubEl,
  body: { appendChild() {} },
  documentElement: { getAttribute: () => 'dark' }
};

const { State } = require('../src/core/state.js');
const { buildWidgetScheduleJson } = require('../src/widget/widget.js');
const { localDateStr } = require('../src/core/utils.js');

console.log('Testing native widget schedule payload (override-aware)...');

const today = new Date();
const todayIdx = today.getDay();
const todayStr = localDateStr(today);

State.schedule = {
  [todayIdx]: [
    { title: 'MATH', start: '09:45', end: '11:00', room: '403', instructor: 'ABC', type: 'Theory' },
    { title: 'PHYSICS', start: '11:15', end: '12:30', room: '404', instructor: 'XYZ', type: 'Theory' },
    { title: 'CHEM', start: '01:30 PM', end: '02:45 PM', room: '503', instructor: 'DEF', type: 'Theory' }
  ]
};

// 1. No overrides: widget gets today's base classes in the Java-engine shape
State.announcementsList = [];
let payload = JSON.parse(buildWidgetScheduleJson());
assert.strictEqual(payload[String(todayIdx)].length, 3);
assert.deepStrictEqual(Object.keys(payload[String(todayIdx)][0]).sort(), ['end', 'instructor', 'room', 'start', 'title', 'type']);
assert.strictEqual(Object.keys(payload).length, 7, 'one entry per weekday for the next 7 dates');
console.log('✅ Test 1: base schedule passed through in widget shape');

// 2. Cancellation today: cancelled class must NOT reach the widget engine
State.announcementsList = [
  { id: 1, type: 'cancellation', date_override: todayStr, subject_override: 'MATH', title: 'Math Cancelled' }
];
payload = JSON.parse(buildWidgetScheduleJson());
const titles = payload[String(todayIdx)].map(c => c.title);
assert.ok(!titles.includes('MATH'), 'cancelled MATH must be dropped');
assert.deepStrictEqual(titles, ['PHYSICS', 'CHEM']);
console.log('✅ Test 2: cancelled class excluded from widget payload');

// 3. Online class today: stays, with room ONLINE
State.announcementsList = [
  { id: 2, type: 'online_class', date_override: todayStr, subject_override: 'PHYSICS', title: 'Physics Online',
    announcement: JSON.stringify({ is_online: true, platform: 'https://meet.example.com/x' }) }
];
payload = JSON.parse(buildWidgetScheduleJson());
const physics = payload[String(todayIdx)].find(c => c.title === 'PHYSICS');
assert.ok(physics, 'online class kept');
assert.strictEqual(physics.room, 'ONLINE');
console.log('✅ Test 3: moved-online class shown with ONLINE room');

// 4. Holiday today: all classes dropped
State.announcementsList = [
  { id: 3, type: 'holiday', date_override: todayStr, title: 'Holiday' }
];
payload = JSON.parse(buildWidgetScheduleJson());
assert.strictEqual(payload[String(todayIdx)].length, 0, 'holiday clears the day');
console.log('✅ Test 4: holiday clears the widget day');

console.log('All widget schedule tests passed.');
