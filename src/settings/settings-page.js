/**
 * Settings page (redesigned Nov 2026). The page is #editModal (a .mo-page).
 *  - Name saves as you type (no reload) and updates the Home greeting.
 *  - Semester/section changes only show a "Switch" bar; that button (#saveAllSettingsBtn)
 *    runs saveAllSettings(), which downloads the routine and reloads.
 *  - Theme and routine edits apply instantly (theme.js, editor.js).
 */
import { CONFIG } from '../core/config.js';
import { Storage } from '../storage/storage.js';

const $ = (id) => document.getElementById(id);
let _nameTimer = null;
let _hintTimer = null;

function initialOf(name) {
  const t = String(name || '').trim();
  return t ? t[0].toUpperCase() : 'S';
}

function refreshProfile() {
  const input = $('displayNameInput');
  const avatar = $('stAvatar');
  if (avatar) avatar.textContent = initialOf(input ? input.value : Storage.getDisplayName());
}

function refreshSubtitle() {
  const el = $('stSubtitle');
  if (!el) return;
  el.textContent = `Semester ${Storage.getSemester()} · Section ${String(Storage.getSection()).toUpperCase()}`;
}

/** Shows the Switch bar when the selects differ from the saved class. */
export function refreshSwitchBar() {
  const sem = $('routineSemesterSelect');
  const sec = $('routineSectionSelect');
  const bar = $('stSwitchBar');
  if (!sem || !sec || !bar) return;
  const changed = sem.value !== String(Storage.getSemester()) || sec.value !== String(Storage.getSection());
  const title = $('stSwitchTitle');
  if (title) title.textContent = `Switch to Semester ${sem.value} · Section ${String(sec.value).toUpperCase()}`;
  if (changed && bar.hidden) {
    bar.hidden = false;
    bar.classList.remove('is-entering');
    void bar.offsetWidth;
    bar.classList.add('is-entering');
  } else if (!changed) {
    bar.hidden = true;
  }
}

function saveNameNow() {
  const input = $('displayNameInput');
  if (!input) return;
  const value = input.value.trim();
  if (value === (Storage.getDisplayName() || '')) return;
  Storage.saveDisplayName(value);
  import('../dashboard/greeting.js').then(m => m.updateGreeting && m.updateGreeting()).catch(() => {});
  const hint = $('stNameHint');
  if (hint) {
    hint.textContent = value ? 'Saved' : 'Name removed';
    hint.classList.add('is-saved');
    clearTimeout(_hintTimer);
    _hintTimer = setTimeout(() => {
      hint.textContent = 'Shown in the greeting on Home';
      hint.classList.remove('is-saved');
    }, 1600);
  }
}

/* ── Motion & haptics (motion-engine.js) ── */
const TIER_LABEL = { full: 'Full', lite: 'Lite', off: 'Off' };
function refreshMotion() {
  const M = window.__motion;
  if (!M) return;
  const pref = M.pref();
  document.querySelectorAll('#stMotionSeg [data-motion-pref]').forEach(b => {
    const on = b.dataset.motionPref === pref;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', String(on));
  });
  const hint = $('stMotionHint');
  if (hint) hint.textContent = pref === 'auto' ? `Auto · using ${TIER_LABEL[M.tier] || M.tier}` : 'Fixed';
  const hap = $('stHaptics');
  if (hap) hap.checked = M.hapticsOn();
}

/** Called every time the page opens. */
export function onSettingsOpen() {
  const input = $('displayNameInput');
  if (input) input.value = Storage.getDisplayName() || '';
  refreshProfile();
  refreshSubtitle();
  refreshSwitchBar();
  refreshMotion();
  const ver = $('stAppVersion');
  if (ver) ver.textContent = `Version ${CONFIG.appVersionName || ''}`.trim();
  const upd = $('updateCheckDetails');
  if (upd) { upd.style.display = 'none'; upd.innerHTML = ''; }
  const page = $('editModal');
  const md = page && page.querySelector('.md');
  if (md) md.scrollTop = 0;
}

export function initSettingsPage() {
  const input = $('displayNameInput');
  if (input) {
    input.addEventListener('input', () => {
      refreshProfile();
      clearTimeout(_nameTimer);
      _nameTimer = setTimeout(saveNameNow, 450);
    });
    input.addEventListener('blur', () => { clearTimeout(_nameTimer); saveNameNow(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
  }

  const sem = $('routineSemesterSelect');
  const sec = $('routineSectionSelect');
  // init.js repopulates the section list on semester change; read after it runs
  if (sem) sem.addEventListener('change', () => setTimeout(refreshSwitchBar, 0));
  if (sec) sec.addEventListener('change', refreshSwitchBar);

  const undo = $('stSwitchUndo');
  if (undo && sem && sec) {
    undo.addEventListener('click', () => {
      sem.value = String(Storage.getSemester());
      sem.dispatchEvent(new Event('change'));
      setTimeout(() => {
        sec.value = String(Storage.getSection());
        refreshSwitchBar();
      }, 0);
    });
  }

  const seg = $('stMotionSeg');
  if (seg) seg.addEventListener('click', e => {
    const btn = e.target.closest('[data-motion-pref]');
    if (!btn || !window.__motion) return;
    window.__motion.setPref(btn.dataset.motionPref);
    refreshMotion();
  });
  const hap = $('stHaptics');
  if (hap) hap.addEventListener('change', () => { if (window.__motion) window.__motion.setHaptics(hap.checked); });

  onSettingsOpen();
}
