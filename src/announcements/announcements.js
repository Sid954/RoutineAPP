import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { escapeHtml } from '../core/utils.js';
import { NotificationLog } from '../notifications/notification-log.js';
import { openModal, closeModal, showConfirm, showLoadingScreen } from '../modals/modal.js';
import { Notifications } from '../notifications/notifications.js';

export const Announcements = {
  list: [],
  activeFilter: 'all',
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
          return true;
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

      // Persist filtered list to localStorage
      try { localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.list)); } catch (e) {}

      // Trigger notifications for new announcements
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
      return true;
    } catch (err) {
      console.error('Error fetching announcements:', err);
      if (!this.list.length) {
        DOM.announceList.innerHTML = `<div class="announce-empty">Failed to load announcements. Check your connection.</div>`;
      }
      return false;
    }
  },

  renderFeed() {
    if (!this.list || this.list.length === 0) {
      DOM.announceList.innerHTML = `<div class="announce-empty">No announcements yet for Section ${Storage.getSection().toUpperCase()}.</div>`;
      return;
    }

    const lastViewedId = parseInt(localStorage.getItem('last_viewed_announcement_id') || '0', 10);

    const typeMeta = {
      general:      { label: '📢 General',    color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
      cancellation: { label: '🚫 Cancelled',  color: '#f43f5e', bg: 'rgba(244,63,94,0.15)'  },
      holiday:      { label: '🎉 Holiday',    color: '#fb923c', bg: 'rgba(251,146,60,0.15)'  },
      online_class: { label: '📡 Online',     color: '#10b981', bg: 'rgba(16,185,129,0.15)'  },
      class_test:   { label: '📝 Class Test', color: '#f97316', bg: 'rgba(249,115,22,0.18)'  },
    };

    // Filter list if category filter is active
    let filteredList = this.list;
    if (this.activeFilter !== 'all') {
      filteredList = this.list.filter(item => (item.type || 'general') === this.activeFilter);
    }

    if (filteredList.length === 0) {
      DOM.announceList.innerHTML = `<div class="announce-empty">No announcements under this category.</div>`;
      return;
    }

    // Group items into categories
    const groups = {};

    filteredList.forEach(item => {
      const isUnread = lastViewedId > 0 ? parseInt(item.id, 10) > lastViewedId : false;
      const createdDate = new Date(item.created_at);

      let category = '🆕 New Announcements';
      if (!isUnread) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const itemDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
        const diffDays = Math.floor((today - itemDate) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) category = '📅 Today';
        else if (diffDays === 1) category = '⏮️ Yesterday';
        else if (diffDays <= 7) category = '🗓️ This Week';
        else if (diffDays <= 14) category = '🗓️ Past Week';
        else if (diffDays <= 30) category = '📁 Past Month';
        else category = '📦 Older';
      }

      if (!groups[category]) groups[category] = [];
      groups[category].push({ item, isUnread });
    });

    const categoryOrder = [
      '🆕 New Announcements',
      '📅 Today',
      '⏮️ Yesterday',
      '🗓️ This Week',
      '🗓️ Past Week',
      '📁 Past Month',
      '📦 Older'
    ];

    let html = '';

    categoryOrder.forEach(cat => {
      if (!groups[cat] || groups[cat].length === 0) return;

      const isNewGroup = cat === '🆕 New Announcements';
      const headerColor = isNewGroup ? 'var(--pink)' : 'var(--accent2)';

      html += `
        <div class="announce-group-header" style="margin-top: 16px; margin-bottom: 8px; font-size: 11px; font-weight: 800; color: ${headerColor}; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
          <span>${cat}</span>
          <span style="font-size: 9.5px; background: rgba(255,255,255,0.06); padding: 2px 7px; border-radius: 99px; color: var(--dim);">${groups[cat].length}</span>
        </div>
      `;

      groups[cat].forEach(({ item, isUnread }) => {
        const dateObj = new Date(item.created_at);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' + dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const meta = typeMeta[item.type] || typeMeta.general;
        
        let cardBodyHtml = `<div class="announce-card-body" style="font-size: 12.5px; line-height: 1.5; color: var(--text); white-space: pre-wrap; margin-top: 6px;">${escapeHtml(item.announcement)}</div>`;

        if (item.type === 'online_class') {
          try {
            const parsed = JSON.parse(item.announcement);
            const platformStr = parsed.platform || '';
            const isUrl = platformStr.startsWith('http://') || platformStr.startsWith('https://');

            cardBodyHtml = `
              <div style="margin-top: 8px; background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.3); border-radius: var(--rx); padding: 10px 12px;">
                <div style="font-size: 12px; font-weight: 700; color: #34d399; margin-bottom: 4px;">🕒 ${parsed.start_time || '—'} – ${parsed.end_time || '—'}</div>
                ${platformStr ? `<div style="font-size: 11.5px; color: var(--dim); word-break: break-all;">📡 ${escapeHtml(platformStr)}</div>` : ''}
                ${isUrl ? `
                <a href="${platformStr}" target="_blank" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; padding: 6px 14px; border-radius: var(--rx); background: #10b981; color: #000; font-weight: 800; font-size: 11.5px; text-decoration: none; box-shadow: 0 2px 10px rgba(16,185,129,0.3);">
                  🚀 Join Online Class
                </a>` : ''}
              </div>
            `;
          } catch (e) {}
        } else if (item.type === 'class_test') {
          try {
            const parsed = JSON.parse(item.announcement);
            cardBodyHtml = `
              <div style="margin-top: 8px; background: rgba(249, 115, 22, 0.06); border: 1px dashed rgba(249, 115, 22, 0.35); border-radius: var(--rx); padding: 10px 12px;">
                <div style="font-size: 12.5px; font-weight: 800; color: #fb923c; margin-bottom: 4px;">📝 ${escapeHtml(parsed.exam_name || 'Class Test')}</div>
                <div style="font-size: 11.5px; color: var(--text); line-height: 1.4; white-space: pre-wrap;">📚 Syllabus: ${escapeHtml(parsed.topics || 'Not Specified')}</div>
              </div>
            `;
          } catch (e) {}
        }

        html += `
          <div class="announce-card" style="border-left: 3.5px solid ${isUnread ? 'var(--pink)' : meta.color}; ${isUnread ? 'background: rgba(244, 63, 94, 0.06); box-shadow: 0 0 16px rgba(244,63,94,0.15);' : ''}">
            <div class="announce-card-h" style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; flex-wrap:wrap;">
                  ${isUnread ? `<span style="font-size:9.5px; font-weight:800; padding:2px 7px; border-radius:99px; background:var(--pink); color:#fff; white-space:nowrap;">NEW</span>` : ''}
                  <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:99px; background:${meta.bg}; color:${meta.color}; white-space:nowrap;">${meta.label}</span>
                  ${item.date_override ? `<span style="font-size:10px; color:var(--dim); font-weight:600;">📅 ${item.date_override}</span>` : ''}
                </div>
                <div class="announce-card-title" style="font-size: 14.5px; font-weight: 800; color: var(--text); letter-spacing: -0.2px;">${escapeHtml(item.title)}</div>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
                  <span style="font-size: 11px; font-weight: 700; color: var(--accent2);">👤 ${escapeHtml(item.name)}</span>
                  <span style="font-size: 10px; color: var(--dim);">• ${dateStr}</span>
                </div>
              </div>
              <button class="delete-announce-btn" data-id="${item.id}" style="background: none; border: none; color: var(--pink); font-size: 14px; cursor: pointer; padding: 4px 8px; opacity: 0.6; transition: opacity 0.2s;" title="Delete Announcement">✕</button>
            </div>
            ${cardBodyHtml}
          </div>
        `;
      });
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
      showLoadingScreen('Updating Schedule...', 'Applying announcement overrides & refreshing timetable');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  },

  checkBadge() {
    if (!this.list || this.list.length === 0) {
      if (DOM.announceBadge) DOM.announceBadge.style.display = 'none';
      return;
    }
    const lastViewedId = parseInt(localStorage.getItem('last_viewed_announcement_id') || '0', 10);
    const unreadCount = this.list.filter(item => parseInt(item.id, 10) > lastViewedId).length;

    if (DOM.announceBadge) {
      if (unreadCount > 0) {
        DOM.announceBadge.style.display = 'flex';
        DOM.announceBadge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
      } else {
        DOM.announceBadge.style.display = 'none';
      }
    }
  },

  markAsRead() {
    if (!this.list || this.list.length === 0) return;
    const latestId = parseInt(this.list[0].id, 10);
    localStorage.setItem('last_viewed_announcement_id', latestId.toString());
    if (DOM.announceBadge) DOM.announceBadge.style.display = 'none';
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

      showLoadingScreen('Updating Schedule...', 'Applying new announcement overrides & refreshing timetable');
      setTimeout(() => {
        window.location.reload();
      }, 500);
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
    });
    Announcements.markAsRead();
  });
  DOM.announceModalClose.addEventListener('click', () => {
    closeModal(DOM.announceModal);
    Announcements.markAsRead();
  });

  // Filter Bar Pills Binding
  const filterBar = document.getElementById('announceFilterBar');
  if (filterBar) {
    filterBar.addEventListener('click', e => {
      const btn = e.target.closest('.announce-filter-pill');
      if (!btn) return;
      filterBar.querySelectorAll('.announce-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Announcements.activeFilter = btn.dataset.filter || 'all';
      Announcements.renderFeed();
    });
  }

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
