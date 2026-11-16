const assert = require('assert');

global.window = {};
global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const stubEl = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  appendChild() {}, addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => []
});
global.document = {
  getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [],
  addEventListener() {}, createElement: stubEl, body: stubEl(), documentElement: { getAttribute: () => 'dark' }
};

const {
  toNotice, audienceOf, groupFeed, comingUp, matchesQuery, filterCounts, dayLabel, countdown,
  buildIcs, googleCalendarUrl, shareText, todayStr
} = require('../src/announcements/notice-model.js');
const { isForMe } = require('../src/announcements/announcements.js');
const { audienceTargets } = require('../src/announcements/post-form.js');

console.log('Testing Notices model, audience and post targets...');

const now = new Date();
const plus = n => { const d = new Date(now); d.setDate(d.getDate() + n); return todayStr(d); };
const ctx = { semester: '2', section: 'c' };
const iso = (minsAgo) => new Date(Date.now() - minsAgo * 60000).toISOString();

// 1. Audience labels and "for me"
assert.strictEqual(audienceOf({ semester: '2', section: 'c' }, '2', 'c').short, '2-C');
assert.ok(audienceOf({ semester: '2', section: 'c' }, '2', 'c').isExactlyMine);
assert.strictEqual(audienceOf({ semester: '2', section: '' }, '2', 'c').short, 'Sem 2 · all');
assert.ok(audienceOf({ semester: '2' }, '2', 'c').isMine && audienceOf({ semester: '2' }, '2', 'c').isWide);
assert.strictEqual(audienceOf({}, '2', 'c').label, 'Everyone (department)');
assert.ok(!audienceOf({ semester: '3', section: 'a' }, '2', 'c').isMine);
assert.ok(isForMe({ semester: '2', section: 'C' }, '2', 'c'));
assert.ok(isForMe({ semester: null, section: null }, '2', 'c'), 'department-wide reaches me');
assert.ok(isForMe({ semester: '2', section: null }, '2', 'c'), 'semester-wide reaches me');
assert.ok(!isForMe({ semester: '2', section: 'a' }, '2', 'c'));
assert.ok(!isForMe({ semester: '3', section: null }, '2', 'c'));
console.log('✅ Test 1: audience labels + isForMe');

// 2. Each type normalises with the right facts
const rows = [
  { id: 1, type: 'general', title: 'Lab format', announcement: 'Use the new template.\nThanks', name: 'CR', created_at: iso(5), semester: '2', section: 'c' },
  { id: 2, type: 'cancellation', subject_override: 'DSA', date_override: plus(0), announcement: 'Teacher on leave', name: 'CR', created_at: iso(60), semester: '2', section: 'c' },
  { id: 3, type: 'class_test', subject_override: 'MATH', date_override: plus(3), announcement: JSON.stringify({ exam_name: 'CT-2', topics: 'Ch 3-4' }), name: 'CR', created_at: iso(90) },
  { id: 4, type: 'online_class', subject_override: 'PHY', date_override: plus(1), announcement: JSON.stringify({ is_online: true, platform: 'https://meet.google.com/abc', start_time: '10:00 AM', end_time: '11:15 AM' }), name: 'T', created_at: iso(30), semester: '2', section: 'c' },
  { id: 5, type: 'online_class', subject_override: 'CHEM', date_override: plus(9), announcement: JSON.stringify({ is_online: false, room: '905', start_time: '02:00 PM' }), title: 'CHEM Extra Class', name: 'T', created_at: iso(30), semester: '2', section: 'c' },
  { id: 6, type: 'rescheduled', subject_override: 'ENG', date_override: plus(0), announcement: JSON.stringify({ original_date: plus(0), original_start_time: '09:45 AM', new_date: plus(2), new_start_time: '03:00 PM', new_room: '704', reason: 'Seminar' }), name: 'T', created_at: iso(10), semester: '2', section: 'c' },
  { id: 7, type: 'assignment', subject_override: 'DSA', date_override: plus(5), announcement: JSON.stringify({ task_title: 'Report 3', due_time: '11:59 PM', description: 'PDF only' }), name: 'T', created_at: iso(20), semester: '2', section: 'c' },
  { id: 8, type: 'holiday', title: 'Victory Day', date_override: plus(4), announcement: 'Holiday', name: 'Office', created_at: iso(200) },
  { id: 9, type: 'holiday', title: 'Victory Day', date_override: plus(5), announcement: 'Holiday', name: 'Office', created_at: iso(200) },
  { id: 10, type: 'class_test', subject_override: 'OLD', date_override: plus(-3), announcement: JSON.stringify({ exam_name: 'CT-1' }), name: 'CR', created_at: iso(5000), semester: '2', section: 'c' },
  { id: 11, type: 'general', title: 'Pinned rules', announcement: 'Be on time', is_pinned: true, name: 'CR', created_at: iso(9000), semester: '2', section: 'c' }
];
const ns = rows.map(r => toNotice(r, ctx));
const byId = id => ns.find(n => n.id === String(id));

assert.strictEqual(byId(1).summary, 'Use the new template.');
assert.strictEqual(byId(2).subject, 'DSA');
assert.ok(byId(2).details.some(d => d.label === 'Course' && d.value === 'DSA'));
assert.strictEqual(byId(4).kind, 'online');
assert.strictEqual(byId(4).link, 'https://meet.google.com/abc');
assert.strictEqual(byId(4).time, '10:00 AM');
assert.strictEqual(byId(5).kind, 'extra');
assert.strictEqual(byId(5).meta.label, 'Extra class');
assert.strictEqual(byId(5).place, 'Room 905');
assert.strictEqual(byId(6).date, plus(2), 'rescheduled sorts by its NEW date');
assert.strictEqual(byId(6).place, 'Room 704');
assert.ok(byId(6).details.some(d => d.label === 'Reason' && d.value === 'Seminar'));
assert.strictEqual(byId(7).time, '11:59 PM');
assert.ok(byId(10).past && !byId(3).past);
assert.ok(byId(11).pinned);
assert.ok(byId(3).audience.label.startsWith('Everyone'));
console.log('✅ Test 2: every type normalises (time, place, link, facts, past, pinned)');

// 3. Feed grouping by event date
const g = groupFeed(ns, now);
assert.deepStrictEqual(g.pinned.map(n => n.id), ['11']);
assert.deepStrictEqual(g.today.map(n => n.id), ['2']);
assert.deepStrictEqual(g.tomorrow.map(n => n.id), ['4']);
assert.deepStrictEqual(g.week.map(n => n.id), ['6', '3', '8', '9', '7'], 'this week sorted by date, all-day before timed');
assert.deepStrictEqual(g.later.map(n => n.id), ['5']);
assert.deepStrictEqual(g.recent.map(n => n.id), ['1']);
assert.deepStrictEqual(g.past.map(n => n.id), ['10']);
console.log('✅ Test 3: feed groups (pinned/today/tomorrow/week/later/notices/past)');

// 4. Coming up: dated, not past, no general, multi-day holidays merged
const up = comingUp(ns, now);
assert.ok(!up.some(n => n.type === 'general'));
assert.ok(!up.some(n => n.past));
assert.strictEqual(up.filter(n => n.type === 'holiday').length, 1, 'holiday range shown once');
assert.strictEqual(up[0].id, '2');
assert.ok(up.some(n => n.id === '5'), '9 days ahead is inside the 14-day window');
assert.ok(up.every((n, i) => i === 0 || up[i - 1].date <= n.date), 'sorted by date');
console.log('✅ Test 4: coming-up strip');

// 5. Labels
assert.strictEqual(dayLabel(plus(0), now), 'Today');
assert.strictEqual(dayLabel(plus(1), now), 'Tomorrow');
assert.strictEqual(countdown(plus(3), now), 'in 3 days');
assert.strictEqual(countdown(plus(0), now), 'Today');
console.log('✅ Test 5: day labels and countdowns');

// 6. Search + filter counts
assert.ok(matchesQuery(byId(3), 'math ct-2'));
assert.ok(matchesQuery(byId(4), 'meet'));
assert.ok(!matchesQuery(byId(4), 'chemistry'));
const counts = filterCounts(ns);
assert.strictEqual(counts.all, ns.length);
assert.strictEqual(counts.class_test, 2);
assert.strictEqual(counts.online_class, 2);
console.log('✅ Test 6: search + filter counts');

// 7. Calendar exports
const ics = buildIcs(byId(4));
assert.ok(ics.includes('BEGIN:VEVENT') && ics.includes(`DTSTART:${plus(1).replace(/-/g, '')}T100000`) && ics.includes('T111500'));
assert.ok(ics.includes('URL:https://meet.google.com/abc'));
const allDay = buildIcs(byId(8));
assert.ok(allDay.includes('DTSTART;VALUE=DATE:'), 'holiday is an all-day event');
assert.strictEqual(buildIcs(byId(1)), null, 'undated notice has no calendar file');
assert.ok(googleCalendarUrl(byId(3)).startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE'));
assert.ok(shareText(byId(7)).includes('Report 3') && shareText(byId(7)).includes('For: '));
console.log('✅ Test 7: .ics, Google Calendar link and share text');

// 8. Post-form audience targets
const me = { sem: '2', sec: 'c' };
assert.deepStrictEqual(audienceTargets({ aud: 'mine' }, me), [{ semester: '2', section: 'c' }]);
assert.deepStrictEqual(audienceTargets({ aud: 'sections', sem: '3', secs: new Set(['a', 'b']) }, me), [{ semester: '3', section: 'a' }, { semester: '3', section: 'b' }]);
assert.deepStrictEqual(audienceTargets({ aud: 'semester', sem: '3', secs: new Set() }, me), [{ semester: '3', section: '' }]);
assert.deepStrictEqual(audienceTargets({ aud: 'all' }, me), [{ semester: '', section: '' }]);
assert.deepStrictEqual(audienceTargets({ aud: 'sections', sem: '3', secs: new Set() }, me), [], 'no sections picked -> nothing to send');
console.log('✅ Test 8: post audience targets');

console.log('All Notices tests passed.');
