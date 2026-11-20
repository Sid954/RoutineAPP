/**
 * Exam countdown (tested). The student's own exams (exams_v1: [{ id, subject, kind, date, time }])
 * merged with class-test notices. kind: midterm | final | quiz | other | test (from a notice).
 */
const KEY = 'exams_v1';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(-200))); } catch (e) {} };
export const EXAM_KINDS = { midterm: 'Midterm', final: 'Final', quiz: 'Quiz', other: 'Exam', test: 'Class test' };

export function listOwnExams() { return read(); }
export function addExam({ subject, kind = 'midterm', date, time = '' }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !String(subject || '').trim()) return null;
  const e = { id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, subject: String(subject).trim().toUpperCase(), kind: EXAM_KINDS[kind] ? kind : 'other', date, time: String(time || '').slice(0, 10) };
  write(read().concat(e));
  return e;
}
export function removeExam(id) { write(read().filter(e => e.id !== id)); }

/**
 * Upcoming exams from today on, soonest first.
 * @param testNotices [{ id, subject, date, name, time }] class tests from notices
 */
export function upcomingExams(own, testNotices, today) {
  const a = (own || []).filter(e => e.date >= today).map(e => ({ ...e, source: 'own', label: EXAM_KINDS[e.kind] || 'Exam' }));
  const b = (testNotices || []).filter(t => t.date >= today).map(t => ({ id: `n${t.id}`, noticeId: t.id, subject: String(t.subject || '').toUpperCase(), kind: 'test', date: t.date, time: t.time || '', label: t.name || 'Class test', source: 'notice' }));
  return a.concat(b).sort((x, y) => x.date.localeCompare(y.date) || String(x.time).localeCompare(String(y.time)));
}
/** Whole days from today to a date (0 = today). */
export function daysUntil(date, today) {
  const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((p(date) - p(today)) / 864e5);
}
