/** Bottom sheets used by Home: add / edit a note, add / edit an exam. Calm motion, swipe down to close (.nt-sheet). */
import { State } from '../core/state.js';
import { Storage } from '../storage/storage.js';
import { escapeHtml } from '../core/utils.js';
import { openModal, closeModal } from '../modals/modal.js';
import { showToast } from '../toast/toast.js';
import { addNote, updateNote, removeNote, listNotes } from '../notes/notes-store.js';
import { addExam, removeExam, listOwnExams, EXAM_KINDS } from '../exams/exams-store.js';
import { Suggestions } from '../announcements/suggestions.js';

let _el = null;
function sheet() {
  if (_el) return _el;
  _el = document.createElement('div');
  _el.className = 'class-sheet-modal-overlay hm-sheet-overlay';
  _el.id = 'hmSheet';
  _el.style.zIndex = '100045';
  _el.innerHTML = `<div class="nt-sheet hm-sheet" role="dialog" aria-modal="true" aria-labelledby="hmSheetTitle">
      <div class="nt-grip"></div>
      <button type="button" class="nt-sheet-close" data-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
      <div class="nt-sheet-body" id="hmSheetBody"></div>
    </div>`;
  document.body.appendChild(_el);
  _el.addEventListener('click', e => { if (e.target === _el || e.target.closest('[data-close]')) closeModal(_el); });
  return _el;
}
const close = () => _el && closeModal(_el);

/** Every course code in the routine, for the subject pickers. */
function subjects() {
  const set = new Set();
  Object.values(State.schedule || {}).forEach(day => (day || []).forEach(c => c && c.title && set.add(String(c.title).trim().toUpperCase())));
  return [...set].sort();
}
const opts = (list, sel, blank) => `${blank ? `<option value="">${blank}</option>` : ''}${list.map(s => `<option value="${escapeHtml(s)}"${s === sel ? ' selected' : ''}>${escapeHtml(s)}</option>`).join('')}`;

export function openNoteSheet(id, onChange) {
  const note = id ? listNotes().find(n => n.id === id) : null;
  sheet();
  const body = document.getElementById('hmSheetBody');
  body.innerHTML = `
    <h2 class="hm-sheet-title" id="hmSheetTitle">${note ? 'Note' : 'New note'}</h2>
    <label class="hm-field"><span>What to remember</span><textarea id="hmNoteText" rows="3" maxlength="500" placeholder="Bring the lab report">${note ? escapeHtml(note.text) : ''}</textarea></label>
    <div class="hm-field-row">
      <label class="hm-field"><span>Class</span><select id="hmNoteSubj">${opts(subjects(), note ? note.subject : '', 'General')}</select></label>
      <label class="hm-field"><span>Date (optional)</span><input type="date" id="hmNoteDate" value="${note ? escapeHtml(note.date || '') : ''}"></label>
    </div>
    <div class="hm-sheet-actions">
      <button type="button" class="hm-btn is-wide" data-sheet="save">Save</button>
      <button type="button" class="hm-btn is-ghost is-wide" data-sheet="share">Share with my section</button>
      ${note ? '<button type="button" class="hm-btn is-danger is-wide" data-sheet="delete">Delete</button>' : ''}
    </div>
    <p class="hm-sheet-note">Notes stay on this phone. Sharing sends it to your section as a suggestion they can vote on.</p>`;
  const val = () => ({ text: document.getElementById('hmNoteText').value, subject: document.getElementById('hmNoteSubj').value, date: document.getElementById('hmNoteDate').value });
  body.onclick = async e => {
    const b = e.target.closest('[data-sheet]');
    if (!b) return;
    const v = val();
    if (b.dataset.sheet === 'delete') { removeNote(note.id); close(); onChange && onChange(); return; }
    if (!v.text.trim()) { document.getElementById('hmNoteText').focus(); return; }
    let saved = note ? updateNote(note.id, { text: v.text.trim(), subject: v.subject, date: v.date }) : addNote(v);
    if (b.dataset.sheet === 'share') {
      b.disabled = true;
      const r = await Suggestions.suggest({ name: Storage.getDisplayName() || 'Classmate', title: v.text.trim().slice(0, 80), announcement: v.text.trim(), type: 'general', subject: v.subject, date_override: v.date, semester: Storage.getSemester(), section: Storage.getSection() });
      b.disabled = false;
      showToast(r.ok ? 'Shared with your section as a suggestion' : (r.duplicateId ? 'Someone already suggested this' : (r.error || 'Could not share it now')), r.ok ? 'success' : 'warning');
    }
    if (saved) { close(); onChange && onChange(); }
  };
  openModal(_el);
  setTimeout(() => { if (!note) document.getElementById('hmNoteText')?.focus({ preventScroll: true }); }, 350);
}

export function openExamSheet(id, onChange) {
  const exam = id ? listOwnExams().find(e => e.id === id) : null;
  let kind = exam ? exam.kind : 'midterm';
  sheet();
  const body = document.getElementById('hmSheetBody');
  const draw = () => {
    body.innerHTML = `
      <h2 class="hm-sheet-title" id="hmSheetTitle">${exam ? 'Exam' : 'Add an exam'}</h2>
      <div class="hm-seg" role="radiogroup" aria-label="Kind">${['midterm', 'final', 'quiz', 'other'].map(k => `<button type="button" role="radio" aria-checked="${k === kind}" class="${k === kind ? 'active' : ''}" data-kind="${k}">${EXAM_KINDS[k]}</button>`).join('')}</div>
      <div class="hm-field-row">
        <label class="hm-field"><span>Course</span><select id="hmExamSubj">${opts(subjects(), exam ? exam.subject : '', 'Choose')}</select></label>
        <label class="hm-field"><span>Date</span><input type="date" id="hmExamDate" value="${exam ? escapeHtml(exam.date) : ''}"></label>
      </div>
      <label class="hm-field"><span>Time (optional)</span><input type="time" id="hmExamTime" value="${exam ? escapeHtml(exam.time || '') : ''}"></label>
      <div class="hm-sheet-actions">
        <button type="button" class="hm-btn is-wide" data-sheet="save">Save</button>
        ${exam ? '<button type="button" class="hm-btn is-danger is-wide" data-sheet="delete">Delete</button>' : ''}
      </div>
      <p class="hm-sheet-note">Class tests posted as notices show up on their own.</p>`;
  };
  draw();
  body.onclick = e => {
    const k = e.target.closest('[data-kind]');
    if (k) {
      const keep = { s: document.getElementById('hmExamSubj').value, d: document.getElementById('hmExamDate').value, t: document.getElementById('hmExamTime').value };
      kind = k.dataset.kind; draw();
      document.getElementById('hmExamSubj').value = keep.s; document.getElementById('hmExamDate').value = keep.d; document.getElementById('hmExamTime').value = keep.t;
      return;
    }
    const b = e.target.closest('[data-sheet]');
    if (!b) return;
    if (b.dataset.sheet === 'delete') { removeExam(exam.id); close(); onChange && onChange(); return; }
    const subj = document.getElementById('hmExamSubj').value;
    const date = document.getElementById('hmExamDate').value;
    if (!subj) { document.getElementById('hmExamSubj').focus(); showToast('Choose the course', 'warning'); return; }
    if (!date) { document.getElementById('hmExamDate').focus(); showToast('Pick the date', 'warning'); return; }
    if (exam) removeExam(exam.id);
    addExam({ subject: subj, kind, date, time: document.getElementById('hmExamTime').value });
    close(); onChange && onChange();
  };
  openModal(_el);
}
