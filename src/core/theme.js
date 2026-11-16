import { Storage } from '../storage/storage.js';

export const THEME_COLORS = {
  dark:  { name: 'Dark Mode',  desc: 'Refined Charcoal & Luminescent Sky', bg: '#18191E', card: '#23252C', accent: '#38BDF8', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' },
  light: { name: 'Light Mode', desc: 'Warm Cream Linen & Cobalt Ultramarine', bg: '#F7F4EB', card: '#FFFFFF', accent: '#2563EB', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' },
};

export const THEME_STYLES = {
  solid: { name: 'Solid Surface', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" ry="4"/></svg>' },
};

export function applyTheme(style, color) {
  let activeColor = color || Storage.getThemeColor();
  if (activeColor !== 'light') activeColor = 'dark';
  const activeStyle = 'solid';

  const root = document.documentElement;
  root.setAttribute('data-style', activeStyle);
  root.setAttribute('data-color', activeColor);
  root.setAttribute('data-theme', activeColor);

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

  const currentColor = Storage.getThemeColor();
  container.innerHTML = Object.entries(THEME_COLORS).map(([k, v]) => {
    const isActive = k === currentColor;
    return `
      <div class="theme-palette-card ${isActive ? 'active' : ''}" data-color-id="${k}" title="${v.name} — ${v.desc}">
        ${isActive ? '<span class="theme-check-icon">✓</span>' : ''}
        <div class="theme-palette-preview">
          <div class="theme-preview-body" style="background: ${v.card};"></div>
          <div class="theme-preview-accent" style="background: ${v.accent};"></div>
        </div>
        <div>
          <div class="theme-palette-title">${v.icon} ${v.name}</div>
          <div class="theme-palette-desc">${v.desc}</div>
        </div>
      </div>
    `;
  }).join('');
}

export function initThemeEngine() {
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
