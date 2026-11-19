/**
 * Settings page. The page is #editModal (a .mo-page).
 *  - Profile on top, then a search box and a list of groups. Tap a group to open it; one stays
 *    open at a time. Searching opens every group that has a match.
 *  - Name saves as you type (no reload) and updates the Home greeting.
 *  - Semester/section changes only show a "Switch" bar; that button (#saveAllSettingsBtn)
 *    runs saveAllSettings(), which downloads the routine and reloads.
 *  - Display and behaviour preferences live in prefs.js; their controls are rendered here from
 *    pref-schema.js into the [data-pref-group] containers, and apply instantly.
 *  - Theme and routine edits apply instantly (theme.js, editor.js).
 */
import { CONFIG, DAY_SHORT } from '../core/config.js';
import { Storage } from '../storage/storage.js';
import { offDays, setOffDays, hideOffDays, setHideOffDays } from '../core/off-days.js';
import { escapeHtml, format12h } from '../core/utils.js';
import { getPref, setPref, resetPrefs, ACCENTS, accentVars } from './prefs.js';
import { PREF_GROUPS } from './pref-schema.js';

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
  const text = `Semester ${Storage.getSemester()} · Section ${String(Storage.getSection()).toUpperCase()}`;
  const el = $('stSubtitle');
  if (el) el.textContent = text;
  const g = $('stClassSummary');
  if (g) g.textContent = text;
  const hero = $('stHeroClass');
  if (hero) hero.textContent = text;
}

/** One-line summaries on the group rows that carry live values. */
function refreshSummaries() {
  const ap = $('stAppearSummary');
  if (ap) {
    const theme = Storage.getThemeColor() === 'light' ? 'Light' : 'Dark';
    const accent = ACCENTS[getPref('accent')];
    ap.textContent = `${theme} theme · ${accent ? accent.label : 'Default'} accent`;
  }
  const tm = $('stTimeSummary');
  if (tm) {
    const days = offDays().map(d => DAY_SHORT[d]).join(', ');
    tm.textContent = `${getPref('timeFormat') === '24' ? '24' : '12'} hour · off: ${days || 'none'}`;
  }
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
  refreshHapticsAvailability();
}

/** Grey out "Vibrate on tap" when the phone can't vibrate or has touch vibration off. */
async function refreshHapticsAvailability() {
  const hap = $('stHaptics');
  const row = hap && hap.closest('.st-switch-row');
  const desc = row && row.querySelector('span > span');
  const WP = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.WidgetPlugin;
  if (!hap || !WP || !WP.getSystemState) return;
  try {
    const st = await WP.getSystemState();
    const off = st.hasVibrator === false ? 'This phone has no vibration motor'
      : st.hapticFeedbackEnabled === false ? 'Touch vibration is off in Android settings (Sound & vibration)'
      : '';
    hap.disabled = !!off;
    row.classList.toggle('is-disabled', !!off);
    if (desc) desc.textContent = off || 'Light haptic feedback on buttons and actions';
  } catch (e) {}
}

/* ── University off days ── */
function refreshOffDays() {
  const days = offDays();
  document.querySelectorAll('#stOffDays [data-dow]').forEach(b => {
    const on = days.includes(Number(b.dataset.dow));
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  const t = $('stHideOff');
  if (t) t.checked = hideOffDays();
}
function rerenderDayPickers() {
  if (typeof window.renderTimeline === 'function') window.renderTimeline(true);
  if (typeof window.__renderFreeRooms === 'function' && window.__currentAppViewId === 'free_rooms') window.__renderFreeRooms();
}

/* ── Preference controls (rendered from pref-schema.js) ── */
function itemHead(it) {
  return `<span class="st-choice-head"><strong>${escapeHtml(it.title)}</strong><span>${escapeHtml(it.desc)}</span></span>`;
}
function itemHtml(it) {
  const q = escapeHtml(`${it.title} ${it.desc} ${it.key}`.toLowerCase());
  if (it.type === 'switch') {
    return `<label class="st-switch-row st-item" data-q="${q}">
      <span><strong>${escapeHtml(it.title)}</strong><span>${escapeHtml(it.desc)}</span></span>
      <input type="checkbox" class="st-switch-input" data-pref-switch="${it.key}">
      <span class="st-switch-ui" aria-hidden="true"></span>
    </label>`;
  }
  if (it.type === 'choice') {
    return `<div class="st-item" data-q="${q}">${itemHead(it)}
      <div class="st-choice" role="radiogroup" aria-label="${escapeHtml(it.title)}" data-pref="${it.key}">
        ${it.options.map(([v, label]) => `<button type="button" role="radio" data-v="${v}">${escapeHtml(label)}</button>`).join('')}
      </div></div>`;
  }
  // accents
  const theme = Storage.getThemeColor() === 'light' ? 'light' : 'dark';
  const swatches = Object.keys(ACCENTS).map(id => {
    const vars = accentVars(id, theme);
    const name = ACCENTS[id] ? ACCENTS[id].label : 'Default';
    const style = vars ? ` style="--sw:${vars['--accent']};--sw-on:${vars['--btn-text']}"` : ' style="--sw-on:#fff"';
    return `<button type="button" role="radio" class="st-accent${vars ? '' : ' st-accent-default'}" data-v="${id}" aria-label="${name}" title="${name}"${style}></button>`;
  }).join('');
  return `<div class="st-item" data-q="${q} colour color blue violet teal green amber orange rose pink">${itemHead(it)}
    <div class="st-accents" role="radiogroup" aria-label="${escapeHtml(it.title)}" data-pref="${it.key}">${swatches}</div></div>`;
}

const PREVIEW_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const PREVIEW_USER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

/** A sample class card. It uses the real card classes, so every Settings choice shows on it at once. */
function previewHtml() {
  const teacher = getPref('teacherName') === 'code' ? 'MHE' : 'Mahmudul Hasan';
  return `<div class="resting-class-row" aria-hidden="true">
    <div class="resting-left">
      <div class="resting-time-col">
        <div class="time-connector-track"><span class="time-node-dot start"></span><span class="time-connector-line"></span><span class="time-node-dot"></span></div>
        <span class="resting-time-start">${format12h('09:45')}</span>
        <span class="resting-time-end">${format12h('11:00')}</span>
      </div>
      <div class="resting-info-col">
        <div class="resting-title-row"><span class="resting-code">DSL</span><span class="resting-tag theory">THEORY</span></div>
        <div class="card-meta-stacked">
          <div class="meta-line-item room">${PREVIEW_PIN}<span>Room 905</span></div>
          <div class="meta-line-item instructor">${PREVIEW_USER}<span>${teacher}</span></div>
        </div>
      </div>
    </div>
    <div class="resting-right-meta"><span class="duration-chip">1h 15m</span></div>
  </div>`;
}

function renderPrefControls() {
  document.querySelectorAll('[data-pref-group]').forEach(box => {
    const items = PREF_GROUPS[box.dataset.prefGroup] || [];
    // Consecutive items with the same section share one card under a small heading
    const sections = [];
    for (const it of items) {
      const last = sections[sections.length - 1];
      if (last && last.name === it.section) last.items.push(it);
      else sections.push({ name: it.section, items: [it] });
    }
    box.innerHTML = sections.map(sec => `<div class="st-sec"><h4 class="st-sec-title">${escapeHtml(sec.name)}</h4><div class="st-sec-card">${sec.items.map(itemHtml).join('')}</div></div>`).join('');
  });
  refreshPrefControls();
  refreshPreviews();
}

function refreshPreviews() {
  const html = previewHtml();
  document.querySelectorAll('[data-card-preview]').forEach(el => { el.innerHTML = html; });
}

/** Reflect the stored values in the switches and segmented controls. */
function refreshPrefControls() {
  document.querySelectorAll('[data-pref-switch]').forEach(inp => {
    inp.checked = getPref(inp.dataset.prefSwitch) !== 'off';
  });
  document.querySelectorAll('[data-pref]').forEach(box => {
    const cur = getPref(box.dataset.pref);
    box.querySelectorAll('[data-v]').forEach(b => {
      const on = b.dataset.v === cur;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', String(on));
    });
  });
}

function onPrefChanged(key) {
  refreshPrefControls();
  refreshPreviews();
  refreshSummaries();
  const all = key === '*';
  if (all || key === 'timeFormat' || key === 'teacherName') {
    import('../dashboard/update.js').then(m => m.forceUpdate && m.forceUpdate()).catch(() => {});
    rerenderDayPickers(); // the Home list (forceUpdate alone leaves the cards as they were)
    import('../clock/clock.js').then(m => m.updateClock && m.updateClock()).catch(() => {});
  }
  if (all || key === 'todayFab') { if (window.__updateFabAway) window.__updateFabAway(); }
}

/* ── Group pages (One UI style) + search ── */
let _listScroll = 0;

const bodyEl = () => document.querySelector('#editModal .st-body');
const mdEl = () => document.querySelector('#editModal .md');

function accOpen(acc, open) {
  const head = acc.querySelector('[data-acc-head]');
  const body = acc.querySelector('.st-acc-body');
  if (!head || !body) return;
  acc.classList.toggle('is-open', open);
  head.setAttribute('aria-expanded', String(open));
  body.hidden = !open;
  if (open && acc.dataset.acc === 'routine') {
    import('../edit-schedule/editor.js').then(m => m.renderEditColumns && m.renderEditColumns()).catch(() => {});
  }
}

function inGroup() {
  const b = bodyEl();
  return !!(b && b.classList.contains('st-in'));
}

/** Header shows the group's name while its page is open, "Settings" otherwise. */
function setHeader(title, sub) {
  const t = document.querySelector('#editModal .page-title');
  if (t) t.textContent = title;
  const st = $('stSubtitle');
  if (st) st.textContent = sub;
}

function enterGroup(acc) {
  const b = bodyEl();
  if (!b || !acc.querySelector('.st-acc-body')) return;
  const search = $('stSearch');
  if (search && search.value) { search.value = ''; applySearch(''); }
  const md = mdEl();
  _listScroll = md ? md.scrollTop : 0;
  document.querySelectorAll('#stGroups .st-acc.is-open').forEach(a => accOpen(a, false));
  document.querySelectorAll('#stGroups .st-cluster.has-open').forEach(c => c.classList.remove('has-open'));
  accOpen(acc, true);
  const cl = acc.closest('.st-cluster');
  if (cl) cl.classList.add('has-open');
  b.classList.add('st-in');
  const name = acc.querySelector('.st-acc-text strong');
  const sum = acc.querySelector('.st-acc-text span');
  setHeader(name ? name.textContent : 'Settings', sum ? sum.textContent : '');
  if (md) md.scrollTop = 0;
}

function leaveGroup() {
  const b = bodyEl();
  if (!b) return;
  document.querySelectorAll('#stGroups .st-acc.is-open').forEach(a => accOpen(a, false));
  document.querySelectorAll('#stGroups .st-cluster.has-open').forEach(c => c.classList.remove('has-open'));
  b.classList.remove('st-in');
  setHeader('Settings', '');
  refreshSubtitle();
  const md = mdEl();
  if (md) md.scrollTop = _listScroll;
}

function applySearch(raw) {
  const q = String(raw || '').trim().toLowerCase();
  const accs = document.querySelectorAll('#stGroups .st-acc');
  const none = $('stNoResults');
  const b = bodyEl();
  if (!q) {
    if (b) b.classList.remove('st-searching');
    accs.forEach(a => {
      a.classList.remove('st-hide');
      a.querySelectorAll('.st-hide').forEach(x => x.classList.remove('st-hide'));
      if (!inGroup()) accOpen(a, false);
    });
    document.querySelectorAll('#stGroups .st-cluster').forEach(c => c.classList.remove('st-hide'));
    if (none) none.hidden = true;
    return;
  }
  if (b) b.classList.add('st-searching');
  let shown = 0;
  accs.forEach(acc => {
    const head = (acc.querySelector('.st-acc-head') || acc).textContent.toLowerCase();
    const groupHit = head.includes(q);
    const items = acc.querySelectorAll('.st-item, .st-row[data-q]');
    let hits = 0;
    items.forEach(it => {
      const hit = groupHit || ((it.dataset.q || '') + ' ' + it.textContent).toLowerCase().includes(q);
      it.classList.toggle('st-hide', !hit);
      if (hit) hits++;
    });
    acc.querySelectorAll('.st-sec').forEach(sec => {
      sec.classList.toggle('st-hide', !groupHit && !sec.querySelector('.st-item:not(.st-hide), .st-row:not(.st-hide)'));
    });
    const show = groupHit || hits > 0;
    acc.classList.toggle('st-hide', !show);
    if (acc.querySelector('.st-acc-body')) accOpen(acc, show);
    if (show) shown++;
  });
  document.querySelectorAll('#stGroups .st-cluster').forEach(c => {
    c.classList.toggle('st-hide', !c.querySelector('.st-acc:not(.st-hide)'));
  });
  if (none) none.hidden = shown > 0;
}

/** Called every time the page opens. */
export function onSettingsOpen() {
  const input = $('displayNameInput');
  if (input) input.value = Storage.getDisplayName() || '';
  refreshProfile();
  refreshSubtitle();
  refreshSwitchBar();
  refreshMotion();
  refreshOffDays();
  renderPrefControls();
  refreshSummaries();
  const ver = $('stAppVersion');
  if (ver) ver.textContent = `Version ${CONFIG.appVersionName || ''}`.trim();
  refreshNotifSummary();
  const upd = $('updateCheckDetails');
  if (upd) { upd.style.display = 'none'; upd.innerHTML = ''; }
  const search = $('stSearch');
  if (search && search.value) { search.value = ''; applySearch(''); }
  if (inGroup()) leaveGroup();
  const page = $('editModal');
  const md = page && page.querySelector('.md');
  if (md) md.scrollTop = 0;
}

/** Settings → Notifications: one line from the health check ("All good" or the first problem). */
export async function refreshNotifSummary() {
  const el = $('stNotifSummary');
  if (!el) return;
  try {
    // A delivery problem wins; otherwise what is set (off / paused / the next alert)
    const [{ checkNotificationHealth }, { notifSummary }] = await Promise.all([
      import('../notifications/health.js'), import('../notifications/notif-center.js')
    ]);
    const { ok, issues } = await checkNotificationHealth();
    const problem = issues.find(i => i.level === 'error');
    const s = notifSummary();
    el.textContent = !ok && problem ? problem.title : s.text;
    el.classList.toggle('is-warn', (!ok && !!problem) || s.warn);
  } catch (e) {
    el.textContent = 'Permission and delivery check';
    el.classList.remove('is-warn');
  }
}

export function initSettingsPage() {
  // The summary may change after a fix inside the popup
  const nClose = $('notifModalClose');
  if (nClose) nClose.addEventListener('click', () => setTimeout(refreshNotifSummary, 250));
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

  // Preference controls: one delegated listener for every switch and segmented control
  const groups = $('stGroups');
  if (groups) {
    groups.addEventListener('change', e => {
      const sw = e.target.closest('[data-pref-switch]');
      if (sw) setPref(sw.dataset.prefSwitch, sw.checked ? 'on' : 'off');
    });
    groups.addEventListener('click', e => {
      const head = e.target.closest('[data-acc-head]');
      if (head) { enterGroup(head.closest('.st-acc')); return; }
      const opt = e.target.closest('[data-pref] [data-v]');
      if (opt) setPref(opt.closest('[data-pref]').dataset.pref, opt.dataset.v);
    });
  }
  window.addEventListener('prefs-changed', e => onPrefChanged(e.detail && e.detail.key));
  // The accent swatches show each colour's shade for the current theme
  const themeGrid = $('themePaletteGrid');
  if (themeGrid) themeGrid.addEventListener('click', () => setTimeout(() => { renderPrefControls(); refreshSummaries(); }, 0));

  const search = $('stSearch');
  if (search) search.addEventListener('input', () => applySearch(search.value));

  // Back (and the Android back button, which clicks it): leave a group's page first, close Settings second
  const page = $('editModal');
  if (page) page.addEventListener('click', e => {
    if (e.target.closest('#ecC') && inGroup()) { e.stopPropagation(); leaveGroup(); }
  }, true);

  const reset = $('stResetPrefs');
  if (reset) reset.addEventListener('click', () => {
    import('../modals/modal.js').then(({ showConfirm }) => {
      showConfirm(
        'Reset display settings?',
        'Accent colour, card options, time format and the other switches go back to the defaults. Your routine, class and notifications are kept.',
        () => { resetPrefs(); },
        false,
        'restore'
      );
    });
  });

  const od = $('stOffDays');
  if (od) od.addEventListener('click', e => {
    const b = e.target.closest('[data-dow]');
    if (!b) return;
    const d = Number(b.dataset.dow);
    const cur = offDays();
    setOffDays(cur.includes(d) ? cur.filter(x => x !== d) : cur.concat(d));
    refreshOffDays();
    refreshSummaries();
    rerenderDayPickers();
  });
  const ho = $('stHideOff');
  if (ho) ho.addEventListener('change', () => { setHideOffDays(ho.checked); rerenderDayPickers(); });

  onSettingsOpen();
}
