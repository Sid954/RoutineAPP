import { Storage } from '../storage/storage.js';

export const THEME_COLORS = {
  pitch_black: { name: 'AMOLED Black',   desc: 'Pure OLED · 100% Black',   bg: '#000000', card: '#111114', accent: '#38bdf8', icon: '🖤' },
  dark:        { name: 'Midnight Navy',  desc: 'Cosmic Blue & Sky Glow',   bg: '#06080d', card: '#141824', accent: '#38bdf8', icon: '🌌' },
  cyberpunk:   { name: 'Cyberpunk Neon', desc: 'Electric Violet & Pink',   bg: '#080312', card: '#180c33', accent: '#c084fc', icon: '⚡' },
  matcha:      { name: 'Emerald Forest', desc: 'Deep Forest & Mint',       bg: '#020c07', card: '#0a2719', accent: '#34d399', icon: '🌲' },
  sunset:      { name: 'Solar Sunset',   desc: 'Ruby Rose & Amber Gold',   bg: '#0f0307', card: '#261223', accent: '#fb923c', icon: '🌅' },
  oceanic:     { name: 'Oceanic Abyss',  desc: 'Abyss Navy & Cyan Glow',   bg: '#020914', card: '#0a213f', accent: '#22d3ee', icon: '🌊' },
  nordic:      { name: 'Nordic Slate',   desc: 'Minimal Steel & Ice Blue', bg: '#0b0f17', card: '#1c2536', accent: '#93c5fd', icon: '❄️' },
  light:       { name: 'Pearl Light',    desc: 'Clean High-Key Day Mode',  bg: '#e2e8f0', card: '#ffffff', accent: '#0284c7', icon: '☀️' },
};

export const THEME_STYLES = {
  glassmorphism: { name: 'Glassmorphic', icon: '✨' },
  neumorphic:    { name: 'Neumorphic 3D', icon: '📐' },
  cyberpunk:     { name: 'Cyberpunk HUD', icon: '⚡' },
  bento:         { name: 'Bento Grid', icon: '🌿' },
};

export function applyTheme(style, color) {
  const activeStyle = style || Storage.getThemeStyle();
  const activeColor = color || Storage.getThemeColor();

  const root = document.documentElement;
  root.setAttribute('data-style', activeStyle);
  root.setAttribute('data-color', activeColor);

  // Update canvas visibility
  const ptc = document.getElementById('ptc');
  if (ptc) {
    ptc.style.display = (activeStyle === 'bento' || activeStyle === 'neumorphic') ? 'none' : 'block';
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

  renderThemeStyleTabs();
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

export function renderThemeStyleTabs() {
  const container = document.getElementById('themeStyleSegmented');
  if (!container) return;

  const currentStyle = Storage.getThemeStyle();
  container.innerHTML = Object.entries(THEME_STYLES).map(([k, v]) => {
    const isActive = k === currentStyle;
    return `
      <div class="theme-style-pill ${isActive ? 'active' : ''}" data-style-id="${k}">
        <span>${v.icon}</span>
        <span>${v.name}</span>
      </div>
    `;
  }).join('');
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

  const styleTabs = document.getElementById('themeStyleSegmented');
  const paletteGrid = document.getElementById('themePaletteGrid');

  if (styleTabs) {
    styleTabs.addEventListener('click', (e) => {
      const pill = e.target.closest('.theme-style-pill');
      if (!pill) return;
      const styleId = pill.dataset.styleId;
      if (styleId && THEME_STYLES[styleId]) {
        Storage.saveThemeStyle(styleId);
        applyTheme(styleId, Storage.getThemeColor());
      }
    });
  }

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

  renderThemeStyleTabs();
  renderThemePaletteGrid();
}
