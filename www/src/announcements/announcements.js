import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { escapeHtml } from '../core/utils.js';
import { NotificationLog } from '../notifications/notification-log.js';
import { openModal, closeModal, showConfirm } from '../modals/modal.js';
import { Notifications } from '../notifications/notifications.js';

export const Announcements = {
  list: [],
  CACHE_KEY: 'routine_announcements_cache',

  loadCached() {
    try {
      const saved = localStorage.getItem(this.CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.list = parsed;
          State.announcementsList = parsed;
          this.renderFeed();
          this.checkBadge();
          return true; // signals that overrides were loaded — caller should forceUpdate
        }
      }
    } catch (e) {
      console.warn('Could not load cached announcements:', e);
    }
    return false;
  },

  async fetchAll() {
    try {
      const cachedList = [];
      try {
        const saved = localStorage.getItem(this.CACHE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) cachedList.push(...parsed);
        }
      } catch (e) {}

      const res = await fetch(`${CONFIG.apiBase || ''}/api/announcements`);
      if (!res.ok) throw new Error('Failed to fetch');
      const rawList = await res.json();

      const currentSem = (Storage.getSemester() || '').toString().toLowerCase();
      const currentSec = (Storage.getSection() || '').toString().toLowerCase();

      // Filter announcements to only show items matching user's active semester & section (or unscoped/global)
      this.list = rawList.filter(item => {
        const semMatch = !item.semester || item.semester.toString().toLowerCase() === currentSem;
        const secMatch = !item.section || item.section.toString().toLowerCase() === currentSec;
        return semMatch && secMatch;
      });
      State.announcementsList = this.list;

      // Persist filtered list to localStorage so next startup is instant
      try { localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.list)); } catch (e) {}

      // Trigger notifications for new announcements (only if cache had items before, to prevent startup spam)
      if (cachedList.length > 0) {
        const newAnnouncements = this.list.filter(item => !cachedList.some(c => c.id === item.id));
        newAnnouncements.forEach(announce => {
          let bodyText = announce.announcement;
          if (announce.type === 'class_test') {
            try {
              const parsed = JSON.parse(announce.announcement);
              bodyText = `Exam: ${parsed.exam_name || 'Class Test'}\nTopics: ${parsed.topics || 'Not Specified'}`;
            } catch (e) {}
          } else if (announce.type === 'online_class') {
            try {
              const parsed = JSON.parse(announce.announcement);
              bodyText = `Platform: ${parsed.platform || 'Online'}\nTime: ${parsed.start_time || '—'} – ${parsed.end_time || '—'}`;
            } catch (e) {}
          }
          Notifications.showInstant(announce.title, bodyText, announce.type);
        });
      }

      this.renderFeed();
      this.checkBadge();
      return true; // signals success — caller should forceUpdate
    } catch (err) {
      console.error('Error fetching announcements:', err);
      // Already showing cached data; only show error if nothing loaded
      if (!this.list.length) {
        DOM.announceList.innerHTML = `<div class="announce-empty">Failed to load announcements. Check your connection.</div>`;
      }
      return false;
    }
  },

  renderFeed() {
    if (!this.list || this.list.length === 0) {
      DOM.announceList.innerHTML = `<div class="announce-empty">No announcements yet. Be the first to post!</div>`;
      return;
    }

    const typeMeta = {
      general:      { label: '📢 General',    color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
      cancellation: { label: '🚫 Cancelled',  color: '#f43f5e', bg: 'rgba(244,63,94,0.12)'  },
      holiday:      { label: '🎉 Holiday',    color: '#fb923c', bg: 'rgba(251,146,60,0.12)'  },
      online_class: { label: '📡 Online',     color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
      class_test:   { label: '📝 Class Test', color: '#f97316', bg: 'rgba(249,115,22,0.15)'  },
    };

    let html = '';
    this.list.forEach(item => {
      const dateStr = new Date(item.created_at).toLocaleString();
      const meta = typeMeta[item.type] || typeMeta.general;
      let bodyText = item.announcement;
      
      if (item.type === 'online_class') {
        try {
          const parsed = JSON.parse(item.announcement);
          const platformStr = parsed.platform ? `Platform: ${parsed.platform}` : 'Check class group';
          bodyText = `🕒 Time: ${parsed.start_time || '—'} – ${parsed.end_time || '—'}\n📡 ${platformStr}`;
        } catch (e) {
          // Fallback if not valid JSON
        }
      } else if (item.type === 'class_test') {
        try {
          const parsed = JSON.parse(item.announcement);
          bodyText = `✍️ Exam: ${parsed.exam_name || 'Class Test'}\n📚 Topics: ${parsed.topics || 'Not Specified'}`;
        } catch (e) {
          // Fallback if not valid JSON
        }
      }

      html += `
        <div class="announce-card" style="border-left: 3px solid ${meta.color};">
          <div class="announce-card-h" style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
                <span style="font-size:10.5px; font-weight:700; padding:2px 7px; border-radius:99px; background:${meta.bg}; color:${meta.color}; white-space:nowrap;">${meta.label}</span>
                ${item.date_override ? `<span style="font-size:10px; color:var(--dim);">📅 ${item.date_override}</span>` : ''}
              </div>
              <div class="announce-card-title">${escapeHtml(item.title)}</div>
              <span class="announce-card-author">${escapeHtml(item.name)}</span>
            </div>
            <button class="delete-announce-btn" data-id="${item.id}" style="background: none; border: none; color: var(--pink); font-size: 14px; cursor: pointer; padding: 4px 8px; opacity: 0.6; transition: opacity 0.2s;" title="Delete Announcement">✕</button>
          </div>
          <div class="announce-card-body">${escapeHtml(bodyText)}</div>
          <div class="announce-card-date">${dateStr}</div>
        </div>
      `;
    });
    DOM.announceList.innerHTML = html;
  },

  async delete(id, pwd) {
    if (!pwd) {
      showToast('Password is required.', 'warning');
      return;
    }

    try {
      const res = await fetch(`${CONFIG.apiBase || ''}/api/announcements`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password: pwd })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to delete');
      }

      State.sessionDeletePassword = pwd;
      showToast('Announcement deleted.', 'success');
      await this.fetchAll();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  },

  checkBadge() {
    if (!this.list || this.list.length === 0) return;
    const latestId = this.list[0].id;
    const lastViewedId = localStorage.getItem('last_viewed_announcement_id');
    if (!lastViewedId || parseInt(latestId) > parseInt(lastViewedId)) {
      DOM.announceBadge.style.display = 'block';
    } else {
      DOM.announceBadge.style.display = 'none';
    }
  },

  markAsRead() {
    if (!this.list || this.list.length === 0) return;
    const latestId = this.list[0].id;
    localStorage.setItem('last_viewed_announcement_id', latestId);
    DOM.announceBadge.style.display = 'none';
  },

  async publish(name, title, announcement, password, extras = {}) {
    try {
      const res = await fetch(`${CONFIG.apiBase || ''}/api/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          title,
          announcement,
          password,
          subject: extras.subject || '',
          type: extras.type || 'general',
          date_override: extras.date_override || '',
          subject_override: extras.subject_override || '',
          semester: Storage.getSemester(),
          section: Storage.getSection()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to post');
      }

      showToast('Announcement published successfully!', 'success');

      // Fire cancellation/holiday/online/exam/general notification immediately
      let notifTitle = '📢 New Announcement';
      let notifBody = `${name}: ${title}`;
      let notifType = extras.type || 'general';

      if (extras.type === 'cancellation') {
        notifTitle = '🚫 Class Cancelled';
        notifBody = `${extras.subject_override || 'A class'} on ${extras.date_override || 'upcoming'} has been cancelled: ${title}`;
      } else if (extras.type === 'holiday') {
        notifTitle = '🎉 Holiday Declared!';
        notifBody = `${extras.date_override || 'Upcoming'}: ${title} — ${announcement}`;
      } else if (extras.type === 'online_class') {
        notifTitle = '📡 Online Class Scheduled';
        notifBody = `${extras.subject_override || 'A class'} on ${extras.date_override || 'upcoming'} will be online.`;
        try {
          const parsed = JSON.parse(announcement);
          notifBody += ` Platform: ${parsed.platform || 'Online'}\nTime: ${parsed.start_time || '—'} – ${parsed.end_time || '—'}`;
        } catch (e) {}
      } else if (extras.type === 'class_test') {
        notifTitle = '📝 Class Test Scheduled';
        notifBody = `${extras.subject_override || 'A class'} on ${extras.date_override || 'upcoming'} has an exam.`;
        try {
          const parsed = JSON.parse(announcement);
          notifBody += ` Exam: ${parsed.exam_name || 'Class Test'}\nTopics: ${parsed.topics || 'Not Specified'}`;
        } catch (e) {}
      } else {
        notifTitle = `📢 ${title || 'New Announcement'}`;
        notifBody = announcement;
      }

      Notifications.showInstant(notifTitle, notifBody, notifType);
      Notifications.scheduleForToday();

      this.fetchAll();
      return true;
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
      return false;
    }
  }
};

/** Register announcements modal event listeners */
export function initAnnouncementEvents() {
  DOM.announcementsBtn.addEventListener('click', () => {
    openModal(DOM.announceModal, async () => {
      await Announcements.fetchAll();
      // forceUpdate is called by init.js at startup; here we just refresh the feed
    });
    Announcements.markAsRead();
  });
  DOM.announceModalClose.addEventListener('click', () => closeModal(DOM.announceModal));

  DOM.announceList.addEventListener('click', async e => {
    const btn = e.target.closest('.delete-announce-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    
    const needsPassword = !State.sessionDeletePassword;
    
    showConfirm(
      'Delete Announcement',
      'Are you sure you want to delete this announcement? This action cannot be undone.',
      async (pwdVal) => {
        const activePwd = State.sessionDeletePassword || pwdVal;
        await Announcements.delete(id, activePwd);
      },
      needsPassword
    );
  });
}
