import { CONFIG } from '../core/config.js';
import { State } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { Storage } from '../storage/storage.js';
import { showToast } from '../toast/toast.js';
import { escapeHtml } from '../core/utils.js';
import { showConfirm, showLoadingScreen } from '../modals/modal.js';
import { Notifications } from '../notifications/notifications.js';

export const Announcements = {
  list: [],
  activeFilter: 'all',
  isAdminMode: false,
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

    function getOrdinalSuffix(num) {
      const n = Number(num);
      if (n === 1) return `${n}st`;
      if (n === 2) return `${n}nd`;
      if (n === 3) return `${n}rd`;
      return `${n}th`;
    }

    const subEl = document.getElementById('announceSubtitle');
    if (subEl) {
      const rawSemester = Storage.getSemester();
      const formattedSemester = `${getOrdinalSuffix(rawSemester)} Semester`;
      const sectionText = `Section ${Storage.getSection().toUpperCase()}`;
      
      subEl.innerHTML = `<span class="highlight-section">${formattedSemester} - ${sectionText}</span>`;
    }

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
      if (typeof window.renderTimeline === 'function') {
        window.renderTimeline(true);
      }
      return true;
    } catch (err) {
      console.error('Error fetching announcements:', err);
      const feed = document.getElementById('announceList');
      if (feed && !this.list.length) {
        feed.innerHTML = `<div class="announce-empty">Failed to load announcements. Check your internet connection.</div>`;
      }
      return false;
    }
  },

  renderFeed() {
    const feed = document.getElementById('announceList');
    if (!feed) return;

    if (!this.list || this.list.length === 0) {
      feed.innerHTML = `<div class="announce-empty">No announcements yet for Section ${Storage.getSection().toUpperCase()}.</div>`;
      return;
    }

    const lastViewedId = parseInt(localStorage.getItem('last_viewed_announcement_id') || '0', 10);

    const typeMeta = {
      general: {
        label: 'General',
        cssClass: 'general',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
      },
      cancellation: {
        label: 'Cancelled',
        cssClass: 'cancellation',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'
      },
      holiday: {
        label: 'Holiday',
        cssClass: 'holiday',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'
      },
      online_class: {
        label: 'Online Class',
        cssClass: 'online_class',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>'
      },
      class_test: {
        label: 'Class Test',
        cssClass: 'class_test',
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
      }
    };

    // Filter list if category filter is active
    let filteredList = this.list;
    if (this.activeFilter !== 'all') {
      filteredList = this.list.filter(item => (item.type || 'general') === this.activeFilter);
    }

    if (filteredList.length === 0) {
      feed.innerHTML = `<div class="announce-empty">No announcements under this category.</div>`;
      return;
    }

    // Group items chronologically
    const groups = {};

    filteredList.forEach(item => {
      const isUnread = lastViewedId > 0 ? parseInt(item.id, 10) > lastViewedId : false;
      const createdDate = new Date(item.created_at);

      let category = 'New Announcements';
      if (!isUnread) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const itemDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
        const diffDays = Math.floor((today - itemDate) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) category = 'Today';
        else if (diffDays === 1) category = 'Yesterday';
        else if (diffDays <= 7) category = 'This Week';
        else if (diffDays <= 14) category = 'Past Week';
        else if (diffDays <= 30) category = 'Past Month';
        else category = 'Older';
      }

      if (!groups[category]) groups[category] = [];
      groups[category].push({ item, isUnread });
    });

    const categoryOrder = [
      'New Announcements',
      'Today',
      'Yesterday',
      'This Week',
      'Past Week',
      'Past Month',
      'Older'
    ];

    let html = '';

    categoryOrder.forEach(cat => {
      if (!groups[cat] || groups[cat].length === 0) return;

      html += `
        <div class="announce-group-header">
          <span>${cat}</span>
          <span class="announce-group-badge">${groups[cat].length}</span>
        </div>
      `;

      groups[cat].forEach(({ item, isUnread }) => {
        const dateObj = new Date(item.created_at);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const meta = typeMeta[item.type] || typeMeta.general;

        // Default: show raw announcement text. Special types override with restrained solid sub-card.
        let cardBodyHtml = `<div class="announce-card-body">${escapeHtml(item.announcement || '')}</div>`;

        if (item.type === 'online_class') {
          try {
            const parsed = JSON.parse(item.announcement);
            const platformStr = parsed.platform || '';
            const isUrl = platformStr.startsWith('http://') || platformStr.startsWith('https://');

            cardBodyHtml = `
              <div class="announce-subcard">
                <div class="announce-subcard-header">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>ONLINE SESSION</span>
                </div>
                <div class="announce-subcard-body">
                  <div class="announce-subcard-title">${escapeHtml(parsed.start_time || '—')} – ${escapeHtml(parsed.end_time || '—')}</div>
                  ${platformStr ? `<div class="announce-subcard-text">${escapeHtml(platformStr)}</div>` : ''}
                  ${isUrl ? `
                  <a href="${escapeHtml(platformStr)}" target="_blank" rel="noopener noreferrer" class="announce-join-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    <span>Join Class</span>
                  </a>` : ''}
                </div>
              </div>
            `;
          } catch (e) {}
        } else if (item.type === 'class_test') {
          try {
            const parsed = JSON.parse(item.announcement);
            cardBodyHtml = `
              <div class="announce-subcard">
                <div class="announce-subcard-header">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  <span>EXAM TOPICS & SYLLABUS</span>
                </div>
                <div class="announce-subcard-body">
                  <div class="announce-subcard-title">${escapeHtml(parsed.exam_name || 'Class Test')}</div>
                  <div class="announce-subcard-text">${escapeHtml(parsed.topics || 'Not Specified')}</div>
                </div>
              </div>
            `;
          } catch (e) {}
        }

        html += `
          <div class="announce-card ${isUnread ? 'unread' : ''}">
            <div class="announce-card-h">
              <div style="flex: 1; min-width: 0;">
                <div class="announce-badges-row">
                  ${isUnread ? `<span class="announce-semantic-pill general">NEW</span>` : ''}
                  <span class="announce-semantic-pill ${meta.cssClass}">
                    ${meta.icon}
                    <span>${meta.label}</span>
                  </span>
                  ${item.date_override ? `
                    <span class="announce-date-pill">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <span>${escapeHtml(item.date_override)}</span>
                    </span>
                  ` : ''}
                </div>
                <div class="announce-card-title">${escapeHtml(item.title)}</div>
                <div class="announce-author-row">
                  <span class="announce-author-name">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <span>${escapeHtml(item.name)}</span>
                  </span>
                  <span>·</span>
                  <span>${dateStr}</span>
                </div>
              </div>
              ${this.isAdminMode ? `
              <div class="announce-card-actions">
                <button type="button" class="announce-card-action-btn edit" data-id="${item.id}" title="Edit Announcement">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button type="button" class="announce-card-action-btn delete" data-id="${item.id}" title="Delete Announcement">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </button>
              </div>` : ''}
            </div>
            ${cardBodyHtml}
          </div>
        `;
      });
    });

    feed.innerHTML = html;
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
      showToast('Announcement deleted successfully.', 'success');
      showLoadingScreen('Updating Schedule...', 'Applying announcement overrides & refreshing timetable');
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  },

  checkBadge() {
    const badge = document.getElementById('announceBadge');
    const dot = document.getElementById('dockAnnounceDot');

    if (!this.list || this.list.length === 0) {
      if (badge) badge.style.display = 'none';
      if (dot) dot.style.display = 'none';
      return;
    }
    const lastViewedId = parseInt(localStorage.getItem('last_viewed_announcement_id') || '0', 10);
    const unreadCount = this.list.filter(item => parseInt(item.id, 10) > lastViewedId).length;

    if (badge) {
      if (unreadCount > 0) {
        badge.style.display = 'flex';
        badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
      } else {
        badge.style.display = 'none';
      }
    }

    if (dot) {
      dot.style.display = unreadCount > 0 ? 'block' : 'none';
    }
  },

  markAsRead() {
    if (!this.list || this.list.length === 0) return;
    const latestId = parseInt(this.list[0].id, 10);
    localStorage.setItem('last_viewed_announcement_id', latestId.toString());
    this.checkBadge();
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

      State.sessionDeletePassword = password;
      showToast('Announcement published successfully!', 'success');

      // Fire push notification / alert
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
  },

  async update(id, name, title, announcement, password, extras = {}) {
    try {
      const res = await fetch(`${CONFIG.apiBase || ''}/api/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          isUpdate: true,
          action: 'update',
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
        throw new Error(errData.error || 'Failed to update announcement');
      }

      State.sessionDeletePassword = password;
      showToast('Announcement updated successfully!', 'success');
      showLoadingScreen('Updating Schedule...', 'Applying edited announcement overrides & refreshing timetable');
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

/** Register announcements full-page event listeners */
export function initAnnouncementEvents() {
  window.__fetchAndRenderAnnouncements = () => {
    Announcements.fetchAll();
  };

  window.__markAnnouncementsAsRead = () => {
    Announcements.markAsRead();
  };

  // Back button: return to Home
  const backBtn = document.getElementById('announcePageBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.switchAppView) window.switchAppView('home');
    });
  }

  // "+ Post Notice" button: open full-page post form
  const newPostBtn = document.getElementById('newAnnounceBtn');
  if (newPostBtn) {
    newPostBtn.addEventListener('click', () => {
      if (window.switchAppView) window.switchAppView('post_announcement');
    });
  }

  // Admin Mode Unlock / Toggle Button
  const adminBtn = document.getElementById('adminNoticeModeBtn');
  const adminLabel = document.getElementById('adminNoticeModeLabel');

  const updateAdminBtnUI = () => {
    if (!adminBtn) return;
    if (Announcements.isAdminMode) {
      adminBtn.classList.add('active');
      if (adminLabel) adminLabel.textContent = 'Done';
      adminBtn.title = 'Exit Admin Edit Mode';
    } else {
      adminBtn.classList.remove('active');
      if (adminLabel) adminLabel.textContent = 'Edit';
      adminBtn.title = 'Unlock Admin Edit Mode';
    }
  };

  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      // If currently active, toggle off admin mode
      if (Announcements.isAdminMode) {
        Announcements.isAdminMode = false;
        updateAdminBtnUI();
        Announcements.renderFeed();
        showToast('Admin edit mode locked.', 'info');
        return;
      }

      // If password already stored in session
      if (State.sessionDeletePassword) {
        Announcements.isAdminMode = true;
        updateAdminBtnUI();
        Announcements.renderFeed();
        showToast('Admin edit mode unlocked.', 'success');
        return;
      }

      // Prompt for password using showConfirm modal
      showConfirm(
        'Admin Unlock',
        'Enter admin password to unlock editing and deletion options on all notices:',
        async (pwdVal) => {
          if (!pwdVal) {
            showToast('Password is required.', 'warning');
            return;
          }
          try {
            const res = await fetch(`${CONFIG.apiBase || ''}/api/announcements`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                password: pwdVal,
                checkPasswordOnly: true
              })
            });

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || 'Invalid admin password');
            }

            State.sessionDeletePassword = pwdVal;
            Announcements.isAdminMode = true;
            updateAdminBtnUI();
            Announcements.renderFeed();
            showToast('Admin edit mode unlocked!', 'success');
          } catch (err) {
            showToast(err.message || 'Invalid admin password.', 'error');
          }
        },
        true // show password input
      );
    });
  }

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

  // Feed Click Delegation for Edit & Delete
  const feed = document.getElementById('announceList');
  if (feed) {
    feed.addEventListener('click', async e => {
      // 1. Edit Action
      const editBtn = e.target.closest('.announce-card-action-btn.edit');
      if (editBtn) {
        const id = editBtn.getAttribute('data-id');
        const announcement = Announcements.list.find(a => String(a.id) === String(id));
        if (announcement) {
          if (window.switchAppView) {
            window.switchAppView('post_announcement', announcement);
          }
        }
        return;
      }

      // 2. Delete Action
      const deleteBtn = e.target.closest('.announce-card-action-btn.delete');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-id');
        if (!id) return;

        const needsPassword = !State.sessionDeletePassword;

        showConfirm(
          'Delete Announcement',
          'Are you sure you want to delete this announcement? This will remove any associated schedule overrides.',
          async (pwdVal) => {
            const activePwd = State.sessionDeletePassword || pwdVal;
            await Announcements.delete(id, activePwd);
          },
          needsPassword
        );
      }
    });
  }
}

