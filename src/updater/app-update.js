/**
 * In-app updater (Android APK): check -> sheet -> download (progress, SHA-256) -> install.
 * Metadata and the download come from our Vercel API (api/app-update.js), so updates keep
 * working when the GitHub repo is private. Native side: AppUpdaterPlugin.java.
 *
 *  - checkAppUpdate({ manual })   -> { available, info, installed } (shows the sheet on auto checks)
 *  - openUpdateSheet(info)        -> the update sheet (also used by Settings)
 *  - maybeShowWhatsNew()          -> one-time "Updated to vX" sheet after an update
 *  - scheduleResumeChecks()       -> re-checks when the app returns to the foreground (max every 6h)
 */
import { CONFIG } from '../core/config.js';
import { escapeHtml, fetchWithTimeout } from '../core/utils.js';
import { showToast } from '../toast/toast.js';

const K = {
  skipped: 'update_skipped_code',
  lastCheck: 'update_last_check_at',
  lastRun: 'update_last_run_code',
  notesFor: 'update_notes_cache',     // { code, name, notes, summary } of the version being installed
  ready: 'update_ready_file'          // { code, path } of a downloaded, verified APK
};
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const plugin = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppUpdater) || null;
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  json(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
};

/* ── Versions ──────────────────────────────────────────────────────────── */
export async function installedVersion() {
  if (isNative() && window.Capacitor.Plugins.App) {
    try {
      const info = await window.Capacitor.Plugins.App.getInfo();
      const code = parseInt(info.build, 10);
      if (code > 0) return { code, name: info.version || CONFIG.appVersionName || '' };
    } catch (e) {}
  }
  return { code: CONFIG.appVersionCode || 1, name: CONFIG.appVersionName || '' };
}

export async function fetchLatest() {
  const res = await fetchWithTimeout(`${CONFIG.apiBase}/api/app-update?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' }, 10000);
  if (!res.ok) {
    let msg = 'Update server unavailable';
    try { msg = (await res.json()).error || msg; } catch (e) {}
    throw new Error(msg);
  }
  const info = await res.json();
  if (!info || !info.versionCode) throw new Error('No release information');
  return info;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */
export const fmtMB = bytes => bytes > 0 ? `${(bytes / 1048576).toFixed(1)} MB` : '';

/** Tiny, safe markdown for release notes: ###, - bullets, **bold**. Drops the "# Title" line. */
export function notesHtml(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  let html = '';
  let inList = false;
  const inline = s => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const close = () => { if (inList) { html += '</ul>'; inList = false; } };
  lines.forEach(raw => {
    const line = raw.trim();
    if (!line || /^#\s/.test(line)) { close(); return; }
    const h = line.match(/^#{2,4}\s+(.*)$/);
    if (h) { close(); html += `<h4>${inline(h[1])}</h4>`; return; }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${inline(li[1])}</li>`; return; }
    close();
    html += `<p>${inline(line)}</p>`;
  });
  close();
  return html;
}

/** Decide whether to prompt. Pure, so tests can cover it. */
export function shouldPrompt({ info, installedCode, skippedCode, manual }) {
  if (!info || !(info.versionCode > installedCode)) return { show: false, forced: false };
  const forced = (info.minRequiredVersionCode || 0) > installedCode;
  if (manual || forced) return { show: true, forced };
  return { show: Number(skippedCode) !== info.versionCode, forced };
}

/* ── Sheet ─────────────────────────────────────────────────────────────── */
const ICON = {
  dl: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  spark: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
};
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

let sheet = null;
let current = null;        // { info, forced, state, path, percent, received, total, error }
let progressHandle = null;
let waitingForPermission = false;

function ensureSheet() {
  if (sheet) return sheet;
  sheet = document.createElement('div');
  sheet.className = 'class-sheet-modal-overlay up-overlay';
  sheet.id = 'appUpdateSheet';
  sheet.innerHTML = '<div class="up-sheet" role="dialog" aria-modal="true" aria-labelledby="upTitle"><div class="up-grip" aria-hidden="true"></div><div class="up-body" id="upBody"></div></div>';
  document.body.appendChild(sheet);
  sheet.addEventListener('click', e => {
    if (e.target === sheet && !(current && current.forced)) { closeSheet(); return; }
    const a = e.target.closest('[data-up]');
    if (a) onAction(a.dataset.up);
  });
  return sheet;
}

function openSheetEl() {
  ensureSheet();
  sheet.classList.add('open');
  document.body.classList.add('modal-open');
}
function closeSheet() {
  if (!sheet) return;
  sheet.classList.remove('open');
  if (!document.querySelector('.mo.open, .class-sheet-modal-overlay.open')) document.body.classList.remove('modal-open');
}

function render() {
  const body = document.getElementById('upBody');
  if (!body || !current) return;
  const { info, forced, state } = current;
  const head = `<div class="up-head">
      <span class="up-icon">${svg(state === 'whatsnew' ? ICON.spark : ICON.dl)}</span>
      <div class="up-head-text">
        <h2 id="upTitle">${state === 'whatsnew' ? `Updated to v${escapeHtml(info.versionName)}` : (forced ? 'Update required' : 'Update available')}</h2>
        <span>${state === 'whatsnew' ? "Here's what's new" : `v${escapeHtml(info.versionName)}${info.size ? ` · ${fmtMB(info.size)}` : ''} · you have v${escapeHtml(current.installedName || '')}`}</span>
      </div>
      ${forced && state !== 'whatsnew' ? '' : `<button type="button" class="up-close" data-up="close" aria-label="Close">${svg(ICON.x)}</button>`}
    </div>`;
  const notes = notesHtml(info.notes) || (info.summary ? `<p>${escapeHtml(info.summary)}</p>` : '');
  const notesBlock = notes ? `<div class="up-notes">${notes}</div>` : '';

  let foot = '';
  if (state === 'whatsnew') {
    foot = '<button type="button" class="up-btn up-primary" data-up="close">Got it</button>';
  } else if (state === 'idle' || state === 'error') {
    foot = `${current.error ? `<p class="up-error">${escapeHtml(current.error)}</p>` : ''}
      ${!isNative() ? '<p class="up-hint">Updates install from the Android app. Here you can download the APK instead.</p>' : ''}
      <button type="button" class="up-btn up-primary" data-up="${isNative() ? 'update' : 'browser'}">${svg(ICON.dl)}${current.error ? 'Try again' : (isNative() ? 'Update now' : 'Download APK')}</button>
      ${forced ? '' : `<div class="up-row"><button type="button" class="up-btn up-ghost" data-up="later">Later</button><button type="button" class="up-btn up-ghost" data-up="skip">Skip this version</button></div>`}`;
  } else if (state === 'downloading') {
    const pct = current.percent >= 0 ? current.percent : 0;
    foot = `<div class="up-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      <div class="up-progress-text"><span>${current.received ? `${fmtMB(current.received)} of ${fmtMB(current.total || info.size)}` : 'Starting download…'}</span><span>${current.percent >= 0 ? `${pct}%` : ''}</span></div>
      <p class="up-hint">You can keep using the app. Closing this keeps the download going.</p>
      <div class="up-row"><button type="button" class="up-btn up-ghost" data-up="hide">Hide</button><button type="button" class="up-btn up-ghost" data-up="cancel">Cancel</button></div>`;
  } else if (state === 'ready') {
    foot = `<p class="up-ok">${svg(ICON.shield)}Downloaded and verified</p>
      <button type="button" class="up-btn up-primary" data-up="install">Install v${escapeHtml(info.versionName)}</button>
      <p class="up-hint">Android will ask you to confirm. The app restarts on the new version and keeps your routine and settings.</p>`;
  } else if (state === 'permission') {
    foot = `<div class="up-perm"><strong>One-time permission</strong><span>Android needs you to allow this app to install updates. Turn on "Allow from this source", then come back. The install continues on its own.</span></div>
      <button type="button" class="up-btn up-primary" data-up="perm">Open settings</button>
      <button type="button" class="up-btn up-ghost" data-up="install">I've allowed it</button>`;
  } else if (state === 'installing') {
    foot = '<p class="up-hint">Follow the Android installer. If nothing appeared, tap below.</p><button type="button" class="up-btn up-primary" data-up="install">Open installer again</button>';
  }
  body.innerHTML = head + notesBlock + `<div class="up-foot">${foot}</div>`;
}

export async function openUpdateSheet(info, { forced = false } = {}) {
  const inst = await installedVersion();
  const ready = ls.json(K.ready);
  current = { info, forced, state: 'idle', installedName: inst.name, percent: -1, received: 0, total: info.size || 0, error: '' };
  if (ready && ready.code === info.versionCode && ready.path) { current.path = ready.path; current.state = 'ready'; }
  openSheetEl();
  render();
}

async function startDownload() {
  const p = plugin();
  if (!p) { current.state = 'error'; current.error = 'Update this once from the release page; then updates install in the app.'; render(); return; }
  current.state = 'downloading'; current.error = ''; current.percent = -1; current.received = 0;
  render();
  try {
    if (progressHandle && progressHandle.remove) progressHandle.remove();
    progressHandle = await p.addListener('downloadProgress', ev => {
      if (!current || current.state !== 'downloading') return;
      current.percent = ev.percent; current.received = ev.received; current.total = ev.total;
      const bar = document.querySelector('#upBody .up-progress span');
      const txt = document.querySelector('#upBody .up-progress-text');
      if (bar && txt) {
        const pct = ev.percent >= 0 ? ev.percent : 0;
        bar.style.width = `${pct}%`;
        txt.innerHTML = `<span>${fmtMB(ev.received)} of ${fmtMB(ev.total || current.info.size)}</span><span>${ev.percent >= 0 ? `${pct}%` : ''}</span>`;
      } else render();
    });
    const res = await p.download({ url: current.info.downloadUrl, versionCode: current.info.versionCode, sha256: current.info.sha256 || '', size: current.info.size || 0 });
    current.path = res.path;
    current.state = 'ready';
    ls.set(K.ready, JSON.stringify({ code: current.info.versionCode, path: res.path }));
    ls.set(K.notesFor, JSON.stringify({ code: current.info.versionCode, name: current.info.versionName, notes: current.info.notes, summary: current.info.summary }));
    if (!sheet.classList.contains('open')) { openSheetEl(); }
    render();
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/cancel/i.test(msg)) { current.state = 'idle'; current.error = ''; }
    else { current.state = 'error'; current.error = `Download failed: ${msg}`; }
    if (sheet.classList.contains('open')) render();
    else if (current.state === 'error') showToast('Update download failed. Open Settings → Check for updates to retry.', 'error');
  } finally {
    if (progressHandle && progressHandle.remove) { progressHandle.remove(); progressHandle = null; }
  }
}

async function install() {
  const p = plugin();
  if (!p || !current || !current.path) return;
  try {
    const r = await p.install({ path: current.path });
    if (r && r.needsPermission) { current.state = 'permission'; waitingForPermission = true; render(); return; }
    current.state = 'installing';
    render();
  } catch (e) {
    ls.del(K.ready);
    current.state = 'error';
    current.error = String((e && e.message) || e);
    current.path = '';
    render();
  }
}

function onAction(a) {
  if (!current) return;
  switch (a) {
    case 'close': case 'hide': case 'later': closeSheet(); break; // a running download keeps going
    case 'skip': ls.set(K.skipped, String(current.info.versionCode)); closeSheet(); showToast(`Skipped v${current.info.versionName}. Check again in Settings.`, 'info'); break;
    case 'update': startDownload(); break;
    case 'cancel': if (plugin()) plugin().cancelDownload(); break;
    case 'install': install(); break;
    case 'perm': if (plugin()) { waitingForPermission = true; plugin().openInstallSettings(); } break;
    case 'browser': window.open(current.info.downloadUrl, '_blank'); break;
  }
}

/* ── Checks ────────────────────────────────────────────────────────────── */
/**
 * @param {{manual?: boolean, silent?: boolean}} opts  silent: never open the sheet (Settings card does)
 * @returns {Promise<{available:boolean, forced?:boolean, info?:object, installed?:object, error?:string}>}
 */
export async function checkAppUpdate({ manual = false, silent = false } = {}) {
  const installed = await installedVersion();
  let info;
  try {
    info = await fetchLatest();
  } catch (e) {
    return { available: false, installed, error: e.message };
  }
  ls.set(K.lastCheck, String(Date.now()));
  if (!(info.versionCode > installed.code)) {
    ls.del(K.ready);
    return { available: false, info, installed };
  }
  const p = shouldPrompt({ info, installedCode: installed.code, skippedCode: ls.get(K.skipped), manual });
  if (p.show && !silent && isNative()) openUpdateSheet(info, { forced: p.forced });
  return { available: true, forced: p.forced, info, installed };
}

/** After an update, show the notes of the version now running (once). */
export async function maybeShowWhatsNew() {
  const inst = await installedVersion();
  const last = Number(ls.get(K.lastRun) || 0);
  ls.set(K.lastRun, String(inst.code));
  if (!last || inst.code <= last) return false;
  ls.del(K.ready);
  ls.del(K.skipped);
  if (plugin()) plugin().clearDownloads().catch(() => {});
  let cached = ls.json(K.notesFor);
  let info = cached && cached.code === inst.code ? { versionCode: inst.code, versionName: cached.name || inst.name, notes: cached.notes, summary: cached.summary } : null;
  if (!info) {
    try { const latest = await fetchLatest(); if (latest.versionCode === inst.code) info = latest; } catch (e) {}
  }
  ls.del(K.notesFor);
  if (!info || !(info.notes || info.summary)) { showToast(`Updated to v${inst.name}`, 'success'); return true; }
  current = { info, forced: false, state: 'whatsnew', installedName: inst.name };
  openSheetEl();
  render();
  return true;
}

/** Re-check when the app comes back to the foreground; finish a pending install after Settings. */
export function scheduleResumeChecks() {
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    if (waitingForPermission && current && current.path && plugin()) {
      try {
        const { allowed } = await plugin().canInstall();
        if (allowed) { waitingForPermission = false; install(); return; }
      } catch (e) {}
    }
    const last = Number(ls.get(K.lastCheck) || 0);
    if (Date.now() - last > CHECK_EVERY_MS && !(sheet && sheet.classList.contains('open'))) checkAppUpdate();
  });
}
