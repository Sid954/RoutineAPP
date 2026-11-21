import { Storage } from '../storage/storage.js';
import { applyPrefs, applyAccent } from '../settings/prefs.js';

export const THEME_COLORS = {
  dark:  { name: 'Dark Mode',  desc: 'Refined Charcoal & Luminescent Sky', bg: '#131418', card: '#212329', accent: '#38BDF8', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' },
  light: { name: 'Light Mode', desc: 'Cool Paper & Cobalt Ink', bg: '#EEF1F6', card: '#FFFFFF', accent: '#2563EB', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' },
};

export const THEME_STYLES = {
  solid: { name: 'Solid Surface', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" ry="4"/></svg>' },
};

export function applyTheme(style, color) {
  let activeColor = color || Storage.getThemeColor();
  if (activeColor !== 'light') activeColor = 'dark';
  const activeStyle = 'solid';

  const root = document.documentElement;
  // Cross-fade colours when the user switches theme (not on the very first apply at boot)
  const previousColor = root.getAttribute('data-color');
  if (previousColor && previousColor !== activeColor) {
    root.classList.add('theme-transition');
    clearTimeout(applyTheme._fadeTimer);
    applyTheme._fadeTimer = setTimeout(() => root.classList.remove('theme-transition'), 450);
  }
  root.setAttribute('data-style', activeStyle);
  root.setAttribute('data-color', activeColor);
  root.setAttribute('data-theme', activeColor);
  applyAccent(); // the chosen accent colour has a light and a dark shade

  // Update canvas visibility
  const ptc = document.getElementById('ptc');
  if (ptc) {
    ptc.style.display = 'block';
  }

  // Sync Android OS status bar & browser meta theme-color
  const cMeta = THEME_COLORS[activeColor] || THEME_COLORS.dark;
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', cMeta.bg);
  }

  // Native Android Status Bar Sync
  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    try {
      const { StatusBar } = window.Capacitor.Plugins;
      if (StatusBar) {
        StatusBar.setBackgroundColor({ color: cMeta.bg });
        if (activeColor === 'light') {
          StatusBar.setStyle({ style: 'LIGHT' });
        } else {
          StatusBar.setStyle({ style: 'DARK' });
        }
      }
    } catch (e) {}
  }

  renderThemePaletteGrid();

  // Re-render schedule elements to apply pastel/dark subject theme cards
  import('../dashboard/update.js').then(({ forceUpdate }) => {
    forceUpdate();
  }).catch(() => {});

  // Sync Native Android Home Screen Widget Theme
  import('../widget/widget.js').then(({ updateNativeWidget }) => {
    updateNativeWidget();
  }).catch(() => {});
}

export function renderThemePaletteGrid() {
  const container = document.getElementById('themePaletteGrid');
  if (!container) return;

  const currentColor = Storage.getThemeColor() === 'light' ? 'light' : 'dark';
  const labels = { dark: 'Dark', light: 'Light' };
  // Settings → Appearance: a tiny phone preview drawn in each theme's own colours
  container.innerHTML = Object.entries(THEME_COLORS).map(([k, v]) => {
    const isActive = k === currentColor;
    const line = k === 'light' ? '#D5DCE6' : 'rgba(255,255,255,0.14)';
    return `
      <button type="button" role="radio" aria-checked="${isActive}" class="theme-palette-card st-theme ${isActive ? 'active' : ''}" data-color-id="${k}" title="${v.name}: ${v.desc}">
        <span class="st-theme-preview" style="background: ${v.bg};">
          <span class="st-theme-card" style="background: ${v.card};">
            <span class="st-theme-dot" style="background: ${v.accent};"></span>
            <span class="st-theme-line" style="background: ${line};"></span>
            <span class="st-theme-line short" style="background: ${line};"></span>
          </span>
          <span class="st-theme-card" style="background: ${v.card};">
            <span class="st-theme-line" style="background: ${line};"></span>
          </span>
        </span>
        <span class="st-theme-label">
          <span class="st-theme-radio" aria-hidden="true"></span>
          ${v.icon}<span>${labels[k] || v.name}</span>
        </span>
      </button>
    `;
  }).join('');
}

export function initThemeEngine() {
  applyPrefs(); // Settings preferences as data-p-* attributes on <html>, before the first paint
  const currentStyle = Storage.getThemeStyle();
  const currentColor = Storage.getThemeColor();
  applyTheme(currentStyle, currentColor);

  const paletteGrid = document.getElementById('themePaletteGrid');

  if (paletteGrid) {
    paletteGrid.addEventListener('click', (e) => {
      const card = e.target.closest('.theme-palette-card');
      if (!card) return;
      const colorId = card.dataset.colorId;
      if (colorId && THEME_COLORS[colorId]) {
        Storage.saveThemeColor(colorId);
        applyTheme(Storage.getThemeStyle(), colorId);
      }
    });
  }

  renderThemePaletteGrid();
}
