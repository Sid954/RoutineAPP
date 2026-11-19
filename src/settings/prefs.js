/**
 * Display and behaviour preferences (Settings). Pure and import-safe: no DOM at import time and no
 * dependency on other app modules, so utils.js, the clock and the tests can all use it.
 *
 * Each preference is stored as a short string in one localStorage entry. applyPrefs() mirrors every
 * value onto <html> as data-p-<name>="<value>", and settings/prefs.css turns those attributes into
 * layout (hide the room line, compact cards, ...). Preferences that need code (time format, accent
 * colour, swipe, pull to refresh) are read with getPref() where they are used.
 */

const KEY = 'routine.prefs.v1';

/** Every preference with its default. The Settings UI is built from pref-schema.js. */
export const DEFAULTS = {
  // Appearance
  accent: 'default',
  corners: 'default',
  textSize: 'default',
  // Home screen
  greeting: 'on',
  clock: 'on',
  weekStrip: 'on',
  countBadge: 'on',
  todayFab: 'on',
  // Class cards
  density: 'default',
  groupClasses: 'on',
  room: 'on',
  teacher: 'on',
  teacherName: 'full',
  duration: 'on',
  typeTag: 'on',
  progress: 'on',
  doneBadge: 'on',
  breaks: 'on',
  // Weekly routine
  routineBadge: 'on',
  routineDot: 'on',
  dimPast: 'on',
  // Time
  timeFormat: '12',
  // Gestures
  swipe: 'on',
  pull: 'on'
};

/** Accent colours: [dark theme, light theme, text on accent (dark theme), text on accent (light theme)]. */
export const ACCENTS = {
  default: null,
  violet: { dark: '#A78BFA', light: '#6D28D9', on: { dark: '#07090E', light: '#FFFFFF' }, label: 'Violet' },
  teal: { dark: '#2DD4BF', light: '#0F766E', on: { dark: '#07090E', light: '#FFFFFF' }, label: 'Teal' },
  green: { dark: '#4ADE80', light: '#15803D', on: { dark: '#07090E', light: '#FFFFFF' }, label: 'Green' },
  amber: { dark: '#FBBF24', light: '#B45309', on: { dark: '#07090E', light: '#FFFFFF' }, label: 'Amber' },
  orange: { dark: '#FB923C', light: '#C2410C', on: { dark: '#07090E', light: '#FFFFFF' }, label: 'Orange' },
  rose: { dark: '#FB7185', light: '#BE123C', on: { dark: '#07090E', light: '#FFFFFF' }, label: 'Rose' },
  pink: { dark: '#F472B6', light: '#BE185D', on: { dark: '#07090E', light: '#FFFFFF' }, label: 'Pink' }
};

let _cache = null;
let _mem = '';

function read() {
  if (_cache) return _cache;
  let raw = _mem;
  try { raw = localStorage.getItem(KEY) || ''; } catch (e) { /* storage blocked: memory only */ }
  let saved = {};
  try { saved = raw ? JSON.parse(raw) : {}; } catch (e) { saved = {}; }
  _cache = {};
  for (const k of Object.keys(DEFAULTS)) {
    _cache[k] = typeof saved[k] === 'string' ? saved[k] : DEFAULTS[k];
  }
  return _cache;
}

function write() {
  // Store only what differs from the default
  const out = {};
  for (const k of Object.keys(DEFAULTS)) if (_cache[k] !== DEFAULTS[k]) out[k] = _cache[k];
  const raw = JSON.stringify(out);
  _mem = raw;
  try { localStorage.setItem(KEY, raw); } catch (e) { /* ignore */ }
}

export function getPref(key) {
  return read()[key];
}

export function isOn(key) {
  return getPref(key) !== 'off';
}

export function setPref(key, value) {
  if (!(key in DEFAULTS)) return;
  const prefs = read();
  const next = String(value);
  if (prefs[key] === next) return;
  prefs[key] = next;
  write();
  applyPrefs();
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('prefs-changed', { detail: { key, value: next } }));
    }
  } catch (e) { /* ignore */ }
}

/** Back to the defaults (the routine, class and notifications are not touched). */
export function resetPrefs() {
  _cache = Object.assign({}, DEFAULTS);
  write();
  applyPrefs();
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('prefs-changed', { detail: { key: '*', value: '' } }));
    }
  } catch (e) { /* ignore */ }
}

const kebab = s => s.replace(/[A-Z]/g, c => '-' + c.toLowerCase());

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(hex, toward, amount) {
  const a = hexToRgb(hex);
  const b = toward === 'white' ? [255, 255, 255] : [0, 0, 0];
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** The five accent variables for a colour on a theme; null for the built-in accent. */
export function accentVars(id, theme) {
  const a = ACCENTS[id];
  if (!a) return null;
  const light = theme === 'light';
  const base = light ? a.light : a.dark;
  const [r, g, b] = hexToRgb(base);
  return {
    '--accent': base,
    '--accent-hover': light ? mix(base, 'black', 0.14) : mix(base, 'white', 0.25),
    '--accent-soft': `rgba(${r}, ${g}, ${b}, ${light ? 0.09 : 0.12})`,
    '--accent-subtle': `rgba(${r}, ${g}, ${b}, ${light ? 0.09 : 0.12})`,
    '--accent-border': `rgba(${r}, ${g}, ${b}, ${light ? 0.28 : 0.25})`,
    '--btn-text': light ? a.on.light : a.on.dark
  };
}

const ACCENT_PROPS = ['--accent', '--accent-hover', '--accent-soft', '--accent-subtle', '--accent-border', '--btn-text'];

/** Paint the chosen accent on <html> (inline wins over the theme sheets). Call again after a theme change. */
export function applyAccent() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = accentVars(getPref('accent'), root.getAttribute('data-color'));
  for (const p of ACCENT_PROPS) {
    if (vars) root.style.setProperty(p, vars[p]);
    else root.style.removeProperty(p);
  }
}

/** Mirror every preference onto <html> as data-p-<name> and paint the accent. */
export function applyPrefs() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const prefs = read();
  for (const k of Object.keys(DEFAULTS)) root.setAttribute('data-p-' + kebab(k), prefs[k]);
  applyAccent();
}
