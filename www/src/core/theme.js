import { Storage } from '../storage/storage.js';

export const THEME_COLORS = {
  dark:        { name: '🌌 Cyber Midnight (Dark)', bg: '#06080d', card: '#0f172a', border: '#38bdf8', text: '#f8fafc' },
  pitch_black: { name: '🖤 OLED Pitch Black',      bg: '#000000', card: '#0d0d0d', border: '#525252', text: '#ffffff' },
  light:       { name: '☀️ Pearl White Mode',      bg: '#e2e8f0', card: '#ffffff', border: '#cbd5e1', text: '#0f172a' },
  matcha:      { name: '🍵 Zen Matcha Green',     bg: '#08120e', card: '#102019', border: '#10b981', text: '#f0fdf4' },
  sunset:      { name: '🌅 Solar Sunset Dusk',    bg: '#140812', card: '#21101e', border: '#fb923c', text: '#fff7ed' },
};

export const THEME_STYLES = {
  glassmorphism: { name: '✨ Glassmorphism Cyber', desc: 'Translucent cards, glow & backdrop blur' },
  neumorphic:    { name: '📐 Neumorphic 3D Soft',  desc: 'Soft 3D depth, pill buttons, zero harsh lines' },
  cyberpunk:     { name: '⚡ Cyberpunk HUD',        desc: 'Sharp cut corners, neon scanlines & HUD styling' },
  bento:         { name: '🌿 Minimalist Bento',     desc: 'Flat structured Bento-grid, ultra clean & battery efficient' },
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

  // Sync dropdown values if rendered in DOM
  const styleSelect = document.getElementById('themeStyleSelect');
  const colorSelect = document.getElementById('themeColorSelect');

  if (styleSelect) styleSelect.value = activeStyle;
  if (colorSelect) {
    colorSelect.value = activeColor;
    colorSelect.style.background = cMeta.card;
    colorSelect.style.color = cMeta.text;
    colorSelect.style.borderColor = cMeta.border;
  }

  // Re-render schedule elements to apply pastel/dark subject theme cards
  import('../dashboard/update.js').then(({ forceUpdate }) => {
    forceUpdate();
  }).catch(() => {});

  // Sync Native Android Home Screen Widget Theme
  import('../widget/widget.js').then(({ updateNativeWidget }) => {
    updateNativeWidget();
  }).catch(() => {});
}

export function initThemeEngine() {
  const currentStyle = Storage.getThemeStyle();
  const currentColor = Storage.getThemeColor();
  applyTheme(currentStyle, currentColor);

  const styleSelect = document.getElementById('themeStyleSelect');
  const colorSelect = document.getElementById('themeColorSelect');

  if (styleSelect) {
    styleSelect.innerHTML = Object.entries(THEME_STYLES)
      .map(([k, v]) => `<option value="${k}"${k === currentStyle ? ' selected' : ''}>${v.name}</option>`)
      .join('');

    styleSelect.addEventListener('change', () => {
      const selected = styleSelect.value;
      Storage.saveThemeStyle(selected);
      applyTheme(selected, colorSelect ? colorSelect.value : currentColor);
    });
  }

  if (colorSelect) {
    colorSelect.innerHTML = Object.entries(THEME_COLORS)
      .map(([k, v]) => `<option value="${k}"${k === currentColor ? ' selected' : ''}>${v.name}</option>`)
      .join('');

    colorSelect.addEventListener('change', () => {
      const selected = colorSelect.value;
      Storage.saveThemeColor(selected);
      applyTheme(styleSelect ? styleSelect.value : currentStyle, selected);
    });
  }
}
