import { escapeHtml } from '../core/utils.js';
import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { showToast } from '../toast/toast.js';
import { openModal, closeModal } from '../modals/modal.js';

export const NotificationLog = {
  MAX_ENTRIES: 50,

  getAll() {
    try {
      const saved = localStorage.getItem('routine_notif_log');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  },

  add(entry) {
    const log = this.getAll();
    // Improved duplicate detection check: check type, title, and body content
    // within 12 hours so multiple classes of the same subject on the same day can be log-recorded.
    const isDuplicate = log.some(e => 
      e.type === entry.type && 
      e.title === entry.title &&
      e.body === entry.body &&
      (Math.abs(Date.now() - new Date(e.timestamp).getTime()) < 12 * 60 * 60 * 1000)
    );
    if (isDuplicate) return;

    log.unshift({
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      ...entry,
      timestamp: new Date().toISOString(),
      read: false
    });
    if (log.length > this.MAX_ENTRIES) log.length = this.MAX_ENTRIES;
    try { localStorage.setItem('routine_notif_log', JSON.stringify(log)); } catch {}
  },

  markAllRead() {
    const log = this.getAll();
    log.forEach(e => e.read = true);
    try { localStorage.setItem('routine_notif_log', JSON.stringify(log)); } catch {}
  },

  clear() {
    try { localStorage.removeItem('routine_notif_log'); } catch {}
  },

  async delete(id) {
    let pwd = State.sessionDeletePassword;
    if (!pwd) {
      pwd = prompt('Enter password to delete this notification:');
      if (pwd === null) return;
      if (!pwd) {
        showToast('Password is required.', 'warning');
        return;
      }
    }

    try {
      // Verify password against backend process.env.ANNOUNCEMENT_PASSWORD
      const res = await fetch(`${CONFIG.apiBase || ''}/api/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd, checkPasswordOnly: true })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Invalid password');
      }

      // Store correct password for session
      State.sessionDeletePassword = pwd;

      // Delete from local storage
      const log = this.getAll();
      const updated = log.filter(e => e.id !== id);
      localStorage.setItem('routine_notif_log', JSON.stringify(updated));
      showToast('Notification deleted.', 'success');
      this.renderList(DOM.notifHistoryList);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  },

  renderList(container) {
    const log = this.getAll();
    if (!log.length) {
      container.innerHTML = '<div class="notif-history-empty"><span style="font-size: 28px; display: block; margin-bottom: 8px;">🔕</span>No notifications yet.<br>Enable notifications to start receiving alerts.</div>';
      return;
    }

    const typeEmoji = {
      reminder: '⏰', class_start: '📚', morning_briefing: '☀️',
      cancellation: '🚫', class_end: '⌛', day_done: '🎉',
      online_class: '📡', holiday: '🎉'
    };
    const typeLabel = {
      reminder: 'Reminder', class_start: 'Class Start', morning_briefing: 'Briefing',
      cancellation: 'Cancelled', class_end: 'Ending Soon', day_done: 'Day Done',
      online_class: 'Online Class', holiday: 'Holiday'
    };

    container.innerHTML = log.map(entry => {
      const d = new Date(entry.timestamp);
      const timeStr = d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
      return `
        <div class="notif-history-card ${entry.type || ''}${entry.read ? '' : ' unread'}">
          <div class="notif-history-emoji">${typeEmoji[entry.type] || '🔔'}</div>
          <div class="notif-history-content">
            <div class="notif-history-title">${escapeHtml(entry.title)}</div>
            <div class="notif-history-body">${escapeHtml(entry.body)}</div>
            <span class="notif-type-badge ${entry.type}">${typeLabel[entry.type] || entry.type}</span>
          </div>
          <button class="delete-notif-btn" data-id="${entry.id}" title="Delete Notification">✕</button>
          <div class="notif-history-time">${timeStr}</div>
        </div>
      `;
    }).join('');

    this.markAllRead();
  },


};
