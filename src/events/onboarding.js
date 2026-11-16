import { Storage } from '../storage/storage.js';
import { THEME_STYLES, THEME_COLORS, applyTheme } from '../core/theme.js';
import { openModal, closeModal } from '../modals/modal.js';
import { saveAllSettings, loadCachedStructure, fetchRoutineStructure } from './init.js';

export function checkFirstTimeOnboarding() {
  if (Storage.isOnboardingCompleted()) return;

  const modal = document.getElementById('welcomeModal');
  const semSelect = document.getElementById('welcomeSemSelect');
  const secSelect = document.getElementById('welcomeSecSelect');
  const styleSelect = document.getElementById('welcomeStyleSelect');
  const colorSelect = document.getElementById('welcomeColorSelect');
  const startBtn = document.getElementById('welcomeGetStartedBtn');

  if (!modal || !semSelect || !secSelect || !styleSelect || !colorSelect || !startBtn) return;

  const currentSem = Storage.getSemester();
  const currentSec = Storage.getSection();
  const currentStyle = Storage.getThemeStyle();
  const currentColor = Storage.getThemeColor();

  // Shared, API-backed section list (cached / bundled fallback), refreshed in the background
  let structure = loadCachedStructure();

  function populateSemesters(selectedSem) {
    semSelect.innerHTML = Object.keys(structure)
      .sort((a, b) => Number(a) - Number(b))
      .map(sem => `<option value="${sem}"${sem === selectedSem ? ' selected' : ''}>Semester ${sem}</option>`)
      .join('');
  }

  populateSemesters(currentSem);

  function populateSections(sem, selectedSec) {
    const sections = structure[sem] || [];
    secSelect.innerHTML = sections
      .map(sec => `<option value="${sec}"${sec === selectedSec ? ' selected' : ''}>Section ${sec.toUpperCase()}</option>`)
      .join('');
  }

  populateSections(currentSem, currentSec);

  fetchRoutineStructure().then(fresh => {
    if (!fresh || JSON.stringify(fresh) === JSON.stringify(structure)) return;
    structure = fresh;
    const sem = structure[semSelect.value] ? semSelect.value : Object.keys(structure)[0];
    const sec = (structure[sem] || []).includes(secSelect.value) ? secSelect.value : (structure[sem] || [])[0];
    populateSemesters(sem);
    populateSections(sem, sec);
  });

  semSelect.addEventListener('change', () => {
    const sem = semSelect.value;
    const availableSections = structure[sem] || [];
    let sec = secSelect.value;
    if (!availableSections.includes(sec)) {
      sec = availableSections[0] || 'a';
    }
    populateSections(sem, sec);
  });

  // Populate Themes
  styleSelect.innerHTML = Object.entries(THEME_STYLES)
    .map(([k, v]) => `<option value="${k}"${k === currentStyle ? ' selected' : ''}>${v.name}</option>`)
    .join('');

  colorSelect.innerHTML = Object.entries(THEME_COLORS)
    .map(([k, v]) => `<option value="${k}"${k === currentColor ? ' selected' : ''}>${v.name}</option>`)
    .join('');

  // Live theme preview as user changes selection in welcome modal
  styleSelect.addEventListener('change', () => {
    applyTheme(styleSelect.value, colorSelect.value);
  });

  colorSelect.addEventListener('change', () => {
    applyTheme(styleSelect.value, colorSelect.value);
  });

  // Handle Save & Get Started
  startBtn.addEventListener('click', () => {
    const sem = semSelect.value;
    const sec = secSelect.value;
    const style = styleSelect.value;
    const color = colorSelect.value;

    // Save preferences
    const nameInput = document.getElementById('welcomeNameInput');
    if (nameInput) Storage.saveDisplayName(nameInput.value);
    Storage.saveSemester(sem);
    Storage.saveSection(sec);
    Storage.saveThemeStyle(style);
    Storage.saveThemeColor(color);
    Storage.completeOnboarding();

    closeModal(modal);

    // Sync to main settings selects if present
    const mainSemSelect = document.getElementById('routineSemesterSelect');
    const mainSecSelect = document.getElementById('routineSectionSelect');
    if (mainSemSelect) mainSemSelect.value = sem;
    if (mainSecSelect) mainSecSelect.value = sec;
    const mainNameInput = document.getElementById('displayNameInput');
    if (mainNameInput) mainNameInput.value = Storage.getDisplayName();

    // Execute saveAllSettings to load section routine & reload
    saveAllSettings();
  });

  // Open Welcome Modal
  setTimeout(() => {
    openModal(modal);
  }, 400);
}
