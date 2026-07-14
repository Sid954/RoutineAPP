import { SUBJECT_PALETTES, LAB_THEME } from '../core/config.js';

export function getSubjectTheme(subject, type) {
  const clean = subject.toUpperCase().replace(/[^A-Z]/g, '');
  const isLab = type.toLowerCase() === 'lab' || clean.includes('LAB') || clean.endsWith('L');
  if (isLab) return LAB_THEME;

  let hash = 0;
  for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length];
}
