const assert = require('assert');
const {
  planNotifications, normalizePrefs, DEFAULT_PREFS, parseTime, fmtTime, inQuiet, classKey,
  notifId, atLocal, prevDate, noticeAllowed
} = require('../src/notifications/planner.js');

console.log('Testing notification planner...');

const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Fixed "now": a Tuesday 06:00 local
const base = new Date(2026, 10, 17, 6, 0, 0, 0); // 17 Nov 2026 (Tuesday)
const now = base.getTime();
const D0 = ymd(base);
const D1 = ymd(new Date(2026, 10, 18));
const D2 = ymd(new Date(2026, 10, 19));

const cls = (title, start, end, extra = {}) => ({ title, start, end, room: '404', instructor: 'MHE', type: 'Theory', ...extra });
const day = (date, dayIdx, classes, extra = {}) => ({ date, dayIdx, holiday: null, deadlines: [], classes, ...extra });

const days = [
  day(D0, 2, [cls('DMNT', '09:45 AM', '11:00 AM'), cls('PHYL', '11:00 AM', '01:30 PM', { type: 'Lab' }), cls('CPL', '01:30 PM', '02:45 PM', { cancelled: true })]),
  day(D1, 3, [cls('DS', '08:30 AM', '09:45 AM', { test: { name: 'CT-2', topics: 'Stack, Queue' } }), cls('EDC', '10:00 AM', '11:15 AM')],
    { deadlines: [{ id: 'a1', title: 'Lab report 5', subject: 'CPL', dueMin: parseTime('11:59 PM') }] }),
  day(D2, 4, [], { holiday: { title: 'Campus closed' } })
];
const prefs = normalizePrefs({});
const kinds = list => list.map(n => `${n.kind}:${n.date}:${n.classKey || n.deadlineId || ''}`);

// 1. Time helpers
assert.strictEqual(parseTime('09:45 AM'), 585);
assert.strictEqual(parseTime('9:45'), 585);
assert.strictEqual(parseTime('12:05 AM'), 5);
assert.strictEqual(parseTime('12:30 PM'), 750);
assert.strictEqual(parseTime('bad'), -1);
assert.strictEqual(fmtTime(810), '1:30 PM');
assert.strictEqual(prevDate('2026-12-01'), '2026-11-30');
assert.ok(inQuiet(1400, { on: true, from: 1380, to: 420 }) && inQuiet(100, { on: true, from: 1380, to: 420 }) && !inQuiet(600, { on: true, from: 1380, to: 420 }));
assert.ok(!inQuiet(1400, { on: false, from: 1380, to: 420 }));
const id = notifId('class|x');
assert.ok(id >= 1000000 && id < 2 ** 31 && id === notifId('class|x') && id !== notifId('class|y'));
console.log('✅ Test 1: time helpers, quiet window, stable ids');

// 2. Defaults: class reminders, morning summary, evening preview, test + deadline
const plan = planNotifications({ days, prefs, now });
const k = kinds(plan);
assert.ok(k.includes(`class:${D0}:DMNT@585`), 'DMNT reminder');
assert.ok(k.includes(`class:${D0}:PHYL@660`), 'PHYL reminder');
assert.ok(!k.some(x => x.includes('CPL@')), 'cancelled class gets no reminder');
const dm = plan.find(n => n.classKey === 'DMNT@585');
assert.strictEqual(dm.at, atLocal(D0, 585 - 10));
assert.strictEqual(dm.title, 'DMNT in 10 min');
assert.ok(/Room 404 · MHE · 9:45 AM–11:00 AM/.test(dm.body));
assert.ok(k.includes(`briefing:${D0}:`), 'morning summary today');
const brief = plan.find(n => n.kind === 'briefing' && n.date === D0);
assert.strictEqual(brief.title, 'Today: 2 classes from 9:45 AM');
assert.ok(/Cancelled: CPL/.test(brief.body));
const test = plan.find(n => n.kind === 'test');
assert.strictEqual(test.at, atLocal(D1, 510 - 30), 'test reminder uses the test lead (30)');
assert.ok(/Test in 30 min: DS \(CT-2\)/.test(test.title) && /Topics: Stack, Queue/.test(test.body));
const prev = plan.find(n => n.kind === 'preview' && n.date === D1);
assert.ok(prev && prev.at === atLocal(D0, 1260) && /^Tomorrow: Test in DS · 2 classes from 8:30 AM/.test(prev.title) && /Due: Lab report 5/.test(prev.body));
const due = plan.find(n => n.kind === 'deadline');
assert.strictEqual(due.at, atLocal(D1, parseTime('11:59 PM')) - 3 * 3600000);
assert.strictEqual(due.title, 'Due in 3 hours: Lab report 5');
const hol = plan.find(n => n.kind === 'preview' && n.date === D2);
assert.ok(hol && hol.title === 'Tomorrow: no classes' && hol.body === 'Campus closed');
assert.ok(!plan.some(n => n.kind === 'class' && n.date === D2), 'no reminders on a holiday');
for (let i = 1; i < plan.length; i++) assert.ok(plan[i].at >= plan[i - 1].at, 'sorted by time');
console.log('✅ Test 2: defaults plan reminders, summary, preview, test and deadline');

// 3. Skips: one class, a whole day, a single item, a finished deadline
const skipped = planNotifications({ days, prefs, now, skips: { classes: { [D0]: ['DMNT@585'] }, days: [D1], items: [`briefing|${D0}`], deadlines: ['a1'] } });
const ks = kinds(skipped);
assert.ok(!ks.includes(`class:${D0}:DMNT@585`) && ks.includes(`class:${D0}:PHYL@660`), 'only DMNT skipped');
assert.ok(!skipped.some(n => n.date === D1 && (n.kind === 'class' || n.kind === 'test' || n.kind === 'preview')), 'day D1 off');
assert.ok(!skipped.some(n => n.kind === 'briefing' && n.date === D0), 'single item skipped');
assert.ok(!skipped.some(n => n.deadlineId === 'a1'), 'done deadline silent');
console.log('✅ Test 3: skip a class, a day, one alert, a done deadline');

// 4. Pause, master switch, quiet hours, weekdays
assert.strictEqual(planNotifications({ days, prefs, now, pausedUntil: -1 }).length, 0, 'paused until resumed');
const paused = planNotifications({ days, prefs, now, pausedUntil: atLocal(D0, 720) });
assert.ok(paused.every(n => n.at >= atLocal(D0, 720)), 'nothing before pause ends');
assert.strictEqual(planNotifications({ days, prefs: { ...prefs, enabled: false }, now }).length, 0, 'master off');
const quiet = planNotifications({ days, prefs: { ...prefs, quiet: { on: true, from: 1200, to: 480 } }, now });
assert.ok(!quiet.some(n => n.kind === 'preview' || n.kind === 'briefing'), 'quiet hours drop 9 PM preview and 7:30 summary');
const noTue = planNotifications({ days, prefs: { ...prefs, days: [0, 1, 3, 4, 5, 6] }, now });
assert.ok(!noTue.some(n => n.date === D0 && (n.kind === 'class' || n.kind === 'briefing')), 'Tuesday turned off');
console.log('✅ Test 4: pause, master switch, quiet hours, weekdays');

// 5. Options: first class only, lab lead, at start, preview off -> separate heads-ups
const opt = planNotifications({ days, now, prefs: { ...prefs, classes: { on: true, lead: 15, labLead: 30, atStart: true, scope: 'all' }, preview: { on: false, time: 1260 } } });
assert.strictEqual(opt.find(n => n.classKey === 'PHYL@660' && n.kind === 'class').at, atLocal(D0, 660 - 30), 'lab lead');
assert.strictEqual(opt.find(n => n.classKey === 'DMNT@585' && n.kind === 'class').at, atLocal(D0, 585 - 15));
assert.ok(opt.some(n => n.kind === 'start' && n.classKey === 'DMNT@585' && n.at === atLocal(D0, 585)), 'start alert');
assert.ok(opt.some(n => n.kind === 'test_eve' && n.title === 'Test tomorrow: DS (CT-2)'), 'test heads-up when preview off');
assert.ok(opt.some(n => n.kind === 'deadline_day' && n.title === 'Due tomorrow: Lab report 5'), 'deadline heads-up when preview off');
const first = planNotifications({ days, now, prefs: { ...prefs, classes: { ...prefs.classes, scope: 'first' } } });
assert.ok(first.some(n => n.classKey === 'DMNT@585') && !first.some(n => n.classKey === 'PHYL@660' && n.kind === 'class'), 'first class only');
assert.ok(first.some(n => n.kind === 'test' && n.classKey === 'DS@510'), 'test reminder kept even with first-only scope');
const noTests = planNotifications({ days, now, prefs: { ...prefs, tests: { ...prefs.tests, on: false } } });
assert.strictEqual(noTests.find(n => n.classKey === 'DS@510').kind, 'class', 'tests off: plain class reminder');
console.log('✅ Test 5: first class only, lab lead, start alert, heads-ups');

// 6. Past alerts, horizon, cap
const late = planNotifications({ days, prefs, now: atLocal(D0, 600) });
assert.ok(!late.some(n => n.classKey === 'DMNT@585'), 'already passed');
assert.strictEqual(planNotifications({ days, prefs, now, max: 3 }).length, 3, 'capped');
assert.strictEqual(planNotifications({ days, prefs, now, horizonDays: 0.5 }).every(n => n.at <= now + 0.5 * 864e5), true);
console.log('✅ Test 6: past, horizon, cap');

// 7. Prefs normalisation + notice filter
const bad = normalizePrefs({ classes: { lead: 999, scope: 'x' }, days: [1, 9, 'x'], quiet: { from: -5 } });
assert.strictEqual(bad.classes.lead, 120);
assert.strictEqual(bad.classes.scope, 'all');
assert.deepStrictEqual(bad.days, [1]);
assert.strictEqual(bad.quiet.from, 0);
assert.strictEqual(normalizePrefs(null).briefing.time, DEFAULT_PREFS.briefing.time);
assert.strictEqual(noticeAllowed('cancellation', { prefs, now }).show, true);
assert.strictEqual(noticeAllowed('general', { prefs: { ...prefs, notices: { on: true, types: { general: false } } }, now }).show, false);
assert.strictEqual(noticeAllowed('general', { prefs: { ...prefs, notices: { on: false } }, now }).show, false);
assert.strictEqual(noticeAllowed('general', { prefs, now, pausedUntil: now + 60000 }).show, false);
assert.strictEqual(noticeAllowed('general', { prefs: { ...prefs, quiet: { on: true, from: 300, to: 420 } }, now }).quiet, true);
assert.strictEqual(classKey({ title: 'dsl', start: '9:45 AM' }), 'DSL@585');
console.log('✅ Test 7: prefs repair and notice filter');

console.log('All notification planner tests passed.');
