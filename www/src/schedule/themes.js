import { SUBJECT_PALETTES, FULL_COURSE_NAMES } from '../core/config.js';
import { State } from '../core/state.js';

export const LIGHT_SUBJECT_PALETTES = [
  { bg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', border: '#6366f1', text: '#1e1b4b', badge: '#818cf8' }, // 0: Indigo
  { bg: 'linear-gradient(135deg, #ccfbf1, #99f6e4)', border: '#0d9488', text: '#042f2e', badge: '#14b8a6' }, // 1: Mint Teal
  { bg: 'linear-gradient(135deg, #ffedd5, #fed7aa)', border: '#ea580c', text: '#431407', badge: '#fb923c' }, // 2: Peach Amber
  { bg: 'linear-gradient(135deg, #f5f3ff, #ddd6fe)', border: '#7c3aed', text: '#2e1065', badge: '#a78bfa' }, // 3: Lavender Violet
  { bg: 'linear-gradient(135deg, #ffe4e6, #fecdd3)', border: '#e11d48', text: '#4c0519', badge: '#f43f5e' }, // 4: Ruby Rose
  { bg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', border: '#db2777', text: '#500724', badge: '#f472b6' }, // 5: Magenta Pink
  { bg: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', border: '#16a34a', text: '#14532d', badge: '#4ade80' }, // 6: Emerald Green
  { bg: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', border: '#0284c7', text: '#0c4a6e', badge: '#38bdf8' }, // 7: Sapphire Sky
  { bg: 'linear-gradient(135deg, #ffedd5, #ffedd5)', border: '#d97706', text: '#7c2d12', badge: '#f59e0b' }, // 8: Coral Orange
  { bg: 'linear-gradient(135deg, #fae8ff, #f5d0fe)', border: '#c026d3', text: '#4a044e', badge: '#e879f9' }, // 9: Plum Purple
  { bg: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', border: '#475569', text: '#0f172a', badge: '#94a3b8' }, // 10: Slate Steel
  { bg: 'linear-gradient(135deg, #ecfdf5, #a7f3d0)', border: '#059669', text: '#064e3b', badge: '#10b981' }  // 11: Dark Lime
];

const DEFAULT_FALLBACK_THEME = { bg: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '#818cf8', text: '#e0e7ff', badge: 'rgba(129,140,248,0.35)' };

let _cachedSubjectOrder = null;
let _cachedScheduleRef = null;

export function getSortedUniqueSubjects() {
  if (!_cachedSubjectOrder || _cachedScheduleRef !== State.schedule) {
    const set = new Set();

    if (FULL_COURSE_NAMES) {
      Object.keys(FULL_COURSE_NAMES).forEach(code => {
        const clean = code.toUpperCase().trim();
        if (clean) set.add(clean);
      });
    }

    if (State.schedule) {
      Object.values(State.schedule).forEach(dayClasses => {
        if (Array.isArray(dayClasses)) {
          dayClasses.forEach(item => {
            if (item && item.title) {
              const clean = item.title.toUpperCase().trim();
              if (clean) set.add(clean);
            }
          });
        }
      });
    }

    _cachedSubjectOrder = Array.from(set).sort((a, b) => a.localeCompare(b));
    _cachedScheduleRef = State.schedule;
  }

  return _cachedSubjectOrder;
}

export function getSubjectTheme(subject, type = '') {
  const clean = (subject || '').toUpperCase().trim();
  const isLightMode = document.documentElement.getAttribute('data-color') === 'light';
  const palettes = (isLightMode ? LIGHT_SUBJECT_PALETTES : SUBJECT_PALETTES) || [];

  if (palettes.length === 0) {
    return DEFAULT_FALLBACK_THEME;
  }

  const sortedSubjects = getSortedUniqueSubjects();
  let idx = sortedSubjects.indexOf(clean);

  if (idx === -1 && clean) {
    sortedSubjects.push(clean);
    sortedSubjects.sort((a, b) => a.localeCompare(b));
    idx = sortedSubjects.indexOf(clean);
  }

  if (idx === -1) idx = 0;

  const paletteIndex = idx % palettes.length;
  return palettes[paletteIndex] || palettes[0] || DEFAULT_FALLBACK_THEME;
}
