import { CONFIG } from '../core/config.js';
import { setNativePush } from '../notifications/notifications.js';
import { Storage } from '../storage/storage.js';

const ANNOUNCEMENTS_CHANNEL_ID = 'announcements_channel'; // must match android.notification.channelId in api/announcements.js

export const NativePush = {
  _listenersAdded: false,
  _initPromise: null,

  isSupported() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
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

  /**
   * Builds without google-services.json have no Firebase, and calling register() there
   * crashes the app natively. Older APKs lack the check method, so treat them as unconfigured.
   */
  async _isFirebaseConfigured() {
    try {
      const { WidgetPlugin } = window.Capacitor.Plugins;
      if (!WidgetPlugin || typeof WidgetPlugin.isFirebaseConfigured !== 'function') return false;
      const res = await WidgetPlugin.isFirebaseConfigured();
      return !!(res && res.configured);
    } catch (e) {
      return false;
    }
  },

  /**
   * Registers this device for FCM announcement pushes and sends the token, tagged with
   * the saved semester/section, to /api/register-token. Re-running it after a section
   * change (the app reloads after saving settings) updates the server's targeting.
   * @param {{ prompt?: boolean }} opts prompt=false only registers when permission is already granted.
   */
  init({ prompt = true } = {}) {
    if (!this.isSupported()) return Promise.resolve();
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._init(prompt).finally(() => { this._initPromise = null; });
    return this._initPromise;
  },

  async _init(prompt) {
    const PN = window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    if (!PN) return;
    if (!(await this._isFirebaseConfigured())) {
      console.warn('Push notifications unavailable: this build has no google-services.json.');
      return;
    }

    try {
      if (!this._listenersAdded) {
        this._listenersAdded = true;
        await PN.addListener('registration', ({ value }) => this.registerToken(value));
        await PN.addListener('registrationError', err => console.warn('FCM registration error:', err));
      }

      let perm = await PN.checkPermissions();
      if (prompt && (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale')) {
        perm = await PN.requestPermissions();
      }
      if (perm.receive !== 'granted') return;

      if (typeof PN.createChannel === 'function') {
        await PN.createChannel({
          id: ANNOUNCEMENTS_CHANNEL_ID,
          name: 'Announcements',
          description: 'Class cancellations, tests, assignments and other notices',
          importance: 5,
          visibility: 1
        }).catch(() => {});
      }

      await PN.register();
    } catch (e) {
      console.warn('Native push init error:', e);
    }
  }
};

// Register self with Notifications to break the circular dependency
setNativePush(NativePush);
