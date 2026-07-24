import { SUBJECT_PALETTES, LAB_THEME } from '../core/config.js';

export const LIGHT_SUBJECT_PALETTES = [
  { bg: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)', border: '#6366f1', text: '#1e1b4b', badge: '#818cf8' }, // Indigo Pastel
  { bg: 'linear-gradient(135deg, #ccfbf1, #99f6e4)', border: '#0d9488', text: '#042f2e', badge: '#14b8a6' }, // Mint Teal Pastel
  { bg: 'linear-gradient(135deg, #ffedd5, #fed7aa)', border: '#ea580c', text: '#431407', badge: '#fb923c' }, // Peach Amber Pastel
  { bg: 'linear-gradient(135deg, #f5f3ff, #ddd6fe)', border: '#7c3aed', text: '#2e1065', badge: '#a78bfa' }, // Lavender Violet Pastel
  { bg: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)', border: '#475569', text: '#0f172a', badge: '#94a3b8' }, // Slate Blue Pastel
  { bg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', border: '#db2777', text: '#500724', badge: '#f472b6' }  // Rose Magenta Pastel
];

export const LIGHT_LAB_THEME = { bg: 'linear-gradient(135deg, #ffe4e6, #fecdd3)', border: '#e11d48', text: '#4c0519', badge: '#f43f5e', isLab: true };

export function getSubjectTheme(subject, type) {
  const clean = subject.toUpperCase().replace(/[^A-Z]/g, '');
  const isLab = type.toLowerCase() === 'lab' || clean.includes('LAB') || clean.endsWith('L');
  const isLightMode = document.documentElement.getAttribute('data-color') === 'light';

  if (isLab) return isLightMode ? LIGHT_LAB_THEME : LAB_THEME;

  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);

  const palettes = isLightMode ? LIGHT_SUBJECT_PALETTES : SUBJECT_PALETTES;
  return palettes[Math.abs(hash) % palettes.length];
}
