import { CONFIG } from "../core/config.js";
import { State } from "../core/state.js";
import { Storage } from "../storage/storage.js";
import { showToast } from "../toast/toast.js";
import { escapeHtml } from "../core/utils.js";
import { showConfirm } from "../modals/modal.js";
import { Notifications } from "../notifications/notifications.js";
import { formatAnnouncementTitle } from "./validation.js";

export const Announcements = {
  list: [],
  activeFilter: "all",
  isAdminMode: false,
  CACHE_KEY: "routine_announcements_cache",
  PINNED_KEY: "routine_pinned_announcements",
  READ_KEY: "routine_read_announcements",
  _observer: null,
  _intersectionTimers: null,

  getPinnedIds() {
    try {
      const saved = localStorage.getItem(this.PINNED_KEY);
      return new Set(saved ? JSON.parse(saved).map(String) : []);
    } catch (e) {
      return new Set();
    }
  },

  savePinnedIds(set) {
    try {
      localStorage.setItem(this.PINNED_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {}
  },

  getReadIds() {
    try {
      const saved = localStorage.getItem(this.READ_KEY);
      if (saved) {
        return new Set(JSON.parse(saved).map(String));
      }
      const legacyLastViewed = localStorage.getItem("last_viewed_announcement_id");
      if (legacyLastViewed) {
        const legacyId = parseInt(legacyLastViewed, 10);
        const readSet = new Set();
        (this.list || []).forEach((item) => {
          if (parseInt(item.id, 10) <= legacyId) {
            readSet.add(String(item.id));
          }
        });
        this.saveReadIds(readSet);
        return readSet;
      }
    } catch (e) {}
    return new Set();
  },

  saveReadIds(set) {
    try {
      localStorage.setItem(this.READ_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {}
  },

  ensureReadStateInitialized() {
    const hasReadStorage = localStorage.getItem(this.READ_KEY) !== null;
    const hasLegacyStorage = localStorage.getItem("last_viewed_announcement_id") !== null;

    if (!hasReadStorage && !hasLegacyStorage && this.list && this.list.length > 0) {
      const initialRead = new Set(this.list.map((item) => String(item.id)));
      this.saveReadIds(initialRead);
    }
  },

  markItemAsRead(id) {
    const readSet = this.getReadIds();
    const idStr = String(id);
    if (!readSet.has(idStr)) {
      readSet.add(idStr);
      this.saveReadIds(readSet);
      this.checkBadge();
    }
  },

  loadCached() {
    try {
      const saved = localStorage.getItem(this.CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const pinnedSet = this.getPinnedIds();
          this.list = parsed.map((item) => {
            if (pinnedSet.has(String(item.id))) item.is_pinned = true;
            return item;
          });
          State.announcementsList = this.list;
          this.ensureReadStateInitialized();
          this.renderFeed();
          this.checkBadge();
          return true;
        }
      }
    } catch (e) {
      console.warn("Could not load cached announcements:", e);
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

      const res = await fetch(`${CONFIG.apiBase || ""}/api/announcements`);
      if (!res.ok) throw new Error("Failed to fetch");
      const rawList = await res.json();

      const currentSem = (Storage.getSemester() || "").toString().toLowerCase();
      const currentSec = (Storage.getSection() || "").toString().toLowerCase();

      // Filter announcements and sync persistent pinned state
      const localPinned = this.getPinnedIds();
      this.list = rawList.filter((item) => {
        const semMatch =
          !item.semester ||
          item.semester.toString().toLowerCase() === currentSem;
        const secMatch =
          !item.section || item.section.toString().toLowerCase() === currentSec;
        return semMatch && secMatch;
      }).map((item) => {
        const isServerPinned = item.is_pinned === true || item.is_pinned === "true" || item.is_pinned === 1;
        if (isServerPinned) {
          localPinned.add(String(item.id));
          item.is_pinned = true;
        } else if (localPinned.has(String(item.id))) {
          item.is_pinned = true;
        } else {
          item.is_pinned = false;
        }
        return item;
      });
      this.savePinnedIds(localPinned);
      State.announcementsList = this.list;

      function getOrdinalSuffix(num) {
        const n = Number(num);
        if (n === 1) return `${n}st`;
        if (n === 2) return `${n}nd`;
        if (n === 3) return `${n}rd`;
        return `${n}th`;
      }

      const subEl = document.getElementById("announceSubtitle");
      if (subEl) {
        const rawSemester = Storage.getSemester();
        const formattedSemester = `${getOrdinalSuffix(rawSemester)} Semester`;
        const sectionText = `Section ${Storage.getSection().toUpperCase()}`;

        subEl.innerHTML = `<span class="highlight-section">${formattedSemester} - ${sectionText}</span>`;
      }

      // Persist filtered list to localStorage
      try {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.list));
      } catch (e) {}

      // Trigger notifications for new announcements
      if (cachedList.length > 0) {
        const newAnnouncements = this.list.filter(
          (item) => !cachedList.some((c) => c.id === item.id),
        );
        newAnnouncements.forEach((announce) => {
          let bodyText = announce.announcement;
          if (announce.type === "class_test") {
            try {
              const parsed = JSON.parse(announce.announcement);
              bodyText = `Exam: ${parsed.exam_name || "Class Test"}\nTopics: ${parsed.topics || "Not Specified"}`;
            } catch (e) {}
          } else if (announce.type === "online_class") {
            try {
              const parsed = JSON.parse(announce.announcement);
              bodyText = `Platform: ${parsed.platform || "Online"}\nTime: ${parsed.start_time || "—"} – ${parsed.end_time || "—"}`;
            } catch (e) {}
          }
          Notifications.showInstant(announce.title, bodyText, announce.type);
        });
      }

      this.ensureReadStateInitialized();
      this.renderFeed();
      this.checkBadge();
      if (typeof window.renderTimeline === "function") {
        window.renderTimeline(true);
      }
      return true;
    } catch (err) {
      console.error("Error fetching announcements:", err);
      const feed = document.getElementById("announceList");
      if (feed && !this.list.length) {
        feed.innerHTML = `<div class="announce-empty">Failed to load announcements. Check your internet connection.</div>`;
      }
      return false;
    }
  },

  renderFeed() {
    const feed = document.getElementById("announceList");
    if (!feed) return;

    if (!this.list || this.list.length === 0) {
      feed.innerHTML = `<div class="announce-empty">No announcements yet for Section ${Storage.getSection().toUpperCase()}.</div>`;
      return;
    }

    const readSet = this.getReadIds();

    const typeMeta = {
      general: {
        label: "General",
        cssClass: "general",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
      },
      cancellation: {
        label: "Cancelled",
        cssClass: "cancellation",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
      },
      holiday: {
        label: "Holiday",
        cssClass: "holiday",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      },
      online_class: {
        label: "Online Class",
        cssClass: "online_class",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="2"/><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"/></svg>',
      },
      class_test: {
        label: "Class Test",
        cssClass: "class_test",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      },
      rescheduled: {
        label: "Rescheduled",
        cssClass: "rescheduled",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      },
      assignment: {
        label: "Assignment",
        cssClass: "assignment",
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
      },
    };

    function relativeTime(dateObj) {
      const diffMs = Date.now() - dateObj.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return "Just now";
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      return (
        dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
        " · " +
        dateObj.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      );
    }

    // Filter list if category filter is active
    let filteredList = this.list;
    if (this.activeFilter !== "all") {
      filteredList = this.list.filter(
        (item) => (item.type || "general") === this.activeFilter,
      );
    }

    if (filteredList.length === 0) {
      feed.innerHTML = `<div class="announce-empty">No announcements under this category.</div>`;
      return;
    }

    // Sort: pinned items float to top, then by created_at descending
    const pinned = filteredList.filter((i) => i.is_pinned === true || i.is_pinned === "true" || i.is_pinned === 1);
    const unpinned = filteredList.filter((i) => !(i.is_pinned === true || i.is_pinned === "true" || i.is_pinned === 1));

    // Group unpinned items chronologically
    const groups = {};

    unpinned.forEach((item) => {
      const isUnread = !readSet.has(String(item.id));
      const createdDate = new Date(item.created_at);

      let category = "New Announcements";
      if (!isUnread) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const itemDate = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
        const diffDays = Math.floor((today - itemDate) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) category = "Today";
        else if (diffDays === 1) category = "Yesterday";
        else if (diffDays <= 7) category = "This Week";
        else if (diffDays <= 14) category = "Past Week";
        else if (diffDays <= 30) category = "Past Month";
        else category = "Older";
      }

      if (!groups[category]) groups[category] = [];
      groups[category].push({ item, isUnread });
    });

    const categoryOrder = [
      "New Announcements",
      "Today",
      "Yesterday",
      "This Week",
      "Past Week",
      "Past Month",
      "Older",
    ];

    function buildCardHtml(item, isUnread) {
      const meta = typeMeta[item.type] || typeMeta.general;
      const rawContent = item.announcement || "";
      const dateObj = new Date(item.created_at);
      const timeStr = relativeTime(dateObj);

      const isEdited =
        item.updated_at &&
        Math.abs(new Date(item.updated_at) - dateObj) > 60000;

      const isPinned = item.is_pinned === true || item.is_pinned === "true" || item.is_pinned === 1;

      let badgeLabel = meta.label;
      let badgeCss = meta.cssClass;
      let badgeIcon = meta.icon;

      let cardBodyHtml = "";

      if (item.type === "online_class") {
        let parsed = {};
        try { parsed = JSON.parse(rawContent); } catch (e) { parsed = { platform: rawContent }; }
        const isOnline = (parsed.is_online === false || /extra class/i.test(item.title || '')) 
          ? false 
          : (parsed.is_online !== undefined ? Boolean(parsed.is_online) : true);
        if (!isOnline) {
          badgeLabel = "EXTRA CLASS";
          badgeCss = "extra";
          badgeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
        }
        const startTime = (parsed.start_time || "").trim();
        const endTime = (parsed.end_time || "").trim();

        let timeTitle = isOnline ? "Online Session" : "In-Person Class";
        if (startTime && endTime && startTime !== endTime && endTime !== "—") {
          timeTitle = `${startTime} – ${endTime}`;
        } else if (startTime) {
          timeTitle = `Starts at ${startTime}`;
        }

        if (isOnline) {
          const platformStr = (parsed.platform || "").trim();
          const isUrl = /^https?:\/\//i.test(platformStr);

          let linkOrTextHtml = "";
          if (isUrl) {
            linkOrTextHtml = `
              <a href="${escapeHtml(platformStr)}" target="_blank" rel="noopener noreferrer" class="announce-join-btn">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                <span>Join Class</span>
              </a>
            `;
          } else if (platformStr) {
            linkOrTextHtml = `
              <div class="announce-subcard-scroll-wrap">
                <div class="announce-subcard-text">${escapeHtml(platformStr)}</div>
                <div class="announce-subcard-fade"></div>
              </div>
            `;
          } else {
            linkOrTextHtml = `<div class="announce-subcard-text" style="color: var(--text-muted, #94A3B8); font-style: italic;">Check class group for link</div>`;
          }

          cardBodyHtml = `
            <div class="announce-subcard">
              <div class="announce-subcard-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span>ONLINE SESSION</span>
              </div>
              <div class="announce-subcard-body">
                <div class="announce-subcard-title">${escapeHtml(timeTitle)}</div>
                ${linkOrTextHtml}
              </div>
            </div>
          `;
        } else {
          const roomStr = (parsed.room || "").trim();
          cardBodyHtml = `
            <div class="announce-subcard">
              <div class="announce-subcard-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span>IN-PERSON EXTRA CLASS</span>
              </div>
              <div class="announce-subcard-body">
                <div class="announce-subcard-title">${escapeHtml(timeTitle)}</div>
                ${roomStr ? `<div class="announce-subcard-text" style="margin-top: 4px; font-weight: 600; color: var(--text-main, #F8FAFC);">Room: ${escapeHtml(roomStr)}</div>` : ""}
              </div>
            </div>
          `;
        }
      } else if (item.type === "class_test") {
        let parsed = {};
        try { parsed = JSON.parse(rawContent); } catch (e) { parsed = { exam_name: "Class Test", topics: rawContent }; }
        cardBodyHtml = `
          <div class="announce-subcard">
            <div class="announce-subcard-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>EXAM TOPICS &amp; SYLLABUS</span>
            </div>
            <div class="announce-subcard-body">
              <div class="announce-subcard-title">${escapeHtml(parsed.exam_name || "Class Test")}</div>
              <div class="announce-subcard-scroll-wrap">
                <div class="announce-subcard-text">${escapeHtml(parsed.topics || "Not Specified")}</div>
                <div class="announce-subcard-fade"></div>
              </div>
            </div>
          </div>
        `;
      } else if (item.type === "cancellation") {
        cardBodyHtml = `
          <div class="announce-subcard">
            <div class="announce-subcard-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              <span>CANCELLATION REASON</span>
            </div>
            <div class="announce-subcard-body">
              ${item.subject_override ? `<div class="announce-subcard-title">${escapeHtml(item.subject_override)} Class Cancelled</div>` : ""}
              <div class="announce-subcard-scroll-wrap">
                <div class="announce-subcard-text">${escapeHtml(rawContent || "Scheduled session has been cancelled.")}</div>
                <div class="announce-subcard-fade"></div>
              </div>
            </div>
          </div>
        `;
      } else if (item.type === "holiday") {
        cardBodyHtml = `
          <div class="announce-subcard">
            <div class="announce-subcard-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              <span>HOLIDAY DETAILS</span>
            </div>
            <div class="announce-subcard-body">
              ${item.date_override ? `<div class="announce-subcard-title">${escapeHtml(item.date_override)}</div>` : ""}
              <div class="announce-subcard-scroll-wrap">
                <div class="announce-subcard-text">${escapeHtml(rawContent || "University holiday declared.")}</div>
                <div class="announce-subcard-fade"></div>
              </div>
            </div>
          </div>
        `;
      } else if (item.type === "rescheduled") {
        let parsed = {};
        try { parsed = JSON.parse(rawContent); } catch (e) {}
        const newStart = parsed.new_start_time || "";
        const origStart = parsed.original_start_time || "";
        const origDate = parsed.original_date || item.date_override || "";
        const newDate = parsed.new_date || origDate;
        const newRoom = parsed.new_room || "";
        const reason = parsed.reason || "";

        let origSlotLabel = '';
        if (origDate) {
          const [oy, om, od] = origDate.split('-').map(Number);
          if (oy && om && od) {
            const dObj = new Date(oy, om - 1, od);
            const dNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            origSlotLabel = `${dNames[dObj.getDay()]}, ${mNames[dObj.getMonth()]} ${od}${origStart ? ` at ${origStart}` : ''}`;
          }
        }

        let newSlotLabel = newStart ? `Starts at ${newStart}` : 'New Slot';
        if (newDate && newDate !== origDate) {
          const [ny, nm, nd] = newDate.split('-').map(Number);
          if (ny && nm && nd) {
            const dObj = new Date(ny, nm - 1, nd);
            const dNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            newSlotLabel = `${dNames[dObj.getDay()]}, ${mNames[dObj.getMonth()]} ${nd} at ${newStart}`;
          }
        }

        let timingTitle = newSlotLabel;
        if (newRoom) timingTitle += ` · Room ${newRoom}`;

        cardBodyHtml = `
          <div class="announce-subcard">
            <div class="announce-subcard-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>RESCHEDULED CLASS</span>
            </div>
            <div class="announce-subcard-body">
              <div class="announce-subcard-title">${escapeHtml(timingTitle)}</div>
              ${origSlotLabel ? `<div class="announce-subcard-text" style="color: var(--text-muted); font-size: 11.5px; margin-top: 2px;">Moved from: ${escapeHtml(origSlotLabel)}</div>` : ''}
              ${reason ? `
                <div class="announce-subcard-scroll-wrap" style="margin-top: 4px;">
                  <div class="announce-subcard-text">${escapeHtml(reason)}</div>
                  <div class="announce-subcard-fade"></div>
                </div>` : ""}
            </div>
          </div>
        `;
      } else if (item.type === "assignment") {
        let parsed = {};
        try { parsed = JSON.parse(rawContent); } catch (e) {}
        const taskTitle = parsed.task_title || "Assignment";
        const dueTime = parsed.due_time || "";
        const desc = parsed.description || "";
        const dueTitle = dueTime ? `Due at ${dueTime}` : "Assignment Deadline";

        cardBodyHtml = `
          <div class="announce-subcard">
            <div class="announce-subcard-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              <span>ASSIGNMENT DETAILS</span>
            </div>
            <div class="announce-subcard-body">
              <div class="announce-subcard-title">${escapeHtml(taskTitle)} &bull; ${escapeHtml(dueTitle)}</div>
              ${desc ? `
                <div class="announce-subcard-scroll-wrap">
                  <div class="announce-subcard-text">${escapeHtml(desc)}</div>
                  <div class="announce-subcard-fade"></div>
                </div>` : ""}
            </div>
          </div>
        `;
      } else {
        cardBodyHtml = `
          <div class="announce-subcard">
            <div class="announce-subcard-header">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <span>ANNOUNCEMENT DETAILS</span>
            </div>
            <div class="announce-subcard-body">
              ${item.subject_override ? `<div class="announce-subcard-title">${escapeHtml(item.subject_override)}</div>` : ""}
              <div class="announce-subcard-scroll-wrap">
                <div class="announce-subcard-text">${escapeHtml(rawContent || "No additional details provided.")}</div>
                <div class="announce-subcard-fade"></div>
              </div>
            </div>
          </div>
        `;
      }

      const adminActionsHtml = this.isAdminMode ? `
        <div class="announce-card-actions">
          <button type="button" class="announce-card-action-btn pin ${isPinned ? "pinned" : ""}" data-id="${item.id}" title="${isPinned ? "Unpin" : "Pin"} Announcement">
            <svg viewBox="0 0 24 24" fill="${isPinned ? "currentColor" : "none"}" stroke="currentColor"><line x1="12" y1="17" x2="12" y2="22"/><path d="M18 17H6l2-6V4H7V2h10v2h-1v7l2 6z"/></svg>
          </button>
          <button type="button" class="announce-card-action-btn edit" data-id="${item.id}" title="Edit Announcement">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button type="button" class="announce-card-action-btn delete" data-id="${item.id}" title="Delete Announcement">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>` : "";

      return `
        <div class="announce-card ${isUnread ? "unread" : ""} ${isPinned ? "pinned" : ""}" data-id="${item.id}">
          <div class="announce-card-h">
            <div style="flex: 1; min-width: 0;">
              <div class="announce-badges-row">
                ${isPinned ? `<span class="announce-pin-badge"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none" width="10" height="10"><path d="M18 17H6l2-6V4H7V2h10v2h-1v7l2 6z"/><line x1="12" y1="17" x2="12" y2="22" stroke="currentColor" stroke-width="2"/></svg>PINNED</span>` : ""}
                ${isUnread ? `<span class="announce-semantic-pill general">NEW</span>` : ""}
                <span class="announce-semantic-pill ${badgeCss}">
                  ${badgeIcon}
                  <span>${badgeLabel}</span>
                </span>
                ${item.date_override ? `
                  <span class="announce-date-pill">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span>${escapeHtml(item.date_override)}</span>
                  </span>` : ""}
              </div>
              <div class="announce-card-title">${escapeHtml(formatAnnouncementTitle(item))}</div>
            </div>
            ${adminActionsHtml}
          </div>
          ${cardBodyHtml}
          <div class="announce-author-row">
            <span class="announce-author-name">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              <span>${escapeHtml(item.name)}</span>
            </span>
            <span>·</span>
            <span>${timeStr}</span>
            ${isEdited ? `<span class="announce-edited-badge">(edited)</span>` : ""}
          </div>
        </div>
      `;
    }

    let html = "";

    // Render pinned group first
    if (pinned.length > 0) {
      html += `
        <div class="announce-group-header">
          <span>📌 Pinned</span>
          <span class="announce-group-badge">${pinned.length}</span>
        </div>
      `;
      pinned.forEach((item) => {
        const isUnread = !readSet.has(String(item.id));
        html += buildCardHtml.call(this, item, isUnread);
      });
    }

    // Render chronological groups
    categoryOrder.forEach((cat) => {
      if (!groups[cat] || groups[cat].length === 0) return;

      html += `
        <div class="announce-group-header">
          <span>${cat}</span>
          <span class="announce-group-badge">${groups[cat].length}</span>
        </div>
      `;

      groups[cat].forEach(({ item, isUnread }) => {
        html += buildCardHtml.call(this, item, isUnread);
      });
    });

    feed.innerHTML = html;

    // Attach fade overlay listeners to all subcard scroll wrappers
    feed.querySelectorAll(".announce-subcard-scroll-wrap").forEach((wrap) => {
      const textEl = wrap.querySelector(".announce-subcard-text");
      const fade = wrap.querySelector(".announce-subcard-fade");
      if (!textEl || !fade) return;

      const update = () => {
        const hasOverflow = textEl.scrollHeight > textEl.clientHeight + 2;
        const atBottom = textEl.scrollHeight - textEl.scrollTop - textEl.clientHeight < 4;
        fade.style.opacity = (hasOverflow && !atBottom) ? "1" : "0";
      };

      update();
      requestAnimationFrame(update);
      textEl.addEventListener("scroll", update, { passive: true });
    });

    // Clean up existing observer & timers
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    if (this._intersectionTimers) {
      this._intersectionTimers.forEach((t) => clearTimeout(t));
      this._intersectionTimers.clear();
    } else {
      this._intersectionTimers = new Map();
    }

    // Attach IntersectionObserver to unread cards
    const unreadCards = feed.querySelectorAll(".announce-card.unread");
    if (unreadCards.length > 0 && "IntersectionObserver" in window) {
      this._observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const cardEl = entry.target;
            const id = cardEl.getAttribute("data-id");
            if (!id) return;

            if (entry.isIntersecting) {
              if (!this._intersectionTimers.has(id)) {
                const timer = setTimeout(() => {
                  this.markItemAsRead(id);
                  if (this._observer) {
                    this._observer.unobserve(cardEl);
                  }
                  this._intersectionTimers.delete(id);
                }, 600);
                this._intersectionTimers.set(id, timer);
              }
            } else {
              if (this._intersectionTimers.has(id)) {
                clearTimeout(this._intersectionTimers.get(id));
                this._intersectionTimers.delete(id);
              }
            }
          });
        },
        { threshold: 0.5 },
      );

      unreadCards.forEach((card) => this._observer.observe(card));
    }
  },

  async delete(id, pwd) {
    if (!pwd) {
      showToast("Password is required.", "warning");
      return;
    }

    try {
      const res = await fetch(`${CONFIG.apiBase || ""}/api/announcements`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: pwd }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to delete");
      }

      State.sessionDeletePassword = pwd;
      this.list = this.list.filter((a) => String(a.id) !== String(id));
      State.announcementsList = this.list;
      try {
        localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.list));
      } catch (e) {}
      this.renderFeed();
      this.checkBadge();
      if (typeof window.renderTimeline === "function") {
        window.renderTimeline(true);
      }
      showToast("Announcement deleted.", "success");
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
    }
  },

  checkBadge() {
    const badge = document.getElementById("announceBadge");
    const dot = document.getElementById("dockAnnounceDot");

    if (!this.list || this.list.length === 0) {
      if (badge) badge.style.display = "none";
      if (dot) dot.style.display = "none";
      return;
    }

    const readSet = this.getReadIds();
    const unreadCount = this.list.filter(
      (item) => !readSet.has(String(item.id)),
    ).length;

    if (badge) {
      if (unreadCount > 0) {
        badge.style.display = "flex";
        badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
      } else {
        badge.style.display = "none";
      }
    }

    if (dot) {
      dot.style.display = unreadCount > 0 ? "block" : "none";
    }
  },

  markAsRead() {
    // Deprecated: read state is now handled per-item via IntersectionObserver
  },

  async publish(name, title, announcement, password, extras = {}) {
    try {
      const res = await fetch(`${CONFIG.apiBase || ""}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title,
          announcement,
          password,
          subject: extras.subject || "",
          type: extras.type || "general",
          date_override: extras.date_override || "",
          subject_override: extras.subject_override || "",
          semester: Storage.getSemester(),
          section: Storage.getSection(),
          is_pinned: extras.is_pinned === true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to post");
      }

      State.sessionDeletePassword = password;
      showToast("Announcement published successfully!", "success");

      // Fire push notification / alert
      let notifTitle = "📢 New Announcement";
      let notifBody = `${name}: ${title}`;
      let notifType = extras.type || "general";

      if (extras.type === "cancellation") {
        notifTitle = "🚫 Class Cancelled";
        notifBody = `${extras.subject_override || "A class"} on ${extras.date_override || "upcoming"} has been cancelled: ${title}`;
      } else if (extras.type === "holiday") {
        notifTitle = "🎉 Holiday Declared!";
        notifBody = `${extras.date_override || "Upcoming"}: ${title} — ${announcement}`;
      } else if (extras.type === "online_class") {
        notifTitle = "📡 Online Class Scheduled";
        notifBody = `${extras.subject_override || "A class"} on ${extras.date_override || "upcoming"} will be online.`;
        try {
          const parsed = JSON.parse(announcement);
          notifBody += ` Platform: ${parsed.platform || "Online"}\nTime: ${parsed.start_time || "—"} – ${parsed.end_time || "—"}`;
        } catch (e) {}
      } else if (extras.type === "class_test") {
        notifTitle = "📝 Class Test Scheduled";
        notifBody = `${extras.subject_override || "A class"} on ${extras.date_override || "upcoming"} has an exam.`;
        try {
          const parsed = JSON.parse(announcement);
          notifBody += ` Exam: ${parsed.exam_name || "Class Test"}\nTopics: ${parsed.topics || "Not Specified"}`;
        } catch (e) {}
      } else {
        notifTitle = `📢 ${title || "New Announcement"}`;
        notifBody = announcement;
      }

      Notifications.showInstant(notifTitle, notifBody, notifType);
      Notifications.scheduleForToday();

      await this.fetchAll();
      return true;
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
      return false;
    }
  },

  async update(id, name, title, announcement, password, extras = {}) {
    try {
      const res = await fetch(`${CONFIG.apiBase || ""}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          isUpdate: true,
          action: "update",
          name,
          title,
          announcement,
          password,
          subject: extras.subject || "",
          type: extras.type || "general",
          date_override: extras.date_override || "",
          subject_override: extras.subject_override || "",
          semester: Storage.getSemester(),
          section: Storage.getSection(),
          is_pinned: extras.is_pinned === true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update announcement");
      }

      const updated = await res.json();
      State.sessionDeletePassword = password;

      // Update the item in-place in the local list — no page reload needed
      const idx = this.list.findIndex((a) => String(a.id) === String(id));
      if (idx !== -1) {
        this.list[idx] = { ...this.list[idx], ...updated };
      }
      this.renderFeed();
      showToast("Announcement updated.", "success");
      return true;
    } catch (err) {
      showToast(`Error: ${err.message}`, "error");
      return false;
    }
  },

  async togglePin(id, explicitPassword = null) {
    const item = this.list.find((a) => String(a.id) === String(id));
    if (!item) return;

    const passwordToUse = explicitPassword || State.sessionDeletePassword;
    if (!passwordToUse) {
      showConfirm(
        "Admin Verification",
        "Enter admin password to pin/unpin this notice:",
        async (pwd) => {
          if (!pwd) {
            showToast("Password is required.", "warning");
            return;
          }
          await this.togglePin(id, pwd);
        },
        true,
      );
      return;
    }

    const currentPin = item.is_pinned === true || item.is_pinned === "true" || item.is_pinned === 1;
    const newPinState = !currentPin;

    // Optimistically update in memory and local storage
    item.is_pinned = newPinState;
    const pinnedSet = this.getPinnedIds();
    if (newPinState) {
      pinnedSet.add(String(id));
    } else {
      pinnedSet.delete(String(id));
    }
    this.savePinnedIds(pinnedSet);

    // Re-render feed immediately
    this.renderFeed();

    try {
      const res = await fetch(`${CONFIG.apiBase || ""}/api/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          isUpdate: true,
          action: "update",
          name: item.name,
          title: item.title,
          announcement: item.announcement,
          password: passwordToUse,
          type: item.type || "general",
          date_override: item.date_override || "",
          subject_override: item.subject_override || "",
          semester: item.semester || Storage.getSemester(),
          section: item.section || Storage.getSection(),
          is_pinned: newPinState,
        }),
      });

      State.sessionDeletePassword = passwordToUse;
      try {
        const updated = await res.json();
        if (typeof updated.is_pinned === "boolean") {
          item.is_pinned = updated.is_pinned;
          if (updated.is_pinned) pinnedSet.add(String(id));
          else pinnedSet.delete(String(id));
          this.savePinnedIds(pinnedSet);
        }
      } catch (e) {}

      // Guarantee chosen pin state is preserved
      item.is_pinned = newPinState;
      if (newPinState) pinnedSet.add(String(id));
      else pinnedSet.delete(String(id));
      this.savePinnedIds(pinnedSet);

      this.renderFeed();
      showToast(newPinState ? "Announcement pinned." : "Announcement unpinned.", "success");
    } catch (err) {
      // Offline/server fallback: preserve user's pin choice locally
      item.is_pinned = newPinState;
      const pinnedSet = this.getPinnedIds();
      if (newPinState) pinnedSet.add(String(id));
      else pinnedSet.delete(String(id));
      this.savePinnedIds(pinnedSet);
      this.renderFeed();
      showToast(newPinState ? "Pinned locally." : "Unpinned locally.", "success");
    }
  },
};

/** Register announcements full-page event listeners */
export function initAnnouncementEvents() {
  window.__fetchAndRenderAnnouncements = () => {
    Announcements.fetchAll();
  };

  // Back button: return to Home
  const backBtn = document.getElementById("announcePageBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      if (window.switchAppView) window.switchAppView("home");
    });
  }

  // "+ Post Notice" button: open full-page post form
  const newPostBtn = document.getElementById("newAnnounceBtn");
  if (newPostBtn) {
    newPostBtn.addEventListener("click", () => {
      if (window.switchAppView) window.switchAppView("post_announcement");
    });
  }

  // Admin Mode Unlock / Toggle Button
  const adminBtn = document.getElementById("adminNoticeModeBtn");
  const adminLabel = document.getElementById("adminNoticeModeLabel");

  const updateAdminBtnUI = () => {
    if (!adminBtn) return;
    if (Announcements.isAdminMode) {
      adminBtn.classList.add("active");
      if (adminLabel) adminLabel.textContent = "Done";
      adminBtn.title = "Exit Admin Edit Mode";
    } else {
      adminBtn.classList.remove("active");
      if (adminLabel) adminLabel.textContent = "Edit";
      adminBtn.title = "Unlock Admin Edit Mode";
    }
  };

  if (adminBtn) {
    adminBtn.addEventListener("click", () => {
      // If currently active, toggle off admin mode
      if (Announcements.isAdminMode) {
        Announcements.isAdminMode = false;
        updateAdminBtnUI();
        Announcements.renderFeed();
        showToast("Admin edit mode locked.", "info");
        return;
      }

      // If password already stored in session
      if (State.sessionDeletePassword) {
        Announcements.isAdminMode = true;
        updateAdminBtnUI();
        Announcements.renderFeed();
        showToast("Admin edit mode unlocked.", "success");
        return;
      }

      // Prompt for password using showConfirm modal
      showConfirm(
        "Admin Unlock",
        "Enter admin password to unlock editing and deletion options on all notices:",
        async (pwdVal) => {
          if (!pwdVal) {
            showToast("Password is required.", "warning");
            return;
          }
          try {
            const res = await fetch(
              `${CONFIG.apiBase || ""}/api/announcements`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  password: pwdVal,
                  checkPasswordOnly: true,
                }),
              },
            );

            if (!res.ok) {
              const err = await res.json();
              throw new Error(err.error || "Invalid admin password");
            }

            State.sessionDeletePassword = pwdVal;
            Announcements.isAdminMode = true;
            updateAdminBtnUI();
            Announcements.renderFeed();
            showToast("Admin edit mode unlocked!", "success");
          } catch (err) {
            showToast(err.message || "Invalid admin password.", "error");
          }
        },
        true,    // show password input
        'unlock', // variant: blue lock icon + Unlock button
      );
    });
  }

  // Filter Bar Pills Binding
  const filterBar = document.getElementById("announceFilterBar");
  if (filterBar) {
    filterBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".announce-filter-pill");
      if (!btn) return;
      filterBar
        .querySelectorAll(".announce-filter-pill")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      Announcements.activeFilter = btn.dataset.filter || "all";
      Announcements.renderFeed();
    });
  }

  // Feed Click Delegation for Edit & Delete
  const feed = document.getElementById("announceList");
  if (feed) {
    feed.addEventListener("click", async (e) => {
      // 0. Pin Action
      const pinBtn = e.target.closest(".announce-card-action-btn.pin");
      if (pinBtn) {
        e.preventDefault();
        e.stopPropagation();
        const id = pinBtn.getAttribute("data-id");
        if (id) await Announcements.togglePin(id);
        return;
      }

      // 1. Edit Action
      const editBtn = e.target.closest(".announce-card-action-btn.edit");
      if (editBtn) {
        const id = editBtn.getAttribute("data-id");
        const announcement = Announcements.list.find(
          (a) => String(a.id) === String(id),
        );
        if (announcement) {
          if (window.switchAppView) {
            window.switchAppView("post_announcement", announcement);
          }
        }
        return;
      }

      // 2. Delete Action
      const deleteBtn = e.target.closest(".announce-card-action-btn.delete");
      if (deleteBtn) {
        const id = deleteBtn.getAttribute("data-id");
        if (!id) return;

        const needsPassword = !State.sessionDeletePassword;

        showConfirm(
          "Delete Announcement",
          "Are you sure you want to delete this announcement? This will remove any associated schedule overrides.",
          async (pwdVal) => {
            const activePwd = State.sessionDeletePassword || pwdVal;
            await Announcements.delete(id, activePwd);
          },
          needsPassword,
        );
        return;
      }
    });
  }
}
