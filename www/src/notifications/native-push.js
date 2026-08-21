import { CONFIG } from '../core/config.js';
import { setNativePush } from '../notifications/notifications.js';
import { Storage } from '../storage/storage.js';

export const NativePush = {
  isSupported() {
    return window.Capacitor && window.Capacitor.isNativePlatform();
  },

  async registerToken(token) {
    if (!token) return;
    try {
      await fetch(`${CONFIG.apiBase || ''}/api/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          platform: 'android',
          semester: Storage.getSemester(),
          section: Storage.getSection()
        })
      });
    } catch (e) {
      console.warn('Register token error:', e);
    }
  },

  async init() {
    if (!this.isSupported()) return;
  }
};

// Register self with Notifications to break the circular dependency
setNativePush(NativePush);
