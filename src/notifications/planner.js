/**
 * Notification planner (pure, no DOM / State / storage): turns the next days of the routine,
 * tests and deadlines plus the user's preferences into a list of local notifications.
 * notifications.js collects the input and schedules the output; tests/test_notification_planner.js
 * covers the rules.
 *
 * Kinds:  class (X min before) · start (as it starts) · briefing (morning summary) ·
 *         preview (evening before) · test (heads-up the evening before, when preview is off) ·
 *         deadline_day (evening before a due date, when preview is off) · deadline (N hours before)
 */

export const PREFS_VERSION = 2;

export const DEFAULT_PREFS = {
  version: PREFS_VERSION,
  enabled: true,                        // master switch; nothing is scheduled without OS permission anyway
  classes: { on: true, lead: 10, labLead: 0, atStart: false, scope: 'all' }, // labLead 0 = same as lead; scope all|first
  briefing: { on: true, time: 450 },    // 7:30 AM, days with classes or news
  preview: { on: true, time: 1260 },    // 9:00 PM, evening before a day with classes or news
  tests: { on: true, lead: 30, eveningBefore: true },
  deadlines: { on: true, dayBefore: true, hoursBefore: 3 },
  days: [0, 1, 2, 3, 4, 5, 6],          // weekdays that get class reminders and the morning summary
  quiet: { on: false, from: 1380, to: 420 }, // 11 PM – 7 AM
  notices: {
    on: true,
    types: { cancellation: true, holiday: true, class_test: true, online_class: true, rescheduled: true, assignment: true, general: true }
  }
};

export const NOTICE_TYPES = ['cancellation', 'holiday', 'class_test', 'online_class', 'rescheduled', 'assignment', 'general'];

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const clampInt = (v, lo, hi, d) => (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Math.round(Number(v)))) : d);

/** Merges stored preferences over the defaults and repairs bad values. */
export function normalizePrefs(raw) {
  const d = DEFAULT_PREFS;
  const r = isObj(raw) ? raw : {};
  const sub = (k) => ({ ...d[k], ...(isObj(r[k]) ? r[k] : {}) });
  const p = {
    version: PREFS_VERSION,
    enabled: typeof r.enabled === 'boolean' ? r.enabled : d.enabled,
    classes: sub('classes'),
    briefing: sub('briefing'),
    preview: sub('preview'),
    tests: sub('tests'),
    deadlines: sub('deadlines'),
    days: Array.isArray(r.days) ? r.days.filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : d.days.slice(),
    quiet: sub('quiet'),
    notices: { on: isObj(r.notices) && typeof r.notices.on === 'boolean' ? r.notices.on : true, types: { ...d.notices.types, ...(isObj(r.notices) && isObj(r.notices.types) ? r.notices.types : {}) } }
  };
  p.classes.lead = clampInt(p.classes.lead, 1, 120, 10);
  p.classes.labLead = clampInt(p.classes.labLead, 0, 120, 0);
  p.classes.scope = p.classes.scope === 'first' ? 'first' : 'all';
  p.briefing.time = clampInt(p.briefing.time, 0, 1439, 450);
  p.preview.time = clampInt(p.preview.time, 0, 1439, 1260);
  p.tests.lead = clampInt(p.tests.lead, 1, 240, 30);
  p.deadlines.hoursBefore = clampInt(p.deadlines.hoursBefore, 0, 48, 3);
  p.quiet.from = clampInt(p.quiet.from, 0, 1439, 1380);
  p.quiet.to = clampInt(p.quiet.to, 0, 1439, 420);
  for (const k of ['classes', 'briefing', 'preview', 'tests', 'deadlines', 'quiet']) p[k].on = !!p[k].on;
  p.classes.atStart = !!p.classes.atStart;
  p.tests.eveningBefore = !!p.tests.eveningBefore;
  p.deadlines.dayBefore = !!p.deadlines.dayBefore;
  return p;
}

/* ── Time helpers ─────────────────────────────────────────────────────────── */

/** "09:45", "9:45 AM", "01:30 PM" -> minutes from midnight (or -1). */
export function parseTime(str) {
  if (typeof str === 'number') return str;
  const m = String(str || '').trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])?$/);
  if (!m) return -1;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3] ? m[3].toUpperCase() : '';
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return -1;
  return h * 60 + min;
}

/** minutes -> "9:45 AM" */
export function fmtTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Local timestamp (ms) for a YYYY-MM-DD date at a minute of the day. */
export function atLocal(dateStr, mins) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d, Math.floor(mins / 60), mins % 60, 0, 0).getTime();
}

/** YYYY-MM-DD of the day before. */
export function prevDate(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const t = new Date(y, mo - 1, d - 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** True when a minute of the day falls inside the quiet window (which may wrap past midnight). */
export function inQuiet(mins, quiet) {
  if (!quiet || !quiet.on || quiet.from === quiet.to) return false;
  return quiet.from < quiet.to ? (mins >= quiet.from && mins < quiet.to) : (mins >= quiet.from || mins < quiet.to);
}

/** Stable key for a class on a date: title + start minute. */
export function classKey(cls) {
  return `${String(cls.title || '').trim().toUpperCase()}@${parseTime(cls.start)}`;
}

/** 32-bit positive id from a string, kept above 1,000,000 (instant notices use ids below that). */
export function notifId(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 1000000 + ((h >>> 0) % 2000000000);
}

const isLab = c => /lab/i.test(String(c.type || '')) || /L$/.test(String(c.title || '').trim());
const held = c => !c.cancelled && !c.rescheduledAway;
const roomText = c => (c.online ? 'Online' : (c.room && !/^(tba|online)$/i.test(String(c.room)) ? `Room ${c.room}` : ''));

function classLine(c) {
  return [roomText(c), c.instructor || '', `${fmtTime(parseTime(c.start))}–${fmtTime(parseTime(c.end))}`].filter(Boolean).join(' · ');
}

function dayDigest(day) {
  const classes = day.classes.filter(held).sort((a, b) => parseTime(a.start) - parseTime(b.start));
  const cancelled = day.classes.filter(c => c.cancelled && !day.holiday).map(c => c.title);
  const tests = day.classes.filter(c => held(c) && c.test).map(c => c.title);
  const deadlines = (day.deadlines || []).map(d => d.title);
  return { classes, cancelled, tests, deadlines };
}

function digestText(day, when) {
  const { classes, cancelled, tests, deadlines } = dayDigest(day);
  const label = when === 'today' ? 'Today' : 'Tomorrow';
  if (day.holiday && !classes.length) {
    return { title: `${label}: no classes`, body: day.holiday.title || 'Holiday' };
  }
  const n = classes.length;
  const head = n ? `${n} class${n === 1 ? '' : 'es'} from ${fmtTime(parseTime(classes[0].start))}` : 'No classes';
  const title = `${label}: ${tests.length ? `Test in ${tests.join(', ')} · ` : ''}${head}`;
  const parts = [];
  if (n) parts.push(classes.map(c => `${c.title} ${fmtTime(parseTime(c.start)).replace(' AM', '').replace(' PM', '')}`).join(', '));
  if (cancelled.length) parts.push(`Cancelled: ${cancelled.join(', ')}`);
  if (deadlines.length) parts.push(`Due: ${deadlines.join(', ')}`);
  return { title, body: parts.join('. ') || head };
}

const hasNews = day => {
  const d = dayDigest(day);
  return d.classes.length || d.cancelled.length || d.tests.length || d.deadlines.length || day.holiday;
};

/**
 * @param {object} input
 *   days:      [{ date:'YYYY-MM-DD', dayIdx, holiday:{title}|null, deadlines:[{id,title,subject,dueMin}],
 *                 classes:[{title,start,end,room,instructor,type,cancelled,rescheduledAway,online,test:{name,topics}|null}] }]
 *              (today first, consecutive dates)
 *   prefs:     normalizePrefs() output
 *   skips:     { classes: { [date]: [classKey] }, days: [date], items: [key] }
 *   pausedUntil: ms timestamp, -1 = paused until resumed, 0 = not paused
 *   now:       ms timestamp
 * @returns {Array<{id,key,at,kind,channel,title,body,date,classKey?,deadlineId?,actionType}>} sorted by time
 */
export function planNotifications({ days = [], prefs: rawPrefs, skips = {}, pausedUntil = 0, now = Date.now(), horizonDays = 7, max = 60 } = {}) {
  const prefs = normalizePrefs(rawPrefs);
  if (!prefs.enabled) return [];
  if (pausedUntil === -1) return [];
  const out = [];
  const skipDays = new Set(skips.days || []);
  const skipItems = new Set(skips.items || []);
  const skippedClass = (date, key) => ((skips.classes || {})[date] || []).includes(key);
  const horizon = now + horizonDays * 864e5;

  const push = (n) => {
    if (n.at <= now + 15000 || n.at > horizon) return;
    if (pausedUntil && n.at < pausedUntil) return;
    if (skipItems.has(n.key)) return;
    const d = new Date(n.at);
    if (inQuiet(d.getHours() * 60 + d.getMinutes(), prefs.quiet)) return;
    out.push({ ...n, id: notifId(n.key) });
  };

  days.forEach((day) => {
    const dayOn = prefs.days.includes(day.dayIdx) && !skipDays.has(day.date);
    const classes = day.classes.filter(held).sort((a, b) => parseTime(a.start) - parseTime(b.start));

    // Class reminders (+ test reminders before a test class)
    if (dayOn && !day.holiday) {
      const list = prefs.classes.scope === 'first' ? classes.slice(0, 1) : classes;
      const testClasses = classes.filter(c => c.test);
      const remind = new Set([...list, ...(prefs.tests.on ? testClasses : [])]);
      remind.forEach(c => {
        const key = classKey(c);
        if (skippedClass(day.date, key)) return;
        const start = parseTime(c.start);
        if (start < 0) return;
        const isTest = !!c.test && prefs.tests.on;
        if (!isTest && !prefs.classes.on) return;
        const lead = isTest ? prefs.tests.lead : (isLab(c) && prefs.classes.labLead ? prefs.classes.labLead : prefs.classes.lead);
        const title = isTest
          ? `Test in ${lead} min: ${c.title}${c.test.name ? ` (${c.test.name})` : ''}`
          : c.online ? `${c.title} online in ${lead} min` : `${c.title} in ${lead} min`;
        const body = isTest && c.test.topics ? `${classLine(c)}\nTopics: ${c.test.topics}` : classLine(c);
        push({ key: `class|${day.date}|${key}`, at: atLocal(day.date, start - lead), kind: isTest ? 'test' : 'class', channel: isTest ? 'deadlines' : 'class_reminders', title, body, date: day.date, classKey: key, actionType: 'CLASS' });
        if (prefs.classes.on && prefs.classes.atStart && list.includes(c)) {
          push({ key: `start|${day.date}|${key}`, at: atLocal(day.date, start), kind: 'start', channel: 'class_reminders', title: `${c.title} is starting`, body: classLine(c), date: day.date, classKey: key, actionType: 'CLASS' });
        }
      });
    }

    // Morning summary
    if (dayOn && prefs.briefing.on && hasNews(day)) {
      const first = classes.length ? parseTime(classes[0].start) : 1440;
      if (prefs.briefing.time < first) {
        const t = digestText(day, 'today');
        push({ key: `briefing|${day.date}`, at: atLocal(day.date, prefs.briefing.time), kind: 'briefing', channel: 'daily_digest', title: t.title, body: t.body, date: day.date, actionType: 'DIGEST' });
      }
    }

    // Evening before: preview, or separate test / deadline heads-ups when the preview is off
    const eve = prevDate(day.date);
    const tests = classes.filter(c => c.test);
    if (prefs.preview.on && dayOn && hasNews(day)) {
      const t = digestText(day, 'tomorrow');
      push({ key: `preview|${day.date}`, at: atLocal(eve, prefs.preview.time), kind: 'preview', channel: 'daily_digest', title: t.title, body: t.body, date: day.date, actionType: 'DIGEST' });
    } else {
      if (prefs.tests.on && prefs.tests.eveningBefore) tests.forEach(c => {
        if (skippedClass(day.date, classKey(c))) return;
        push({ key: `testeve|${day.date}|${classKey(c)}`, at: atLocal(eve, prefs.preview.time), kind: 'test_eve', channel: 'deadlines', title: `Test tomorrow: ${c.title}${c.test.name ? ` (${c.test.name})` : ''}`, body: [fmtTime(parseTime(c.start)), roomText(c), c.test.topics ? `Topics: ${c.test.topics}` : ''].filter(Boolean).join(' · '), date: day.date, classKey: classKey(c), actionType: 'DIGEST' });
      });
      if (prefs.deadlines.on && prefs.deadlines.dayBefore) (day.deadlines || []).forEach(dl => {
        push({ key: `dueday|${dl.id}`, at: atLocal(eve, prefs.preview.time), kind: 'deadline_day', channel: 'deadlines', title: `Due tomorrow: ${dl.title}`, body: [dl.subject, `by ${fmtTime(dl.dueMin)}`].filter(Boolean).join(' · '), date: day.date, deadlineId: dl.id, actionType: 'DEADLINE' });
      });
    }

    // Deadlines: N hours before
    if (prefs.deadlines.on && prefs.deadlines.hoursBefore > 0) (day.deadlines || []).forEach(dl => {
      const h = prefs.deadlines.hoursBefore;
      push({ key: `due|${dl.id}`, at: atLocal(day.date, dl.dueMin) - h * 3600000, kind: 'deadline', channel: 'deadlines', title: `Due in ${h} hour${h === 1 ? '' : 's'}: ${dl.title}`, body: [dl.subject, `by ${fmtTime(dl.dueMin)}`].filter(Boolean).join(' · '), date: day.date, deadlineId: dl.id, actionType: 'DEADLINE' });
    });
  });

  // Deadlines marked done never fire
  const doneDeadlines = new Set(skips.deadlines || []);
  return out
    .filter(n => !n.deadlineId || !doneDeadlines.has(String(n.deadlineId)))
    .sort((a, b) => a.at - b.at)
    .slice(0, max);
}

/** Should an incoming notice of this type alert right now? (in-app alerts while the app is open) */
export function noticeAllowed(type, { prefs: rawPrefs, pausedUntil = 0, now = Date.now() } = {}) {
  const prefs = normalizePrefs(rawPrefs);
  if (!prefs.enabled || !prefs.notices.on) return { show: false };
  if (pausedUntil === -1 || (pausedUntil && now < pausedUntil)) return { show: false };
  if (prefs.notices.types[type] === false) return { show: false };
  const d = new Date(now);
  return { show: true, quiet: inQuiet(d.getHours() * 60 + d.getMinutes(), prefs.quiet) };
}
