export function initAndroidPrompt() {
  const isCapacitorNative = window.Capacitor && window.Capacitor.isNativePlatform();
  const ua = navigator.userAgent || '';
  const isAndroidWeb = /Android/i.test(ua) && !isCapacitorNative;

  // 2. Show Android App Promo Modal on EVERY Android Mobile Browser Visit
  if (isAndroidWeb) {
    setTimeout(() => {
      const modal = document.getElementById('androidAppModal');
      if (modal) modal.style.display = 'flex';
    }, 1200);
  }

  // Event Handlers for Closing/Dismissing Modal
  const modal = document.getElementById('androidAppModal');
  const closeBtn = document.getElementById('androidAppModalClose');
  const skipBtn = document.getElementById('androidAppModalSkipBtn');
  const downloadBtn = document.getElementById('androidAppModalDownloadBtn');

  const dismissModal = () => {
    if (modal) modal.style.display = 'none';
  };

  if (closeBtn) closeBtn.addEventListener('click', dismissModal);
  if (skipBtn) skipBtn.addEventListener('click', dismissModal);
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      dismissModal();
    });
  }
}
