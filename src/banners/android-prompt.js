const SESSION_DISMISS_KEY = 'routine_android_prompt_dismissed';

function isDismissedThisSession() {
  try { return sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true'; } catch { return false; }
}

function rememberDismissal() {
  try { sessionStorage.setItem(SESSION_DISMISS_KEY, 'true'); } catch {}
}

export function initAndroidPrompt() {
  const isCapacitorNative = window.Capacitor && window.Capacitor.isNativePlatform();
  const ua = navigator.userAgent || '';
  const isAndroidWeb = /Android/i.test(ua) && !isCapacitorNative;

  // Promote the Android app on Android mobile-browser visits, but:
  //  - never stack it on top of the first-launch welcome screen
  //  - once dismissed, don't re-show it in the same browsing session (e.g. after the
  //    reload that saving settings triggers)
  if (isAndroidWeb && !isDismissedThisSession()) {
    setTimeout(() => {
      const welcome = document.getElementById('welcomeModal');
      if (welcome && welcome.classList.contains('open')) return;
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
    rememberDismissal();
  };

  if (closeBtn) closeBtn.addEventListener('click', dismissModal);
  if (skipBtn) skipBtn.addEventListener('click', dismissModal);
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      dismissModal();
    });
  }
}
