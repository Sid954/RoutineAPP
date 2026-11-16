/**
 * Faculty data helpers (no DOM). Used by the Faculty directory page and the profile sheet.
 *
 * Classes come from the teacher master schedule (teacher-finder.js) and are run through
 * getEffectiveRoomClasses() with an empty room id. That applies holidays, cancellations,
 * online moves and reschedules (flags only, never removal) without adding room-specific
 * additions, so a cancelled class never shows as "in class now".
 */
import { CONFIG, DAY_NAMES, FULL_COURSE_NAMES } from '../core/config.js';
import { State } from '../core/state.js';
import { toMinutes } from '../core/utils.js';
import { getDateForDayIndex } from '../announcements/overrides.js';
import { getEffectiveRoomClasses } from '../rooms/room-overrides.js';
import { getTeacherClassesForDay } from './teacher-finder.js';
import { getTeacherInfo, resolveTeacherCode } from './teacher-names.js';

export const activeDays = () => (CONFIG.activeDays && CONFIG.activeDays.length ? CONFIG.activeDays : [6, 0, 1, 2, 3]);

export function isLabClass(c) {
  return String(c.type || '').toLowerCase() === 'lab' || /L$/.test(String(c.subject || '').trim().toUpperCase());
}

/** "Sem 3-B" -> { sem: '3', sec: 'B' } (either may be '') */
export function parseSemSec(semSec) {
  const m = String(semSec || '').match(/Sem\s*(\d+)(?:-([A-Za-z0-9]+))?/i);
  return m ? { sem: m[1], sec: (m[2] || '').toUpperCase() } : { sem: '', sec: '' };
}

/** "3-B" style short label, or '' */
export function semSecShort(semSec) {
  const { sem, sec } = parseSemSec(semSec);
  return sem ? (sec ? `${sem}-${sec}` : sem) : '';
}

/** 615 -> "10:15 AM" (no leading zero) */
export function fmtMins(mins) {
  if (typeof mins !== 'number' || mins < 0) return '';
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function durationLabel(startM, endM) {
  const d = endM - startM;
  if (!(d > 0)) return '';
  const h = Math.floor(d / 60), m = d % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

/**
 * A teacher's classes on one day, with announcement overrides applied for that date.
 * @param {string} teacherKey
 * @param {number} dayIdx 0=Sun
 * @param {Date}   [anchor] date used to resolve which calendar date dayIdx means (default today)
 * @param {object} [data]   master teacher data (default: the loaded one; tests pass their own)
 */
export function getTeacherDay(teacherKey, dayIdx, anchor = new Date(), data) {
  const base = getTeacherClassesForDay(teacherKey, dayIdx, data).map(c => {
    const startM = typeof c.startM === 'number' ? c.startM : toMinutes(c.start);
    const endM = typeof c.endM === 'number' ? c.endM : toMinutes(c.end);
    return { ...c, startM, endM };
  });
  if (!base.length) return [];
  const dateStr = getDateForDayIndex(dayIdx, anchor);
  let effective = base;
  try {
    effective = getEffectiveRoomClasses('', DAY_NAMES[dayIdx], dateStr, base);
  } catch (e) {
    effective = base;
  }
  return effective
    .filter(c => c.startM >= 0 && c.endM > c.startM)
    .map(c => ({ ...c, dayIdx, dateStr, isLab: isLabClass(c), courseName: FULL_COURSE_NAMES[c.subject] || '' }))
    .sort((a, b) => a.startM - b.startM);
}

/** Whole teaching week (active days only), each class tagged with its dayIdx. */
export function getTeacherWeek(teacherKey, anchor = new Date(), data) {
  const out = {};
  for (const d of activeDays()) out[d] = getTeacherDay(teacherKey, d, anchor, data);
  return out;
}

const isLive = c => !c.isCancelled && !c.isRescheduled;

/**
 * Status right now from today's (override-applied) classes.
 * kind: 'off'     - not a class day
 *       'in_class'- teaching now (current = that class; online if isMovedOnline)
 *       'next'    - free now, has another class later today (next)
 *       'done'    - had classes today, all finished
 *       'none'    - no classes today (or all cancelled)
 */
export function getTeacherStatus(todayClasses, nowMins, isClassDay = true) {
  if (!isClassDay) return { kind: 'off', current: null, next: null };
  const live = (todayClasses || []).filter(isLive);
  const current = live.find(c => nowMins >= c.startM && nowMins < c.endM) || null;
  const next = live.find(c => c.startM > nowMins) || null;
  if (current) return { kind: 'in_class', current, next };
  if (next) return { kind: 'next', current: null, next };
  if (live.length) return { kind: 'done', current: null, next: null };
  return { kind: 'none', current: null, next: null };
}

/** Canonical teacher codes that appear in the user's own routine. */
export function getMyTeacherCodes(schedule = State.schedule) {
  const set = new Set();
  Object.values(schedule || {}).forEach(list => {
    (Array.isArray(list) ? list : []).forEach(c => {
      const raw = String(c.instructor || '').trim();
      if (!raw || raw === '—' || /^tba$/i.test(raw)) return;
      raw.split(/[\/,&+]/).map(s => s.trim()).filter(Boolean).forEach(code => {
        set.add(String(resolveTeacherCode(code)).toUpperCase());
      });
    });
  });
  return set;
}

/**
 * What a teacher teaches across the week: one entry per course with its sections.
 * @returns {Array<{subject, name, isLab, sections: string[], perWeek: number}>}
 */
export function summarizeTeaching(week) {
  const map = new Map();
  Object.values(week || {}).forEach(list => (list || []).forEach(c => {
    const subject = String(c.subject || '').toUpperCase().trim();
    if (!subject) return;
    if (!map.has(subject)) map.set(subject, { subject, name: FULL_COURSE_NAMES[subject] || '', isLab: isLabClass(c), sections: new Set(), perWeek: 0 });
    const e = map.get(subject);
    e.perWeek += 1;
    const s = semSecShort(c.semSec);
    if (s) e.sections.add(s);
  }));
  const bySem = (a, b) => (parseInt(a, 10) - parseInt(b, 10)) || a.localeCompare(b);
  return Array.from(map.values())
    .map(e => ({ ...e, sections: Array.from(e.sections).sort(bySem) }))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

/** Display fields for a teacher, normalised. */
export function getTeacherDisplay(teacherKey) {
  const key = resolveTeacherCode(teacherKey);
  const info = getTeacherInfo(key) || {};
  const rawName = String(info.name || '').trim();
  const hasName = !!rawName && rawName.toUpperCase() !== String(key).toUpperCase();
  const name = hasName ? rawName : key;
  const desigRaw = String(info.designation || '').split('·')[0].trim();
  const designation = desigRaw && desigRaw !== 'Faculty Member' ? desigRaw : '';
  const emails = Array.isArray(info.emails) ? info.emails.filter(e => e && String(e).trim()) : [];
  const email = emails[0] || (typeof info.email === 'string' ? info.email.trim() : '');
  const phone = (typeof info.phone === 'string' && info.phone.trim()) ? info.phone.trim() : (info.mobile || info.cell || '');
  const rawUrl = typeof info.profileUrl === 'string' ? info.profileUrl.trim() : '';
  const isGeneric = /^https?:\/\/cse\.puc\.ac\.bd\/?$/i.test(rawUrl);
  // Only http(s) may become a link: blocks javascript:/data: URLs from stored profile data
  const profileUrl = rawUrl && !isGeneric && /^https?:\/\//i.test(rawUrl) ? rawUrl : '';
  const words = name.replace(/^(dr|md|mr|mrs|ms|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  const initials = (hasName ? words.slice(0, 2).map(w => w[0]).join('') : String(key).slice(0, 2)).toUpperCase();
  return {
    key,
    name,
    hasName,
    designation,
    isGuest: !!(info.isGuest || info.status === 'Guest' || /guest/i.test(desigRaw)),
    photo: typeof info.photo === 'string' ? info.photo.trim() : '',
    email,
    phone: String(phone || '').trim(),
    profileUrl,
    initials: initials || '?'
  };
}
