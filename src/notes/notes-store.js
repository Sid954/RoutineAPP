/** Notes and to-dos (phone only, DOM-free, tested). notes_v1: [{ id, text, subject, date, done, createdAt }] */
const KEY = 'notes_v1';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v.slice(-300))); } catch (e) {} };
const newId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function listNotes({ openOnly = false } = {}) {
  const all = read();
  return (openOnly ? all.filter(n => !n.done) : all).sort((a, b) => (a.done - b.done) || String(a.date || '9').localeCompare(String(b.date || '9')) || b.createdAt - a.createdAt);
}
export function addNote({ text, subject = '', date = '' }) {
  const t = String(text || '').trim();
  if (!t) return null;
  const note = { id: newId(), text: t.slice(0, 500), subject: String(subject || '').trim().toUpperCase(), date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', done: false, createdAt: Date.now() };
  write(read().concat(note));
  return note;
}
export function updateNote(id, patch) {
  const all = read();
  const n = all.find(x => x.id === id);
  if (!n) return null;
  Object.assign(n, patch);
  write(all);
  return n;
}
export function toggleNote(id) { const n = read().find(x => x.id === id); return n ? updateNote(id, { done: !n.done }) : null; }
export function removeNote(id) { write(read().filter(n => n.id !== id)); }
/** Open notes for a subject (shown on its class cards). */
export function notesForSubject(subject) {
  const s = String(subject || '').trim().toUpperCase();
  return read().filter(n => !n.done && n.subject === s);
}
