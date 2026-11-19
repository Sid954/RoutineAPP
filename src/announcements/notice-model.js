/**
 * Notices data model (no DOM). Turns raw announcement rows into one normalised shape that
 * the feed, the detail sheet, the "Coming up" strip, search and the .ics export all share.
 * Raw rows keep their API/Supabase shape; nothing here changes what is stored.
 */
import { format12h, toMinutes } from '../core/utils.js';
import { formatAnnouncementTitle } from './validation.js';
import { isPastAnnouncement, normalizeDate } from './overrides.js';

export const TYPE_META = {
  general:      { label: 'Notice',      filter: 'general',    tone: 'general' },
  cancellation: { label: 'Cancelled',   filter: 'cancellation', tone: 'cancel' },
  holiday:      { label: 'Holiday',     filter: 'holiday',    tone: 'holiday' },
  online_class: { label: 'Online class', filter: 'online_class', tone: 'online' },
  class_test:   { label: 'Class test',  filter: 'class_test', tone: 'exam' },
  rescheduled:  { label: 'Rescheduled', filter: 'rescheduled', tone: 'moved' },
  assignment:   { label: 'Assignment',  filter: 'assignment', tone: 'task' }
};

/** Filter chips, in display order. */
export const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'class_test', label: 'Exams' },
  { id: 'assignment', label: 'Assignments' },
  { id: 'cancellation', label: 'Cancelled' },
  { id: 'online_class', label: 'Classes' },
  { id: 'rescheduled', label: 'Rescheduled' },
  { id: 'holiday', label: 'Holidays' },
  { id: 'general', label: 'Notices' }
];

export const isPinned = i => i && (i.is_pinned === true || i.is_pinned === 'true' || i.is_pinned === 1);

function parseJson(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  try { const v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
}

const pad = n => String(n).padStart(2, '0');
export function todayStr(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
function dateObj(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** Whole days from today to ymd (negative = past), or null. */
export function daysFrom(ymd, now = new Date()) {
  const d = dateObj(ymd);
  if (!d) return null;
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d - t) / 86400000);
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Today" / "Tomorrow" / "Yesterday" / "Wed 18 Nov" */
export function dayLabel(ymd, now = new Date()) {
  const n = daysFrom(ymd, now);
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  const d = dateObj(ymd);
  return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

/** "Wednesday, 18 November" */
export function longDate(ymd) {
  const d = dateObj(ymd);
  if (!d) return '';
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${WD_FULL[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

/** Countdown copy for the "Coming up" strip: "Today", "Tomorrow", "in 3 days", "in 2 weeks". */
export function countdown(ymd, now = new Date()) {
  const n = daysFrom(ymd, now);
  if (n === null) return '';
  if (n < 0) return n === -1 ? 'Yesterday' : `${-n} days ago`;
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 14) return `in ${n} days`;
  return `in ${Math.round(n / 7)} weeks`;
}

/** "Just now", "5m ago", "3h ago", "Yesterday", "12 Nov" */
export function postedAgo(iso, now = new Date()) {
  const t = new Date(iso);
  if (isNaN(t)) return '';
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const days = daysFrom(todayStr(t), now);
  if (days === -1) return 'Yesterday';
  return `${t.getDate()} ${MON[t.getMonth()]}${t.getFullYear() !== now.getFullYear() ? ` ${t.getFullYear()}` : ''}`;
}

function ordinal(n) {
  const v = Number(n);
  const s = ['th', 'st', 'nd', 'rd'], m = v % 100;
  return v + (s[(m - 20) % 10] || s[m] || s[0]);
}

/**
 * Who a notice is for. Empty semester = everyone in the department; semester without
 * section = that whole semester.
 */
export function audienceOf(item, mySem, mySec) {
  const sem = String(item.semester || '').trim();
  const sec = String(item.section || '').trim();
  const isMine = (!sem || sem.toLowerCase() === String(mySem || '').toLowerCase()) &&
                 (!sec || sec.toLowerCase() === String(mySec || '').toLowerCase());
  let label, short;
  if (!sem) { label = 'Everyone (department)'; short = 'Everyone'; }
  else if (!sec) { label = `${ordinal(sem)} semester, all sections`; short = `Sem ${sem} · all`; }
  else { label = `${ordinal(sem)} semester, section ${sec.toUpperCase()}`; short = `${sem}-${sec.toUpperCase()}`; }
  const isExactlyMine = !!sem && !!sec && isMine;
  return { semester: sem, section: sec, label, short, isMine, isExactlyMine, isWide: !sem || !sec };
}

const fmtTime = t => { const s = String(t || '').trim(); return s && toMinutes(s) >= 0 ? format12h(s).replace(/^0/, '') : ''; };

/**
 * Normalise one raw row.
 * @returns {{ id, raw, type, meta, tone, title, subject, date, time, endTime, place, link,
 *   kind, summary, body, details: Array<{label,value,mono?}>, author, createdAt, isEdited,
 *   pinned, past, audience }}
 */
export function toNotice(item, ctx = {}) {
  const type = TYPE_META[item.type] ? item.type : 'general';
  const p = parseJson(item.announcement) || {};
  const subject = String(item.subject_override || item.subject || p.target_subject || '').trim();
  const n = {
    id: String(item.id),
    raw: item,
    type,
    meta: TYPE_META[type],
    tone: TYPE_META[type].tone,
    title: formatAnnouncementTitle(item),
    subject,
    date: normalizeDate(item.date_override) || '',
    time: '', endTime: '', place: '', link: '', kind: type,
    summary: '', body: '', details: [],
    author: String(item.name || '').trim(),
    createdAt: item.created_at || '',
    isEdited: !!(item.updated_at && item.created_at && Math.abs(new Date(item.updated_at) - new Date(item.created_at)) > 60000),
    pinned: isPinned(item),
    past: isPastAnnouncement(item, ctx.today),
    audience: audienceOf(item, ctx.semester, ctx.section)
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.date)) n.date = '';

  const add = (label, value, mono) => { if (value) n.details.push({ label, value: String(value), mono: !!mono }); };

  switch (type) {
    case 'general': {
      n.body = String(item.announcement || '').trim();
      n.summary = n.body.split('\n')[0];
      add('Course', subject, true);
      break;
    }
    case 'cancellation': {
      n.body = String(item.announcement || '').trim();
      n.summary = subject ? `${subject} will not be held` : 'A class will not be held';
      add('Course', subject, true);
      break;
    }
    case 'holiday': {
      n.body = String(item.announcement || '').trim();
      n.summary = 'No classes';
      break;
    }
    case 'online_class': {
      const online = !(p.is_online === false || /extra class/i.test(item.title || ''));
      n.kind = online ? 'online' : 'extra';
      n.meta = online ? TYPE_META.online_class : { ...TYPE_META.online_class, label: 'Extra class' };
      n.tone = online ? 'online' : 'extra';
      n.time = fmtTime(p.start_time);
      n.endTime = fmtTime(p.end_time);
      const platform = String(p.platform || '').trim();
      if (online && /^https?:\/\//i.test(platform)) n.link = platform;
      n.place = online ? (n.link ? 'Online' : (platform || 'Online')) : (p.room ? `Room ${String(p.room).trim()}` : '');
      n.summary = [subject, n.time, n.place].filter(Boolean).join(' · ');
      add('Course', subject, true);
      add('Starts', n.time, true);
      add(online ? 'Where' : 'Room', online ? (n.link ? 'Online (link below)' : (platform || 'Check the class group for the link')) : String(p.room || '').trim(), !online);
      add('Teacher', String(p.teacher || '').trim(), true);
      break;
    }
    case 'class_test': {
      const exam = String(p.exam_name || '').trim();
      const topics = String(p.topics || '').trim();
      n.summary = [subject, exam && !/^class test$/i.test(exam) ? exam : ''].filter(Boolean).join(' · ') || 'Class test';
      n.body = topics && topics !== 'Not Specified' ? topics : '';
      add('Course', subject, true);
      add('Exam', exam);
      add('Syllabus', n.body || 'Not specified');
      break;
    }
    case 'rescheduled': {
      const newDate = normalizeDate(p.new_date || item.date_override) || '';
      const fromDate = normalizeDate(p.original_date || item.date_override) || '';
      n.date = /^\d{4}-\d{2}-\d{2}$/.test(newDate) ? newDate : n.date;
      n.time = fmtTime(p.new_start_time);
      n.place = p.new_room ? `Room ${String(p.new_room).trim()}` : '';
      const fromTxt = [fromDate ? dayLabel(fromDate, ctx.now) : '', fmtTime(p.original_start_time)].filter(Boolean).join(' ');
      n.summary = [subject ? `${subject} moved` : 'Class moved', n.time ? `to ${n.time}` : ''].filter(Boolean).join(' ');
      n.body = String(p.reason || '').trim();
      add('Course', subject, true);
      add('From', fromTxt);
      add('To', [n.date ? dayLabel(n.date, ctx.now) : '', n.time].filter(Boolean).join(' '));
      add('Room', String(p.new_room || p.original_room || '').trim(), true);
      add('Reason', n.body);
      break;
    }
    case 'assignment': {
      const task = String(p.task_title || '').trim();
      n.time = fmtTime(p.due_time);
      n.body = String(p.description || '').trim();
      n.summary = [task || 'Assignment', subject, n.time ? `due ${n.time}` : ''].filter(Boolean).join(' · ');
      add('Course', subject, true);
      add('Task', task);
      add('Due', [n.date ? dayLabel(n.date, ctx.now) : '', n.time].filter(Boolean).join(' '));
      add('Notes', n.body);
      // Optional page to hand it in; opens like a class's join link
      const link = String(p.link || '').trim();
      if (/^https?:\/\//i.test(link)) n.link = link;
      break;
    }
  }
  if (!n.summary) n.summary = n.meta.label;
  Object.assign(n, cardLines(n, p, ctx));
  return n;
}

const DEFAULT_CANCEL = /^(The|Reminding you that the) .* (class|scheduled).*(cancelled|canceled)?\.?$/i;
const clip = (s, max = 90) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > max ? `${t.slice(0, max - 1)}…` : t; };

/** The class a notice is about, looked up in the routine for that weekday: { time, room } or null. */
function classOnDay(subject, ymd, schedule) {
  const d = dateObj(ymd);
  if (!d || !subject || !schedule) return null;
  const list = schedule[d.getDay()];
  if (!Array.isArray(list)) return null;
  const hit = list.find(c => String(c.title || c.subject || '').toUpperCase().trim() === String(subject).toUpperCase().trim());
  if (!hit) return null;
  return { time: fmtTime(hit.start), end: fmtTime(hit.end), room: String(hit.room || '').trim() };
}

/** "3:00 PM" -> { big: '3:00', ampm: 'PM' } */
function splitTime(t) {
  const m = String(t || '').match(/^(\d{1,2}:\d{2})\s*([AP]M)$/i);
  return m ? { big: m[1], ampm: m[2].toUpperCase() } : { big: String(t || ''), ampm: '' };
}

/**
 * What a feed row says, one fact per line, nothing twice:
 *  headline  names the course and what kind of thing it is ("ICMP class cancelled")
 *  lines     short extra facts, each on its own line (room, reason, what it covers...)
 *  focus     THE time people look for, shown in its own column:
 *            { big: '3:00', ampm: 'PM', small: 'Sat 21' }  (or a day when no time applies)
 * The time of a cancelled class or a test is the class's own slot, read from the routine.
 */
export function cardLines(n, p = {}, ctx = {}) {
  const subj = n.subject;
  let headline = n.title;
  const lines = [];
  let time = '', timeNote = '';
  const cls = classOnDay(subj, n.date, ctx.schedule);
  switch (n.type) {
    case 'cancellation': {
      headline = subj ? `${subj} class cancelled` : 'Class cancelled';
      const note = String(n.body || '').trim();
      if (note && !DEFAULT_CANCEL.test(note) && !/will not be held/i.test(note)) lines.push(note);
      if (cls && cls.room) lines.push(`Room ${cls.room}`);
      if (cls) time = cls.time;
      break;
    }
    case 'class_test': {
      const exam = String(p.exam_name || '').trim();
      const named = exam && !/^class test$/i.test(exam);
      headline = subj ? `${subj} class test${named ? ` (${exam})` : ''}` : (named ? `Class test (${exam})` : 'Class test');
      if (n.body) lines.push(`Covers ${n.body}`);
      if (cls && cls.room) lines.push(`Room ${cls.room}`);
      if (cls) time = cls.time;
      break;
    }
    case 'assignment': {
      const task = String(p.task_title || '').trim();
      const generic = !task || /^assignment$/i.test(task);
      headline = subj ? `${subj} assignment${generic ? '' : `: ${task}`}` : (generic ? 'Assignment' : `Assignment: ${task}`);
      if (n.body) lines.push(n.body);
      time = n.time; timeNote = 'due';
      break;
    }
    case 'online_class': {
      headline = `${subj || 'Class'} ${n.kind === 'extra' ? 'extra class' : 'online class'}`;
      if (n.endTime) lines.push(`Until ${n.endTime}`);
      if (n.kind === 'extra' && n.place) lines.push(n.place);
      else if (!n.link && n.place && n.place !== 'Online') lines.push(n.place);
      time = n.time;
      break;
    }
    case 'rescheduled': {
      headline = subj ? `${subj} class rescheduled` : 'Class rescheduled';
      if (n.place) lines.push(n.place);
      if (n.body) lines.push(`Reason: ${n.body}`);
      const was = (n.details.find(d => d.label === 'From') || {}).value;
      if (was) lines.push(`Was ${was}`);
      time = n.time;
      break;
    }
    case 'holiday': {
      const name = String(n.title || '').replace(/^Holiday:\s*/i, '').replace(/\s*Holiday$/i, '').trim();
      const named = name && !/^holiday$/i.test(name);
      headline = named ? `Holiday: ${name}` : 'Holiday';
      lines.push('No classes');
      break;
    }
    default: {
      headline = n.title || 'Notice';
      const first = String(n.body || '').split(/\r?\n/)[0].trim();
      if (first && first !== headline) lines.push(first);
    }
  }
  const out = lines.map(l => clip(l, 90)).slice(0, 3);
  return {
    headline: clip(headline, 70),
    lines: out,
    detail: out.join('. '),
    focus: { ...splitTime(time), note: timeNote, hasTime: !!time }
  };
}

/** Sort key for the time of day ("2:00 PM" -> 840), 0 when unknown. */
const timeKey = n => { const m = toMinutes(n.time || ''); return m >= 0 ? m : 0; };

/** Search across title, summary, body, course, author and audience. */
export function matchesQuery(n, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  const hay = [n.title, n.summary, n.body, n.subject, n.author, n.audience.short, n.meta.label, n.place, n.link,
    ...n.details.map(d => d.value)].join(' ').toLowerCase();
  return s.split(/\s+/).every(w => hay.includes(w));
}

/** Counts per filter id (from the given notices). */
export function filterCounts(notices) {
  const c = { all: notices.length };
  FILTERS.forEach(f => { if (f.id !== 'all') c[f.id] = notices.filter(n => n.type === f.id).length; });
  return c;
}

/**
 * A holiday is stored one row per day. Show consecutive days of the same holiday as ONE row
 * ("Sat 28 – Sun 29") instead of repeating it. Returns a new list; other notices are untouched.
 */
export function bundleHolidays(notices) {
  const out = [];
  const open = new Map(); // key -> the bundle still accepting a next day
  const sorted = notices.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const keep = new Set();
  sorted.forEach(n => {
    if (n.type !== 'holiday' || !n.date || n.pinned) { keep.add(n); return; }
    const key = `${n.title}|${n.audience.short}`;
    const cur = open.get(key);
    const gap = cur ? daysFrom(n.date, dateObj(cur.dateEnd || cur.date)) : null;
    if (cur && gap === 1) {
      cur.dateEnd = n.date;
      cur.days = (cur.days || 1) + 1;
      cur.lines = [`No classes for ${cur.days} days`];
      cur.detail = cur.lines[0];
      cur.unreadIds = (cur.unreadIds || [cur.id]).concat(n.id);
      return;
    }
    const b = Object.assign({}, n, { days: 1, dateEnd: '' });
    open.set(key, b);
    keep.add(b);
  });
  notices.forEach(n => { if (keep.has(n)) out.push(n); });
  keep.forEach(n => { if (!out.includes(n)) out.push(n); });
  return out;
}

/**
 * Feed sections:
 *  pinned  - pinned (any date, past included)
 *  today / tomorrow / week / later - dated, not past, by event date then time
 *  recent  - undated notices, newest first
 *  past    - dated before today, most recent first (shown behind a toggle)
 */
export function groupFeed(notices, now = new Date()) {
  const out = { pinned: [], today: [], tomorrow: [], week: [], later: [], recent: [], past: [] };
  notices.forEach(n => {
    if (n.pinned) { out.pinned.push(n); return; }
    if (n.past) { out.past.push(n); return; }
    if (!n.date) { out.recent.push(n); return; }
    const d = daysFrom(n.date, now);
    if (d <= 0) out.today.push(n);
    else if (d === 1) out.tomorrow.push(n);
    else if (d <= 7) out.week.push(n);
    else out.later.push(n);
  });
  const byEvent = (a, b) => (a.date.localeCompare(b.date)) || (timeKey(a) - timeKey(b));
  const byPosted = (a, b) => String(b.createdAt).localeCompare(String(a.createdAt));
  ['today', 'tomorrow', 'week', 'later'].forEach(k => out[k].sort(byEvent));
  out.recent.sort(byPosted);
  out.pinned.sort(byPosted);
  out.past.sort((a, b) => b.date.localeCompare(a.date) || byPosted(a, b));
  return out;
}

/** Dated, upcoming items in the next `days` days for the "Coming up" strip (holidays merged by name). */
export function comingUp(notices, now = new Date(), days = 14, max = 10) {
  const list = notices
    .filter(n => n.date && !n.past && daysFrom(n.date, now) >= 0 && daysFrom(n.date, now) <= days && n.type !== 'general')
    .sort((a, b) => a.date.localeCompare(b.date) || (timeKey(a) - timeKey(b)));
  // Multi-day holidays are stored one row per day: keep the first day only
  const seen = new Set();
  return list.filter(n => {
    if (n.type !== 'holiday') return true;
    const k = `${n.title}|${n.audience.short}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, max);
}

/* ── Sharing / calendar ─────────────────────────────────────────────────── */
export function shareText(n) {
  const when = [n.date ? longDate(n.date) : '', n.time].filter(Boolean).join(', ');
  const lines = [`${n.meta.label}: ${n.title}`];
  if (when) lines.push(when);
  n.details.forEach(d => {
    if (d.label === 'Course' && n.title.includes(d.value)) return;
    if (d.label === 'Due' || d.label === 'To') return; // already in the "when" line
    lines.push(`${d.label}: ${d.value}`);
  });
  if (n.type === 'general' && n.body) lines.push(n.body);
  if (n.link) lines.push(n.link);
  lines.push(`For: ${n.audience.label}`);
  return lines.join('\n');
}

const icsEsc = s => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** A one-event iCalendar file (floating local time). Null when the notice has no date. */
export function buildIcs(n, nowIso = new Date().toISOString()) {
  if (!n.date) return null;
  const ymd = n.date.replace(/-/g, '');
  const startM = toMinutes(n.time || '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Routine//Notices//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:notice-${n.id}@routine`, `DTSTAMP:${nowIso.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}`];
  if (startM >= 0) {
    let endM = toMinutes(n.endTime || '');
    if (!(endM > startM)) endM = Math.min(1439, startM + (n.type === 'assignment' ? 0 : 75));
    const t = m => `${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
    lines.push(`DTSTART:${ymd}T${t(startM)}`, `DTEND:${ymd}T${t(Math.max(endM, startM))}`);
  } else {
    const d = dateObj(n.date); d.setDate(d.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${ymd}`, `DTEND;VALUE=DATE:${todayStr(d).replace(/-/g, '')}`);
  }
  lines.push(`SUMMARY:${icsEsc(`${n.meta.label}: ${n.title}`)}`);
  const desc = n.details.map(d => `${d.label}: ${d.value}`).concat(n.type === 'general' && n.body ? [n.body] : []).concat(n.link ? [n.link] : []).join('\n');
  if (desc) lines.push(`DESCRIPTION:${icsEsc(desc)}`);
  if (n.place) lines.push(`LOCATION:${icsEsc(n.place)}`);
  if (n.link) lines.push(`URL:${n.link}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

/** Google Calendar "add event" link (works on Android without file downloads). */
export function googleCalendarUrl(n) {
  if (!n.date) return '';
  const ymd = n.date.replace(/-/g, '');
  const startM = toMinutes(n.time || '');
  let dates;
  if (startM >= 0) {
    let endM = toMinutes(n.endTime || '');
    if (!(endM > startM)) endM = Math.min(1439, startM + (n.type === 'assignment' ? 30 : 75));
    const t = m => `${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
    dates = `${ymd}T${t(startM)}/${ymd}T${t(endM)}`;
  } else {
    const d = dateObj(n.date); d.setDate(d.getDate() + 1);
    dates = `${ymd}/${todayStr(d).replace(/-/g, '')}`;
  }
  const details = n.details.map(d => `${d.label}: ${d.value}`).concat(n.type === 'general' && n.body ? [n.body] : []).concat(n.link ? [n.link] : []).join('\n');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${n.meta.label}: ${n.title}`, dates, details });
  if (n.place) q.set('location', n.place);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** Local notification copy for a newly seen notice. */
export function notifCopy(n) {
  const titles = { cancellation: 'Class cancelled', holiday: 'Holiday', online_class: n.kind === 'extra' ? 'Extra class' : 'Online class',
    class_test: 'Class test', rescheduled: 'Class rescheduled', assignment: 'Assignment due', general: 'New notice' };
  const when = [n.date ? dayLabel(n.date) : '', n.time].filter(Boolean).join(' ');
  return { title: `${titles[n.type] || 'New notice'}: ${n.title}`, body: [when, n.summary].filter(Boolean).join(' · ') };
}
