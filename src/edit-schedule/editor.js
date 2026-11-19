/**
 * Settings → "Your routine" editor (redesigned Nov 2026).
 * One day at a time: day chips (#stEditDays), that day's classes (#rCols), an add form and
 * clear / restore actions. Every change is saved immediately with an Undo toast; nothing here
 * needs the Settings "Switch" button.
 */
import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG, DAY_NAMES, DAY_SHORT } from '../core/config.js';
import { toMinutes, toTimeString, format12h, getCurrentMinutes, formatRoom, escapeHtml } from '../core/utils.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { forceUpdate } from '../dashboard/update.js';
import { Notifications } from '../notifications/notifications.js';
import { performUnifiedUpdateCheck, getActiveCacheVersion } from '../updater/apk-updater.js';

const ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

const sortedDay = (dayIdx) =>
  (State.schedule[dayIdx] || []).slice().sort((a, b) => toMinutes(a.start) - toMinutes(b.start));

function sortDayInPlace(dayIdx) {
  (State.schedule[dayIdx] || []).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/** The class being changed in the form below the list (null while adding a new class). */
let editing = null;

function commit() {
  Storage.saveSchedule();
  renderEditColumns();
  forceUpdate();
}

function selectedDay() {
  return CONFIG.activeDays.includes(State.selectedDay) ? State.selectedDay : CONFIG.activeDays[0];
}

export function populateDaySelect() {
  DOM.editDaySelect.innerHTML = '';
  for (const dayIdx of CONFIG.activeDays) {
    const opt = document.createElement('option');
    opt.value = dayIdx;
    opt.textContent = DAY_NAMES[dayIdx];
    if (dayIdx === State.selectedDay) opt.selected = true;
    DOM.editDaySelect.appendChild(opt);
  }
}

/** Week total for the "Edit classes" row. */
export function updateRoutineSummary() {
  const el = document.getElementById('stRoutineSummary');
  if (!el) return;
  const total = CONFIG.activeDays.reduce((n, d) => n + (State.schedule[d] || []).length, 0);
  el.textContent = total ? `${total} class${total === 1 ? '' : 'es'} a week · tap to edit` : 'No classes yet · tap to add';
}

function renderDayChips() {
  const wrap = document.getElementById('stEditDays');
  if (!wrap) return;
  const today = new Date().getDay();
  const sel = selectedDay();
  wrap.innerHTML = CONFIG.activeDays.map(d => {
    const n = (State.schedule[d] || []).length;
    return `<button type="button" role="tab" class="st-day${d === sel ? ' active' : ''}${d === today ? ' is-today' : ''}"
      data-day="${d}" aria-selected="${d === sel}">
      <span class="st-day-name">${DAY_SHORT[d]}</span><span class="st-day-count">${n}</span>
    </button>`;
  }).join('');
}

/** Renders the selected day's classes (name kept for existing callers). */
export function renderEditColumns() {
  const day = selectedDay();
  State.selectedDay = day;
  renderDayChips();
  updateRoutineSummary();

  const addLabel = document.getElementById('stAddLabel');
  if (addLabel) addLabel.textContent = `Add a class to ${DAY_NAMES[day]}`;
  const clr = document.getElementById('clrB');
  if (clr) clr.textContent = `Clear ${DAY_NAMES[day]}`;
  if (DOM.editDaySelect && String(DOM.editDaySelect.value) !== String(day)) DOM.editDaySelect.value = day;

  const isToday = day === new Date().getDay();
  const now = getCurrentMinutes();
  const entries = sortedDay(day);

  if (!entries.length) {
    DOM.editCols.innerHTML = `<div class="st-empty">No classes on ${DAY_NAMES[day]}.</div>`;
    return;
  }

  DOM.editCols.innerHTML = entries.map((c, i) => {
    const live = isToday && now >= toMinutes(c.start) && now < toMinutes(c.end);
    const meta = [c.room ? formatRoom(c.room) : '', c.instructor || '', c.type || ''].filter(Boolean).map(escapeHtml).join(' · ');
    return `<div class="st-class${live ? ' is-live' : ''}${editing && editing.item === c ? ' is-editing' : ''}" style="--i:${i}" data-i="${i}">
      <div class="st-class-time"><span>${format12h(c.start)}</span><span>${format12h(c.end)}</span></div>
      <div class="st-class-main">
        <div class="st-class-title">${escapeHtml(c.title)}</div>
        ${meta ? `<div class="st-class-meta">${meta}</div>` : ''}
      </div>
      <button type="button" class="st-class-edit" data-i="${i}" aria-label="Change ${escapeHtml(c.title)}" title="Change this class">${ICON_EDIT}</button>
      <button type="button" class="st-class-del" data-i="${i}" aria-label="Remove ${escapeHtml(c.title)}">${ICON_TRASH}</button>
    </div>`;
  }).join('');

  // Tap a class (or its pencil) to change it in the form below
  DOM.editCols.querySelectorAll('.st-class').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.st-class-del')) return;
      startEdit(day, sortedDay(day)[Number(row.dataset.i)]);
    });
  });

  DOM.editCols.querySelectorAll('.st-class-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = sortedDay(day)[Number(btn.dataset.i)];
      const list = State.schedule[day] || [];
      const idx = list.indexOf(target);
      if (idx === -1) return;
      if (editing && editing.item === target) stopEditing();
      const [removed] = list.splice(idx, 1);
      commit();
      showToast(`Removed ${removed.title} from ${DAY_NAMES[day]}`, 'info', () => {
        if (!State.schedule[day]) State.schedule[day] = [];
        State.schedule[day].push(removed);
        sortDayInPlace(day);
        commit();
        showToast(`Restored ${removed.title}`, 'success');
      });
    });
  });
}

const $e = id => document.getElementById(id);

/** Back to "add a class" mode: normal button label, no Cancel, empty form. */
function stopEditing() {
  editing = null;
  const t = $e('addBText');
  if (t) t.textContent = 'Add class';
  const ft = $e('stFormTitle');
  if (ft) ft.textContent = 'Add a class';
  const c = $e('cancelEditB');
  if (c) c.hidden = true;
  if (DOM.editTitle) { DOM.editTitle.value = ''; DOM.editRoom.value = ''; DOM.editInstructor.value = ''; }
}

/** Fill the form with a class and switch it to "Save changes". */
function startEdit(day, item) {
  if (!item) return;
  editing = { item, day };
  DOM.editTitle.value = item.title || '';
  DOM.editStart.value = toTimeString(Math.max(0, toMinutes(item.start)));
  DOM.editEnd.value = toTimeString(Math.max(0, toMinutes(item.end)));
  DOM.editRoom.value = item.room ? formatRoom(item.room) : '';
  DOM.editInstructor.value = item.instructor || '';
  if ([...DOM.editType.options].some(o => o.value === item.type)) DOM.editType.value = item.type;
  DOM.editDaySelect.value = String(day);
  const t = $e('addBText');
  if (t) t.textContent = 'Save changes';
  const ft = $e('stFormTitle');
  if (ft) ft.textContent = 'Change this class';
  const c = $e('cancelEditB');
  if (c) c.hidden = false;
  setAddFormOpen(true);
  const form = $e('addClassForm');
  if (form) requestAnimationFrame(() => form.scrollIntoView({ block: 'nearest' }));
  renderEditColumns();
}

function setAddFormOpen(open) {
  const form = document.getElementById('addClassForm');
  const btn = document.getElementById('toggleAddClassBtn');
  if (!form || !btn) return;
  form.style.display = open ? 'block' : 'none';
  form.classList.toggle('is-open', open);
  btn.classList.toggle('is-open', open);
  btn.setAttribute('aria-expanded', String(open));
  if (open) setTimeout(() => DOM.editTitle && DOM.editTitle.focus({ preventScroll: true }), 50);
}
export function resetEditorUI() { stopEditing(); setAddFormOpen(false); }

export function initEditorEvents() {
  DOM.editDaySelect.addEventListener('change', e => {
    State.selectedDay = parseInt(e.target.value, 10);
    renderEditColumns();
  });

  const chips = document.getElementById('stEditDays');
  if (chips) {
    chips.addEventListener('click', e => {
      const b = e.target.closest('.st-day');
      if (!b) return;
      State.selectedDay = parseInt(b.dataset.day, 10);
      renderEditColumns();
    });
  }

  // Add a class
  document.getElementById('addB').addEventListener('click', () => {
    const startTime = DOM.editStart.value;
    const endTime = DOM.editEnd.value;
    const title = DOM.editTitle.value.trim();
    const room = DOM.editRoom.value.trim();
    const instructor = DOM.editInstructor.value.trim();
    const classType = DOM.editType.value;
    const targetDay = parseInt(DOM.editDaySelect.value, 10);

    if (!title) { showToast('Add a subject name.', 'warning'); DOM.editTitle.focus(); return; }
    if (!startTime || !endTime) { showToast('Set a start and end time.', 'warning'); return; }
    if (toMinutes(endTime) <= toMinutes(startTime)) { showToast('The class has to end after it starts.', 'warning'); return; }

    // Changing an existing class: replace it (it may also move to another day), with Undo
    if (editing) {
      const { item, day: fromDay } = editing;
      const fromList = State.schedule[fromDay] || [];
      const at = fromList.indexOf(item);
      if (at === -1) { stopEditing(); renderEditColumns(); showToast('That class was removed. Add it again instead.', 'warning'); return; }
      fromList.splice(at, 1);
      const changed = Object.assign({}, item, { start: startTime, end: endTime, title, room, instructor, type: classType });
      if (!State.schedule[targetDay]) State.schedule[targetDay] = [];
      State.schedule[targetDay].push(changed);
      sortDayInPlace(targetDay);
      State.selectedDay = targetDay;
      stopEditing();
      setAddFormOpen(false);
      commit();
      Notifications.scheduleForToday();
      showToast(`Saved changes to ${title}`, 'success', () => {
        const list = State.schedule[targetDay] || [];
        const i = list.indexOf(changed);
        if (i !== -1) list.splice(i, 1);
        if (!State.schedule[fromDay]) State.schedule[fromDay] = [];
        State.schedule[fromDay].push(item);
        sortDayInPlace(fromDay);
        State.selectedDay = fromDay;
        commit();
        Notifications.scheduleForToday();
        showToast(`Changes to ${title} undone`, 'info');
      });
      return;
    }

    if (!State.schedule[targetDay]) State.schedule[targetDay] = [];
    State.schedule[targetDay].push({ start: startTime, end: endTime, title, room, instructor, type: classType });
    sortDayInPlace(targetDay);
    State.selectedDay = targetDay;
    commit();
    Notifications.scheduleForToday();

    DOM.editTitle.value = ''; DOM.editRoom.value = ''; DOM.editInstructor.value = '';
    showToast(`Added ${title} to ${DAY_NAMES[targetDay]}`, 'success');
  });

  const cancelEdit = document.getElementById('cancelEditB');
  if (cancelEdit) cancelEdit.addEventListener('click', () => { stopEditing(); setAddFormOpen(false); renderEditColumns(); });

  // Clear the selected day
  document.getElementById('clrB').addEventListener('click', () => {
    const day = selectedDay();
    if (!(State.schedule[day] || []).length) {
      showToast(`${DAY_NAMES[day]} is already empty.`, 'info');
      return;
    }
    const backup = JSON.parse(JSON.stringify(State.schedule[day]));
    State.schedule[day] = [];
    commit();
    showToast(`Cleared ${DAY_NAMES[day]}`, 'info', () => {
      State.schedule[day] = backup;
      commit();
      showToast(`Restored ${DAY_NAMES[day]}`, 'success');
    });
  });

  // Restore the official routine for the user's own section (with undo)
  document.getElementById('rstB').addEventListener('click', () => {
    const sem = Storage.getSemester();
    const sec = Storage.getSection();
    import('../modals/modal.js').then(({ showConfirm }) => {
      showConfirm(
        'Restore official routine?',
        `Your edits are replaced with the official routine for Semester ${sem} · Section ${String(sec).toUpperCase()}. You can undo this right after.`,
        async () => {
          const backup = JSON.parse(JSON.stringify(State.schedule));
          const { fetchSectionSchedule } = await import('../events/init.js');
          const fresh = await fetchSectionSchedule(sem, sec).catch(() => null);
          if (!fresh) { showToast('Could not load the official routine. Try again online.', 'error'); return; }
          State.schedule = fresh;
          commit();
          Notifications.scheduleForToday();
          showToast('Official routine restored', 'success', () => {
            State.schedule = backup;
            commit();
            showToast('Your edits are back', 'success');
          });
        },
        false,
        'restore'
      );
    });
  });

  // Expand / collapse the editor
  const toggle = document.getElementById('toggleEditRoutineCollapseBtn');
  const section = document.getElementById('collapsibleRoutineSection');
  if (toggle && section) {
    toggle.addEventListener('click', () => {
      const open = section.style.display === 'none';
      section.style.display = open ? 'block' : 'none';
      section.classList.toggle('is-open', open); // reveal animation (motion.css §10)
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      if (open) renderEditColumns();
    });
  }

  const addToggle = document.getElementById('toggleAddClassBtn');
  if (addToggle) {
    addToggle.addEventListener('click', () => {
      const form = document.getElementById('addClassForm');
      setAddFormOpen(form && form.style.display === 'none');
    });
  }

  updateEditModalCacheInfo();

  const checkUpdateBtn = document.getElementById('checkUpdateBtn');
  const updateDetailsPanel = document.getElementById('updateCheckDetails');
  if (checkUpdateBtn) {
    checkUpdateBtn.addEventListener('click', () => {
      performUnifiedUpdateCheck(updateDetailsPanel, true);
    });
  }
}

export async function updateEditModalCacheInfo() {
  const versionEl = document.getElementById('editCacheVersion');
  const statusEl = document.getElementById('editCacheStatus');
  if (!versionEl) return;

  const currentVersion = await getActiveCacheVersion();
  let label = 'Saved on this device';
  const tsMatch = String(currentVersion).match(/routine-cache-(\d+)/);
  if (tsMatch) {
    const d = new Date(parseInt(tsMatch[1], 10));
    if (!isNaN(d)) {
      label = `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
  }
  versionEl.textContent = label;
  versionEl.title = String(currentVersion);
  if (statusEl) {
    const online = navigator.onLine;
    statusEl.textContent = online ? 'Online' : 'Offline';
    statusEl.classList.toggle('is-offline', !online);
  }
}
