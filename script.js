/**
 * My Routine — Smart Timetable Dashboard Engine
 * Handles schedule rendering, notifications, streaks, and all UI interactions.
 */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════════════════
     1. Configuration & Constants
     ══════════════════════════════════════════════════════════════════════════ */

  const CONFIG = {
    activeDays: [6, 0, 1, 2, 3], // Sat, Sun, Mon, Tue, Wed
    matrixIntervals: [
      { startM: 510, endM: 585, lbl: '08:30 → 09:45' },
      { startM: 585, endM: 660, lbl: '09:45 → 11:00' },
      { startM: 660, endM: 735, lbl: '11:00 → 12:15' },
      { startM: 735, endM: 810, lbl: '12:15 → 01:30' },
      { startM: 810, endM: 885, lbl: '01:30 → 02:45' },
      { startM: 885, endM: 960, lbl: '02:45 → 04:00' }
    ],
    particles: { countMobile: 15, countDesktop: 30, maxDistance: 115, colors: ['56,189,248', '244,63,94', '16,185,129'] },
    updateIntervalMs: 1000,
    defaultRoutine: {
      Saturday: [
        { time: '09:45 AM - 11:00 AM', subject: 'EDC', room: '1002', instructor: 'AIR', type: 'Theory' },
        { time: '11:00 AM - 01:30 PM', subject: 'DSL', room: '905', instructor: 'MHE', type: 'Lab' },
        { time: '01:30 PM - 02:45 PM', subject: 'ICMP', room: '406', instructor: 'NME', type: 'Theory' },
        { time: '02:45 PM - 04:00 PM', subject: 'DS', room: '404', instructor: 'MHE', type: 'Theory' }
      ],
      Sunday: [
        { time: '08:30 AM - 11:00 AM', subject: 'EDCL', room: '508', instructor: 'RSN', type: 'Lab' },
        { time: '12:15 PM - 01:30 PM', subject: 'DMNT', room: '612', instructor: 'ST', type: 'Theory' }
      ],
      Monday: [
        { time: '09:45 AM - 11:00 AM', subject: 'EE', room: '1001', instructor: 'IFTEKAR MIA', type: 'Theory' },
        { time: '11:00 AM - 12:15 PM', subject: 'ICMP', room: '404', instructor: 'NME', type: 'Theory' }
      ],
      Tuesday: [
        { time: '09:45 AM - 11:00 AM', subject: 'DMNT', room: '408', instructor: 'ST', type: 'Theory' },
        { time: '11:00 AM - 01:30 PM', subject: 'PHYL', room: '505', instructor: 'NJS', type: 'Lab' },
        { time: '01:30 PM - 02:45 PM', subject: 'CPL', room: '608', instructor: 'MHN', type: 'Theory' }
      ],
      Wednesday: [
        { time: '11:00 AM - 12:15 PM', subject: 'DS', room: '510', instructor: 'MHE', type: 'Theory' },
        { time: '12:15 PM - 01:30 PM', subject: 'EDC', room: '901', instructor: 'AIR', type: 'Theory' },
        { time: '01:30 PM - 02:45 PM', subject: 'EE', room: '910', instructor: 'IFTEKAR MIA', type: 'Theory' }
      ]
    }
  };

  const FULL_COURSE_NAMES = {
    'CPL': 'Competitive Programming Laboratory',
    'DMNT': 'Discrete Mathematics and Number Theory',
    'DS': 'Data Structures',
    'DSL': 'Data Structures Laboratory',
    'EE': 'Engineering Economics',
    'EDC': 'Electronics Devices and Circuits',
    'EDCL': 'Electronics Device and Circuits Laboratory',
    'ICMP': 'Introduction to Classical & Modern Physics',
    'PHYL': 'Physics Laboratory'
  };

  const DAY_NAMES = { 6: 'Saturday', 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
  const DAY_SHORT = { 6: 'Sat', 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_MAP = { Saturday: 6, Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };

  const SUBJECT_PALETTES = [
    { bg: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '#818cf8', text: '#e0e7ff', badge: 'rgba(129,140,248,0.35)' }, // Indigo
    { bg: 'linear-gradient(135deg, #022c22, #0d9488)', border: '#2dd4bf', text: '#ccfbf1', badge: 'rgba(45,212,191,0.35)' }, // Teal/Emerald
    { bg: 'linear-gradient(135deg, #451a03, #d97706)', border: '#fbbf24', text: '#fef3c7', badge: 'rgba(251,191,36,0.35)' }, // Orange/Amber
    { bg: 'linear-gradient(135deg, #2e1065, #7c3aed)', border: '#a78bfa', text: '#f5f3ff', badge: 'rgba(167,139,250,0.35)' }, // Purple/Violet
    { bg: 'linear-gradient(135deg, #0f172a, #475569)', border: '#94a3b8', text: '#f8fafc', badge: 'rgba(148,163,184,0.35)' }, // Slate Blue/Grey
    { bg: 'linear-gradient(135deg, #4a044e, #c026d3)', border: '#e879f9', text: '#fdf4ff', badge: 'rgba(232,121,249,0.35)' }  // Fuchsia/Magenta
  ];
  const LAB_THEME = { bg: 'linear-gradient(135deg, #4c0519, #881337, #9f1239)', border: '#f43f5e', text: '#ffffff', badge: 'rgba(244,63,94,0.5)', isLab: true };


  /* ══════════════════════════════════════════════════════════════════════════
     2. State
     ══════════════════════════════════════════════════════════════════════════ */

  let schedule = {};
  let undoCallback = null;
  let toastTimer = null;
  let selectedDay = new Date().getDay();
  let simulatedTimeMins = null;
  let currentViewDayIdx = new Date().getDay();
  let matrixSelectedDayIdx = new Date().getDay();
  let isModalOpen = false;
  let lastRenderedMinute = -1;
  let clockIntervalId = null;
  let dashboardIntervalId = null;

  // Initialize to a valid active day
  if (!CONFIG.activeDays.includes(currentViewDayIdx)) currentViewDayIdx = CONFIG.activeDays[0];
  if (!CONFIG.activeDays.includes(selectedDay)) selectedDay = CONFIG.activeDays[0];
  if (!CONFIG.activeDays.includes(matrixSelectedDayIdx)) matrixSelectedDayIdx = CONFIG.activeDays[0];


  /* ══════════════════════════════════════════════════════════════════════════
     3. DOM Cache — All frequently-accessed elements cached once
     ══════════════════════════════════════════════════════════════════════════ */

  const $ = selector => document.querySelector(selector);
  const $id = id => document.getElementById(id);

  const DOM = {
    // Clock & header
    clockHour: $id('hD'),
    clockMin: $id('mD'),
    clockPeriod: $id('apD'),
    simBadge: $id('simBadge'),
    dayDisplay: $id('dayD'),
    dateDisplay: $id('dateD'),

    // Greeting & stats
    greetText: $id('greetText'),
    greetSub: $id('greetSub'),
    statClasses: $id('statClasses'),
    statHours: $id('statHours'),
    statGaps: $id('statGaps'),
    statStreak: $id('statStreak'),

    // Current class card
    currentTitle: $id('cT'),
    currentRoom: $id('cR'),
    currentTimeRange: $id('cTR'),
    currentElapsed: $id('cEl'),
    currentBar: $id('cBar'),
    currentRemaining: $id('cRm'),

    // Next class card
    nextTitle: $id('nT'),
    nextEta: $id('nE'),
    nextRoom: $id('nR'),
    nextTimeRange: $id('nTR'),

    // Timeline
    timelineGrid: $id('chG'),
    timelineTitle: $id('timelineTitle'),
    timelineSubtitle: $id('timelineSubtitle'),

    // Matrix
    matrixGrid: $id('tGrid'),

    // Modals
    timeModal: $id('timeModal'),
    viewModal: $id('viewModal'),
    editModal: $id('editModal'),
    notifModal: $id('notifModal'),
    simTimeInput: $id('simTimeInput'),

    // Edit modal
    editCols: $id('rCols'),
    editDaySelect: $id('eDay'),
    editStart: $id('eS'),
    editEnd: $id('eE'),
    editTitle: $id('eT'),
    editRoom: $id('eR'),
    editInstructor: $id('eI'),
    editType: $id('eTy'),
    importFile: $id('imF'),

    // Notification settings
    notifToggle: $id('notifToggle'),
    notifLeadTime: $id('notifLeadTime'),
    notifPermStatus: $id('notifPermStatus'),

    // Banners
    notifBanner: $id('notifBanner'),
    installBanner: $id('installBanner'),

    // Toast
    toast: $id('toast'),
    toastIcon: $id('toastIcon'),
    undoBtn: $id('undoB'),

    // Canvas
    canvas: $id('ptc'),

    // Announcements
    announcementsBtn: $id('announcementsBtn'),
    announceBadge: $id('announceBadge'),
    announceModal: $id('announceModal'),
    announceModalClose: $id('announceModalClose'),
    newAnnounceBtn: $id('newAnnounceBtn'),
    announceList: $id('announceList'),
    postAnnounceModal: $id('postAnnounceModal'),
    postAnnounceClose: $id('postAnnounceClose'),
    postAnnounceCancel: $id('postAnnounceCancel'),
    postAnnounceSubmit: $id('postAnnounceSubmit'),
    paName: $id('paName'),
    paTitle: $id('paTitle'),
    paContent: $id('paContent'),
    paPassword: $id('paPassword'),
    paSubject: $id('paSubject'),
    paType: $id('paType'),
    paDateOverride: $id('paDateOverride'),
    paSubjectOverride: $id('paSubjectOverride'),
    paSubjectOverrideContainer: $id('paSubjectOverrideContainer'),
    overrideSection: $id('overrideSection')
  };


  /* ══════════════════════════════════════════════════════════════════════════
     4. Utility Functions
     ══════════════════════════════════════════════════════════════════════════ */

  const pad = num => String(num).padStart(2, '0');
  const toMinutes = time24h => { const [h, m] = time24h.split(':').map(Number); return h * 60 + m; };
  const toTimeString = mins => `${pad(Math.floor(mins / 60))}:${pad(Math.floor(mins % 60))}`;

  function getCurrentMinutes() {
    if (simulatedTimeMins !== null) return simulatedTimeMins;
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  function parseTo24h(timeStr) {
    const parts = timeStr.trim().split(' ');
    if (parts.length !== 2) return timeStr;
    let [hours, mins] = parts[0].split(':').map(Number);
    const period = parts[1].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${pad(hours)}:${pad(mins)}`;
  }

  function format12h(time24h) {
    let [hours, mins] = time24h.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${pad(hours)}:${pad(mins)} ${period}`;
  }

  function formatRoom(roomStr) {
    if (!roomStr) return '';
    return roomStr.replace(/^Rm\s*/i, '');
  }

  function normalizeSchedule(rawSchedule) {
    const normalized = {};
    for (const [dayName, entries] of Object.entries(rawSchedule)) {
      const idx = DAY_MAP[dayName];
      if (idx === undefined) continue;
      normalized[idx] = entries.map(item => {
        const [startStr, endStr] = item.time.split(' - ').map(t => t.trim());
        return {
          start: parseTo24h(startStr),
          end: parseTo24h(endStr),
          title: item.subject,
          room: item.room,
          instructor: item.instructor || '',
          type: item.type || 'Theory'
        };
      });
    }
    for (const dayIdx of CONFIG.activeDays) {
      if (!normalized[dayIdx]) normalized[dayIdx] = [];
    }
    return normalized;
  }

  function getClassesForDay(dayIdx) {
    const target = dayIdx !== undefined ? dayIdx : currentViewDayIdx;
    return (schedule[target] || []).slice().sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  }

  function getActiveClass(entries, currentMins) {
    for (const item of entries) {
      if (currentMins >= toMinutes(item.start) && currentMins < toMinutes(item.end)) return item;
    }
    return null;
  }

  function getNextClass(entries, currentMins) {
    let next = null;
    let minDiff = Infinity;
    for (const item of entries) {
      const startMins = toMinutes(item.start);
      const diff = startMins - currentMins;
      if (diff > 0 && diff < minDiff) { minDiff = diff; next = item; }
    }
    return next;
  }

  function getSubjectTheme(subject, type) {
    const clean = subject.toUpperCase().replace(/[^A-Z]/g, '');
    const isLab = type.toLowerCase() === 'lab' || clean.includes('LAB') || clean.endsWith('L');
    if (isLab) return LAB_THEME;

    let hash = 0;
    for (let i = 0; i < clean.length; i++) hash = clean.charCodeAt(i) + ((hash << 5) - hash);
    return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length];
  }


  /* ══════════════════════════════════════════════════════════════════════════
     5. Storage
     ══════════════════════════════════════════════════════════════════════════ */

  const Storage = {
    SCHEDULE_KEY: 'genz_routine_data',
    NOTIF_KEY: 'routine_notif_settings',
    STREAK_KEY: 'routine_streak',
    BANNER_DISMISS_KEY: 'routine_notif_banner_dismissed',
    INSTALL_DISMISS_KEY: 'routine_install_dismissed',

    saveSchedule() {
      try { localStorage.setItem(this.SCHEDULE_KEY, JSON.stringify(schedule)); } catch {}
    },
    loadSchedule() {
      try {
        const saved = localStorage.getItem(this.SCHEDULE_KEY);
        return saved ? JSON.parse(saved) : null;
      } catch { return null; }
    },

    getNotifSettings() {
      try {
        const saved = localStorage.getItem(this.NOTIF_KEY);
        return saved ? JSON.parse(saved) : { enabled: false, leadTime: 5 };
      } catch { return { enabled: false, leadTime: 5 }; }
    },
    saveNotifSettings(settings) {
      try { localStorage.setItem(this.NOTIF_KEY, JSON.stringify(settings)); } catch {}
    },

    getStreak() {
      try {
        const saved = localStorage.getItem(this.STREAK_KEY);
        return saved ? JSON.parse(saved) : { lastDate: null, count: 0 };
      } catch { return { lastDate: null, count: 0 }; }
    },
    saveStreak(data) {
      try { localStorage.setItem(this.STREAK_KEY, JSON.stringify(data)); } catch {}
    },

    isBannerDismissed(key) {
      try { return localStorage.getItem(key) === 'true'; } catch { return false; }
    },
    dismissBanner(key) {
      try { localStorage.setItem(key, 'true'); } catch {}
    }
  };


  /* ══════════════════════════════════════════════════════════════════════════
     6. Notification System
     ══════════════════════════════════════════════════════════════════════════ */

  const Notifications = {
    timeouts: [],

    isSupported() {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) return true;
      return 'Notification' in window;
    },

    async getPermission() {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          const { LocalNotifications } = window.Capacitor.Plugins;
          const status = await LocalNotifications.checkPermissions();
          return status.display;
        } catch (e) {
          return 'denied';
        }
      }
      if (!this.isSupported()) return 'unsupported';
      return Notification.permission;
    },

    async requestPermission() {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          const { LocalNotifications } = window.Capacitor.Plugins;
          const status = await LocalNotifications.requestPermissions();
          await this.updatePermissionUI();
          return status.display === 'granted';
        } catch (e) {
          return false;
        }
      }
      if (!this.isSupported()) return false;
      const result = await Notification.requestPermission();
      await this.updatePermissionUI();
      return result === 'granted';
    },

    async updatePermissionUI() {
      const perm = await this.getPermission();
      const labels = { granted: 'Granted ✓', denied: 'Blocked by browser', default: 'Not yet requested', prompt: 'Not yet requested', unsupported: 'Not supported' };
      DOM.notifPermStatus.textContent = labels[perm] || perm;
      DOM.notifPermStatus.style.color = perm === 'granted' ? '#10b981' : perm === 'denied' ? '#f43f5e' : '';
    },

    async scheduleForToday() {
      await this.cancelAll();
      const settings = Storage.getNotifSettings();
      if (!settings.enabled) return;

      const hasPerm = (await this.getPermission()) === 'granted';
      if (!hasPerm) return;

      const todayIdx = new Date().getDay();
      const classes = schedule[todayIdx] || [];
      const now = getCurrentMinutes();
      const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

      if (isNative) {
        const { LocalNotifications } = window.Capacitor.Plugins;
        const nativeNotifs = [];

        classes.forEach((cls, idx) => {
          const startMins = toMinutes(cls.start);

          // Pre-class warning
          const alertMins = startMins - settings.leadTime;
          if (alertMins > now) {
            const alertDate = new Date();
            alertDate.setHours(Math.floor(alertMins / 60));
            alertDate.setMinutes(alertMins % 60);
            alertDate.setSeconds(0);

            nativeNotifs.push({
              title: `${cls.title} in ${settings.leadTime} min`,
              body: `Room ${formatRoom(cls.room)} · ${format12h(cls.start)} – ${format12h(cls.end)}`,
              id: idx * 2,
              schedule: { at: alertDate },
              smallIcon: 'ic_stat_icon',
              iconColor: '#38bdf8'
            });
          }

          // Class starting now
          if (startMins > now) {
            const startDate = new Date();
            startDate.setHours(Math.floor(startMins / 60));
            startDate.setMinutes(startMins % 60);
            startDate.setSeconds(0);

            nativeNotifs.push({
              title: `${cls.title} starting now`,
              body: `Room ${formatRoom(cls.room)}`,
              id: idx * 2 + 1,
              schedule: { at: startDate },
              smallIcon: 'ic_stat_icon',
              iconColor: '#38bdf8'
            });
          }
        });

        if (nativeNotifs.length) {
          try {
            await LocalNotifications.schedule({ notifications: nativeNotifs });
          } catch (e) {
            console.error('Failed to schedule native alarms:', e);
          }
        }
      } else {
        // Standard Web Browser timeouts
        classes.forEach(cls => {
          const startMins = toMinutes(cls.start);

          // Pre-class warning
          const alertMins = startMins - settings.leadTime;
          if (alertMins > now) {
            const delay = (alertMins - now) * 60000;
            this.timeouts.push(setTimeout(() => {
              this.show(
                `${cls.title} in ${settings.leadTime} min`,
                `Room ${formatRoom(cls.room)} · ${format12h(cls.start)} – ${format12h(cls.end)}`
              );
            }, delay));
          }

          // Class starting now
          if (startMins > now) {
            const delay = (startMins - now) * 60000;
            this.timeouts.push(setTimeout(() => {
              this.show(`${cls.title} starting now`, `Room ${formatRoom(cls.room)}`);
            }, delay));
          }
        });
      }
    },

    async cancelAll() {
      this.timeouts.forEach(t => clearTimeout(t));
      this.timeouts = [];

      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          const { LocalNotifications } = window.Capacitor.Plugins;
          const pending = await LocalNotifications.getPending();
          if (pending.notifications.length) {
            await LocalNotifications.cancel(pending);
          }
        } catch (e) {
          console.error('Failed to cancel native alarms:', e);
        }
      }
    },

    show(title, body) {
      if (!this.isSupported() || Notification.permission !== 'granted') return;
      try {
        new Notification(title, {
          body,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          tag: `routine-${Date.now()}`,
          requireInteraction: false
        });
      } catch {}
    },

    async maybeShowBanner() {
      if (!this.isSupported()) return;
      const perm = await this.getPermission();
      if (perm !== 'default' && perm !== 'prompt') return;
      if (Storage.isBannerDismissed(Storage.BANNER_DISMISS_KEY)) return;
      DOM.notifBanner.classList.add('show');
    },

    async init() {
      await this.updatePermissionUI();
      const settings = Storage.getNotifSettings();
      DOM.notifToggle.checked = settings.enabled;
      DOM.notifLeadTime.value = settings.leadTime;

      if (settings.enabled) {
        await this.scheduleForToday();
        if (NativePush.isSupported()) {
          NativePush.init();
        }
      }
      await this.maybeShowBanner();
    }
  };


  /* ══════════════════════════════════════════════════════════════════════════
     7. Streak Tracker
     ══════════════════════════════════════════════════════════════════════════ */

  const Streak = {
    update() {
      const data = Storage.getStreak();
      const today = new Date().toISOString().split('T')[0];

      if (data.lastDate === today) return data.count;

      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      data.count = (data.lastDate === yesterday) ? data.count + 1 : 1;
      data.lastDate = today;
      Storage.saveStreak(data);
      return data.count;
    },

    getCount() {
      return Storage.getStreak().count || 0;
    }
  };


  /* ══════════════════════════════════════════════════════════════════════════
     8. Particles (Background Canvas)
     ══════════════════════════════════════════════════════════════════════════ */

  const Particles = {
    ctx: DOM.canvas.getContext('2d'),
    items: [],
    rafId: null,

    init() {
      DOM.canvas.width = window.innerWidth;
      DOM.canvas.height = window.innerHeight;
      this.items = [];
      const count = window.innerWidth < 500 ? CONFIG.particles.countMobile : CONFIG.particles.countDesktop;
      for (let i = 0; i < count; i++) {
        this.items.push({
          x: Math.random() * DOM.canvas.width,
          y: Math.random() * DOM.canvas.height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          r: Math.random() * 1.5 + 0.5,
          c: CONFIG.particles.colors[Math.floor(Math.random() * CONFIG.particles.colors.length)],
          a: Math.random() * 0.35 + 0.08
        });
      }
    },

    render() {
      // Skip rendering when modal is open or tab is hidden
      if (isModalOpen || document.hidden) {
        this.rafId = requestAnimationFrame(() => this.render());
        return;
      }

      const { ctx, items } = this;
      const w = DOM.canvas.width;
      const h = DOM.canvas.height;
      const maxDistSq = CONFIG.particles.maxDistance * CONFIG.particles.maxDistance;

      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.r), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c},${p.a})`;
        ctx.fill();

        for (let j = i + 1; j < items.length; j++) {
          const q = items[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < maxDistSq) {
            const dist = Math.sqrt(distSq);
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(56,189,248,${0.06 * (1 - dist / CONFIG.particles.maxDistance)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        }
      }
      this.rafId = requestAnimationFrame(() => this.render());
    },

    start() { if (!this.rafId) this.render(); },
    stop() { cancelAnimationFrame(this.rafId); this.rafId = null; }
  };


  /* ══════════════════════════════════════════════════════════════════════════
     9. Toast System
     ══════════════════════════════════════════════════════════════════════════ */

  /**
   * Show a toast notification.
   * @param {string} message - The message to display.
   * @param {'info'|'success'|'error'|'warning'} [type='info'] - Toast style variant.
   * @param {Function|null} [undoCb=null] - Optional undo callback.
   */
  function showToast(message, type = 'info', undoCb = null) {
    DOM.toast.querySelector('.msg').textContent = message;

    // Clear previous type classes
    DOM.toast.className = 'toast';
    if (type) DOM.toast.classList.add(`toast-${type}`);

    if (undoCb) {
      DOM.undoBtn.textContent = 'UNDO';
      DOM.undoBtn.style.display = 'inline-block';
      undoCallback = undoCb;
    } else {
      DOM.undoBtn.style.display = 'none';
      undoCallback = null;
    }

    DOM.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { DOM.toast.classList.remove('show'); undoCallback = null; }, 5000);
  }

  DOM.undoBtn.addEventListener('click', () => {
    if (undoCallback) { undoCallback(); undoCallback = null; DOM.toast.classList.remove('show'); }
  });


  /* ══════════════════════════════════════════════════════════════════════════
     10. Smart Greeting & Stats
     ══════════════════════════════════════════════════════════════════════════ */

  function updateGreeting() {
    const hour = new Date().getHours();
    let greeting;
    if (hour >= 5 && hour < 12) greeting = 'Good morning ☀️';
    else if (hour >= 12 && hour < 17) greeting = 'Good afternoon 🌤️';
    else if (hour >= 17 && hour < 21) greeting = 'Good evening 🌅';
    else greeting = 'Good night 🌙';

    const todayClasses = getClassesForDay(new Date().getDay());
    const count = todayClasses.length;
    const sub = count > 0 ? `You have ${count} class${count !== 1 ? 'es' : ''} today` : 'No classes today — enjoy!';

    DOM.greetText.textContent = greeting;
    DOM.greetSub.textContent = sub;
  }

  function updateStats() {
    const todayClasses = getClassesForDay(new Date().getDay());
    const count = todayClasses.length;

    // Total hours
    let totalMins = 0;
    todayClasses.forEach(c => { totalMins += toMinutes(c.end) - toMinutes(c.start); });
    const hours = totalMins / 60;

    // Count breaks (gaps between consecutive classes)
    let gaps = 0;
    const sorted = todayClasses.slice().sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (toMinutes(sorted[i].start) > toMinutes(sorted[i - 1].end)) gaps++;
    }

    // Streak
    const streak = Streak.getCount();

    DOM.statClasses.textContent = count;
    DOM.statHours.textContent = hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`;
    DOM.statGaps.textContent = gaps;
    DOM.statStreak.textContent = `🔥 ${streak}`;
  }


  /* ══════════════════════════════════════════════════════════════════════════
     11. Clock Display
     ══════════════════════════════════════════════════════════════════════════ */

  function updateClock() {
    let hours, mins, period;

    if (simulatedTimeMins !== null) {
      hours = Math.floor(simulatedTimeMins / 60) % 12 || 12;
      mins = pad(simulatedTimeMins % 60);
      period = Math.floor(simulatedTimeMins / 60) >= 12 ? 'PM' : 'AM';
      DOM.simBadge.style.display = 'inline-block';
    } else {
      const now = new Date();
      hours = now.getHours() % 12 || 12;
      mins = pad(now.getMinutes());
      period = now.getHours() >= 12 ? 'PM' : 'AM';
      DOM.simBadge.style.display = 'none';
    }

    DOM.clockHour.textContent = pad(hours);
    DOM.clockMin.textContent = mins;
    DOM.clockPeriod.textContent = period;
    DOM.dayDisplay.textContent = DAY_NAMES[new Date().getDay()] || 'Weekend';

    const now = new Date();
    DOM.dateDisplay.textContent = `${MONTHS[now.getMonth()]} ${now.getDate()}`;
  }


  /* ══════════════════════════════════════════════════════════════════════════
     12. Course Title Toggle (Click to expand abbreviation)
     ══════════════════════════════════════════════════════════════════════════ */

  function toggleCourseTitle(element, shortTitle) {
    const fullTitle = FULL_COURSE_NAMES[shortTitle.toUpperCase()];
    if (!fullTitle) return;
    if (element.textContent === shortTitle) {
      element.textContent = fullTitle;
      element.style.color = '#38bdf8';
    } else {
      element.textContent = shortTitle;
      element.style.color = '';
    }
  }

  /** Attach click-to-expand handlers to all .course-click-title elements within a container */
  function bindCourseTitleClicks(container) {
    container.querySelectorAll('.course-click-title').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        toggleCourseTitle(el, el.dataset.title);
      });
    });
  }


  /* ══════════════════════════════════════════════════════════════════════════
     13. Dashboard Update Engine
     ══════════════════════════════════════════════════════════════════════════ */

  function checkAutoSwitchTomorrow() {
    const realTodayIdx = new Date().getDay();
    if (!CONFIG.activeDays.includes(realTodayIdx)) return;
    const todayEntries = schedule[realTodayIdx] || [];
    if (!todayEntries.length) return;
    const lastClassEnd = Math.max(...todayEntries.map(x => toMinutes(x.end)));
    if (getCurrentMinutes() >= lastClassEnd && currentViewDayIdx === realTodayIdx) {
      const currIndex = CONFIG.activeDays.indexOf(realTodayIdx);
      currentViewDayIdx = CONFIG.activeDays[(currIndex + 1) % CONFIG.activeDays.length];
    }
  }

  function updateDashboard() {
    const currentMins = getCurrentMinutes();
    if (lastRenderedMinute === currentMins && simulatedTimeMins === null) return;
    lastRenderedMinute = currentMins;
    checkAutoSwitchTomorrow();
    renderCurrentClass();
    renderNextClass();
    renderTimeline();
    if (DOM.viewModal.classList.contains('open')) renderWeeklyMatrix();
  }

  function forceUpdate() {
    lastRenderedMinute = -1;
    updateDashboard();
  }


  /* ══════════════════════════════════════════════════════════════════════════
     14. Core UI Rendering
     ══════════════════════════════════════════════════════════════════════════ */

  function renderCurrentClass() {
    const todayIdx = new Date().getDay();
    const holidayOverride = getOverrideFor(todayIdx);
    const progressSection = DOM.currentBar.parentElement.parentElement;
    const roomPill = DOM.currentRoom;
    const timePill = DOM.currentTimeRange;

    if (holidayOverride && holidayOverride.type === 'holiday') {
      progressSection.style.display = 'block';
      roomPill.parentElement.style.display = 'flex';
      timePill.style.display = 'inline-block';

      DOM.currentTitle.textContent = "Holiday / Day Off 🎉";
      roomPill.textContent = "HOLIDAY";
      timePill.textContent = "All classes suspended";
      DOM.currentElapsed.textContent = "Classes off";
      DOM.currentBar.style.width = "0%";
      DOM.currentRemaining.textContent = holidayOverride.announcement.title;
      return;
    }

    const todayClasses = getClassesForDay(todayIdx);
    const currentMins = getCurrentMinutes();
    const activeItem = getActiveClass(todayClasses, currentMins);

    if (activeItem) {
      const cancelOverride = getOverrideFor(todayIdx, activeItem.title);
      const isCancelled = !!cancelOverride;

      progressSection.style.display = 'block';
      roomPill.parentElement.style.display = 'flex';
      timePill.style.display = 'inline-block';

      if (isCancelled) {
        DOM.currentTitle.textContent = `${activeItem.title} (CANCELLED)`;
        roomPill.textContent = "CANCELLED";
        timePill.textContent = `${format12h(activeItem.start)} – ${format12h(activeItem.end)}`;
        DOM.currentElapsed.textContent = "No class today";
        DOM.currentBar.style.width = "0%";
        DOM.currentRemaining.textContent = `Reason: ${cancelOverride.announcement.title}`;
      } else {
        const startMins = toMinutes(activeItem.start);
        const endMins = toMinutes(activeItem.end);
        const elapsed = currentMins - startMins;
        const total = endMins - startMins;
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));

        DOM.currentTitle.textContent = activeItem.title + (activeItem.instructor ? ` (${activeItem.instructor})` : '');
        roomPill.textContent = formatRoom(activeItem.room) || '—';
        timePill.textContent = `${format12h(activeItem.start)} – ${format12h(activeItem.end)}`;
        DOM.currentElapsed.textContent = `${toTimeString(elapsed)} elapsed`;
        DOM.currentBar.style.width = `${pct}%`;

        const remaining = total - elapsed;
        if (remaining > 0) {
          const rh = Math.floor(remaining / 60);
          const rm = Math.floor(remaining % 60);
          DOM.currentRemaining.textContent = `Remaining: ${rh > 0 ? rh + 'h ' : ''}${rm}m`;
        } else {
          DOM.currentRemaining.textContent = 'Almost done!';
        }
      }
    } else {
      progressSection.style.display = 'none';
      roomPill.parentElement.style.display = 'none';
      timePill.style.display = 'none';
      DOM.currentTitle.textContent = 'Free Time ☕';
    }
  }

  function renderNextClass() {
    const todayIdx = new Date().getDay();
    const holidayOverride = getOverrideFor(todayIdx);
    const subRow = DOM.nextRoom.parentElement;

    if (holidayOverride && holidayOverride.type === 'holiday') {
      DOM.nextTitle.textContent = 'Enjoy your break!';
      DOM.nextEta.style.display = 'none';
      subRow.style.display = 'none';
      return;
    }

    const todayClasses = getClassesForDay(todayIdx);
    const currentMins = getCurrentMinutes();
    const activeItem = getActiveClass(todayClasses, currentMins);
    let nextItem = null;

    if (activeItem) {
      const activeEnd = toMinutes(activeItem.end);
      for (const item of todayClasses) {
        if (toMinutes(item.start) >= activeEnd) { nextItem = item; break; }
      }
    } else {
      nextItem = getNextClass(todayClasses, currentMins);
    }

    if (nextItem) {
      const cancelOverride = getOverrideFor(todayIdx, nextItem.title);
      const isCancelled = !!cancelOverride;
      const diff = toMinutes(nextItem.start) - currentMins;

      DOM.nextTitle.textContent = nextItem.title + (nextItem.instructor ? ` (${nextItem.instructor})` : '');
      DOM.nextTimeRange.textContent = `${format12h(nextItem.start)} – ${format12h(nextItem.end)}`;
      DOM.nextEta.style.display = 'inline-block';
      subRow.style.display = 'block';

      if (isCancelled) {
        DOM.nextRoom.textContent = "CANCELLED";
        DOM.nextEta.textContent = "CANCELLED";
      } else {
        DOM.nextRoom.textContent = formatRoom(nextItem.room) || '—';
        if (diff > 0) {
          const dh = Math.floor(diff / 60);
          const dm = Math.floor(diff % 60);
          DOM.nextEta.textContent = dh > 0 ? `in ${dh}h ${dm}m` : `in ${dm}m`;
        } else {
          DOM.nextEta.textContent = 'now';
        }
      }
    } else {
      DOM.nextTitle.textContent = 'No upcoming classes 🎉';
      DOM.nextEta.style.display = 'none';
      subRow.style.display = 'none';
    }
  }

  function renderTimeline() {
    const classes = getClassesForDay(currentViewDayIdx);
    const currentMins = getCurrentMinutes();
    const realTodayIdx = new Date().getDay();

    // Update section titles
    if (currentViewDayIdx === realTodayIdx) {
      DOM.timelineTitle.textContent = "Today's Classes";
      DOM.timelineSubtitle.textContent = DAY_NAMES[currentViewDayIdx];
    } else {
      DOM.timelineTitle.textContent = `${DAY_NAMES[currentViewDayIdx]}'s Classes`;
      const nextDay = (realTodayIdx + 1) % 7;
      DOM.timelineSubtitle.textContent = currentViewDayIdx === nextDay ? 'Tomorrow' : 'Viewing Schedule';
    }

    // Check holiday override for the day
    const holidayOverride = getOverrideFor(currentViewDayIdx);
    if (holidayOverride && holidayOverride.type === 'holiday') {
      DOM.timelineGrid.innerHTML = `
        <div class="ch" style="grid-template-columns: 1fr; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; border: 1.5px dashed var(--pink) !important; background: rgba(244, 63, 94, 0.08) !important; padding: 26px 20px; box-shadow: 0 0 20px rgba(244, 63, 94, 0.15) !important;">
          <span style="font-size: 28px; margin-bottom: 8px;">🎉</span>
          <span class="chn" style="color: var(--pink2); font-weight: 800; font-size: 17px; margin-bottom: 4px; letter-spacing: 0.5px;">HOLIDAY / DAY OFF</span>
          <span style="font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 4px;">${escapeHtml(holidayOverride.announcement.title)}</span>
          <span style="font-size: 12px; color: var(--dim); max-width: 80%;">${escapeHtml(holidayOverride.announcement.announcement)}</span>
        </div>
      `;
      return;
    }

    if (!classes.length) {
      DOM.timelineGrid.innerHTML = `<div class="t-empty" style="width:100%; min-height:100px;">No classes scheduled for ${DAY_NAMES[currentViewDayIdx]}</div>`;
      return;
    }

    let html = '';
    let lastEndMins = null;

    classes.forEach((item, index) => {
      const startMins = toMinutes(item.start);
      const endMins = toMinutes(item.end);

      // Insert break card between non-contiguous classes
      if (lastEndMins !== null && startMins > lastEndMins) {
        const isActiveBreak = (currentViewDayIdx === realTodayIdx) && (currentMins >= lastEndMins && currentMins < startMins);
        const isPastBreak = (currentViewDayIdx === realTodayIdx) && (startMins <= currentMins);
        const bt = { bg: 'linear-gradient(135deg, #18181b, #27272a)', border: '#3f3f46', text: '#a1a1aa', badge: 'rgba(255,255,255,0.05)' };

        html += `
          <div class="ch${isActiveBreak ? ' ca' : ''}${isPastBreak ? ' cp' : ''}" style="animation-delay:${index * 0.07 - 0.03}s; background:${bt.bg}; border-color:${bt.border}; color:#fff">
            <div class="cht" style="color:${bt.text}">${format12h(toTimeString(lastEndMins))}<br>${format12h(toTimeString(startMins))}</div>
            <div class="chi"><span class="chn" style="color:#d4d4d8; font-style:italic;">Break Time</span><span class="chr" style="color:${bt.text}">Take a breather ☕</span></div>
            <span class="ctb" style="background:${bt.badge}; color:#d4d4d8">BREAK</span>
          </div>`;
      }
      lastEndMins = endMins;

      // Check cancellation override for specific subject
      const cancelOverride = getOverrideFor(currentViewDayIdx, item.title);
      const isCancelled = !!cancelOverride;

      const isActive = (currentViewDayIdx === realTodayIdx) && (currentMins >= startMins && currentMins < endMins);
      const isPast = (currentViewDayIdx === realTodayIdx) && (endMins <= currentMins);
      
      const theme = isCancelled
        ? { bg: 'linear-gradient(135deg, #1c0a0c, #3f0f13)', border: '#f43f5e', text: '#fca5a5', badge: 'rgba(244, 63, 94, 0.2)' }
        : getSubjectTheme(item.title, item.type);

      html += `
        <div class="ch${isActive && !isCancelled ? ' ca' : ''}${isPast || isCancelled ? ' cp' : ''}" style="animation-delay:${index * 0.07}s; background:${theme.bg}; border-color:${theme.border}; color:#fff">
          <div class="cht" style="color:${theme.text}; text-decoration:${isCancelled ? 'line-through' : 'none'}">${format12h(item.start)}<br>${format12h(item.end)}</div>
          <div class="chi">
            <span class="chn course-click-title" data-title="${item.title}" title="Click to expand" style="text-decoration:${isCancelled ? 'line-through' : 'none'}">${item.title}</span>
            <span class="chr" style="color:${theme.text}">
              ${isCancelled ? `<span style="color:var(--pink); font-weight:800;">CANCELLED: ${escapeHtml(cancelOverride.announcement.title)}</span>` : `${formatRoom(item.room)} ${item.instructor ? `· ${item.instructor}` : ''}`}
            </span>
          </div>
          <span class="ctb" style="background:${theme.badge}; color:#fff">${isCancelled ? 'CANCEL' : (theme.isLab ? '★ LAB' : item.type)}</span>
        </div>`;
    });

    DOM.timelineGrid.innerHTML = html;
    bindCourseTitleClicks(DOM.timelineGrid);
  }


  /* ══════════════════════════════════════════════════════════════════════════
     15. Day Switching
     ══════════════════════════════════════════════════════════════════════════ */

  function smoothSwitchDay(direction) {
    DOM.timelineGrid.style.opacity = '0';
    DOM.timelineGrid.style.transform = 'translateY(10px)';

    setTimeout(() => {
      const idx = CONFIG.activeDays.indexOf(currentViewDayIdx);
      if (direction === 'prev') {
        currentViewDayIdx = CONFIG.activeDays[(idx - 1 + CONFIG.activeDays.length) % CONFIG.activeDays.length];
      } else {
        currentViewDayIdx = CONFIG.activeDays[(idx + 1) % CONFIG.activeDays.length];
      }
      renderTimeline();
      DOM.timelineGrid.style.opacity = '1';
      DOM.timelineGrid.style.transform = 'translateY(0)';
    }, 200);
  }

  $id('prevDayBtn').addEventListener('click', () => smoothSwitchDay('prev'));
  $id('nextDayBtn').addEventListener('click', () => smoothSwitchDay('next'));


  /* ══════════════════════════════════════════════════════════════════════════
     16. Weekly Timetable Matrix
     ══════════════════════════════════════════════════════════════════════════ */

  function renderWeeklyMatrix() {
    const todayIdx = new Date().getDay();
    const currentMins = getCurrentMinutes();
    const intervals = CONFIG.matrixIntervals;
    const isMobile = window.innerWidth <= 640;

    if (isMobile) {
      // Mobile Tab View
      let html = `<div class="m-matrix-tabs">`;
      CONFIG.activeDays.forEach(dayIdx => {
        const isSelected = dayIdx === matrixSelectedDayIdx;
        const isToday = dayIdx === todayIdx;
        html += `
          <button class="m-matrix-tab${isSelected ? ' active' : ''}${isToday ? ' today' : ''}" data-day="${dayIdx}">
            <span class="m-tab-name">${DAY_SHORT[dayIdx]}</span>
            ${isToday ? '<span class="m-tab-dot"></span>' : ''}
          </button>
        `;
      });
      html += `</div>`;

      // Active day classes
      const dayEntries = getClassesForDay(matrixSelectedDayIdx);
      html += `<div class="m-matrix-cards">`;
      if (dayEntries.length) {
        dayEntries.forEach((item, index) => {
          const startMins = toMinutes(item.start);
          const endMins = toMinutes(item.end);
          const isLive = (matrixSelectedDayIdx === todayIdx) && (currentMins >= startMins && currentMins < endMins);
          const isPast = (matrixSelectedDayIdx === todayIdx) && (endMins <= currentMins);
          const theme = getSubjectTheme(item.title, item.type);

          html += `
            <div class="m-matrix-card${isLive ? ' live' : ''}${isPast ? ' past' : ''}" style="animation-delay:${index * 0.05}s; background:${theme.bg}; border-color:${theme.border}; color:#fff">
              <div class="m-card-time" style="color:${theme.text}">
                <span>${format12h(item.start)}</span>
                <span class="m-card-arrow">→</span>
                <span>${format12h(item.end)}</span>
              </div>
              <div class="m-card-details">
                <div class="m-card-title course-click-title" data-title="${item.title}">${item.title}</div>
                <div class="m-card-sub" style="color:${theme.text}">
                  ${formatRoom(item.room) ? `Room ${formatRoom(item.room)}` : 'No room'} 
                  ${item.instructor ? `· ${item.instructor}` : ''}
                </div>
              </div>
              <span class="m-card-badge" style="background:${theme.badge}; color:#fff">${theme.isLab ? '★ LAB' : item.type}</span>
            </div>
          `;
        });
      } else {
        html += `<div class="m-matrix-empty">No classes scheduled for ${DAY_NAMES[matrixSelectedDayIdx]}</div>`;
      }
      html += `</div>`;

      DOM.matrixGrid.innerHTML = html;
      bindCourseTitleClicks(DOM.matrixGrid);

      // Handle tab clicks
      DOM.matrixGrid.querySelectorAll('.m-matrix-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          matrixSelectedDayIdx = parseInt(btn.dataset.day);
          renderWeeklyMatrix();
        });
      });
    } else {
      // Desktop Grid View
      let html = `<div class="t-header th-day">DAY / TIME</div>`;
      intervals.forEach(t => {
        const isNow = currentMins >= t.startM && currentMins < t.endM;
        html += `<div class="t-header${isNow ? ' active-time-col' : ''}">${t.lbl}</div>`;
      });

      CONFIG.activeDays.forEach(dayIdx => {
        const isToday = dayIdx === todayIdx;
        const dayEntries = schedule[dayIdx] || [];

        html += `<div class="day-card${isToday ? ' tod' : ''}"><div class="d-name">${DAY_NAMES[dayIdx]}</div>${isToday ? '<span class="d-tag">TODAY</span>' : ''}</div>`;

        let skipUntilIdx = 0;
        intervals.forEach((slot, idx) => {
          if (idx < skipUntilIdx) return;
          const match = dayEntries.find(x => toMinutes(x.start) <= slot.startM && toMinutes(x.end) >= slot.endM);

          if (match) {
            let spanCount = 0;
            for (let k = idx; k < intervals.length; k++) {
              if (toMinutes(match.end) >= intervals[k].endM) spanCount++;
              else break;
            }
            skipUntilIdx = idx + spanCount;
            const isLive = isToday && currentMins >= toMinutes(match.start) && currentMins < toMinutes(match.end);
            const theme = getSubjectTheme(match.title, match.type);

            html += `
              <div class="t-card${isLive ? ' live' : ''}" style="grid-column: span ${spanCount}; background:${theme.bg}; border-color:${theme.border}; color:#fff" title="Click to reveal">
                <div class="t-subj course-click-title" data-title="${match.title}">${match.title}</div>
                ${match.instructor ? `<div class="t-inst" style="color:${theme.text}">${match.instructor}</div>` : ''}
                <div class="t-meta"><span style="color:${theme.text}">${formatRoom(match.room) || 'No room'}</span><span class="t-badge" style="background:${theme.badge}; color:#fff">${theme.isLab ? '★ LAB' : match.type}</span></div>
              </div>`;
          } else {
            const isLiveEmpty = isToday && (currentMins >= slot.startM && currentMins < slot.endM);
            html += `<div class="t-empty${isLiveEmpty ? ' live-empty' : ''}">${isLiveEmpty ? '• FREE •' : '—'}</div>`;
          }
        });
      });

      DOM.matrixGrid.innerHTML = html;
      bindCourseTitleClicks(DOM.matrixGrid);
    }
  }


  /* ══════════════════════════════════════════════════════════════════════════
     17. Edit Modal & CRUD Operations
     ══════════════════════════════════════════════════════════════════════════ */

  function populateDaySelect() {
    DOM.editDaySelect.innerHTML = '';
    for (const dayIdx of CONFIG.activeDays) {
      const opt = document.createElement('option');
      opt.value = dayIdx;
      opt.textContent = DAY_NAMES[dayIdx];
      if (dayIdx === selectedDay) opt.selected = true;
      DOM.editDaySelect.appendChild(opt);
    }
  }

  DOM.editDaySelect.addEventListener('change', e => { selectedDay = parseInt(e.target.value); });

  function renderEditColumns() {
    const currentMins = getCurrentMinutes();
    const todayIdx = new Date().getDay();
    let html = '';

    CONFIG.activeDays.forEach((dayIdx, colIndex) => {
      const entries = getClassesForDay(dayIdx);
      const isToday = dayIdx === todayIdx;

      html += `<div class="dc${isToday ? ' tod' : ''}" style="animation-delay:${colIndex * 0.06}s">`;
      html += `<div class="dc-h"><span class="dn">${DAY_SHORT[dayIdx]}</span><span class="cnt">${entries.length}</span></div>`;
      html += `<div class="dc-b">`;

      if (entries.length) {
        entries.forEach(item => {
          const isLive = isToday && currentMins >= toMinutes(item.start) && currentMins < toMinutes(item.end);
          html += `
            <div class="dc-e${isLive ? ' ac' : ''}">
              <div class="et">${format12h(item.start)} – ${format12h(item.end)}</div>
              <div class="en" title="${item.title}">${item.title}</div>
              ${item.instructor ? `<div class="ei">${item.instructor}</div>` : ''}
              <div class="er">${formatRoom(item.room)} · ${item.type}</div>
              <button class="ed" data-day="${dayIdx}" data-ti="${encodeURIComponent(item.title)}" title="Delete">✕</button>
            </div>`;
        });
      } else {
        html += `<div class="dc-empty">No classes</div>`;
      }

      html += `</div></div>`;
    });

    DOM.editCols.innerHTML = html;

    // Delete buttons
    DOM.editCols.querySelectorAll('.ed').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetDay = parseInt(btn.dataset.day);
        const title = decodeURIComponent(btn.dataset.ti);
        const dayEntries = schedule[targetDay] || [];
        const removeIdx = dayEntries.findIndex(x => x.title === title);
        if (removeIdx === -1) return;

        const removed = dayEntries[removeIdx];
        const origIdx = removeIdx;
        schedule[targetDay].splice(removeIdx, 1);
        Storage.saveSchedule(); renderEditColumns(); forceUpdate();

        showToast(`Removed "${removed.title}"`, 'info', () => {
          schedule[targetDay].splice(origIdx, 0, removed);
          schedule[targetDay].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
          Storage.saveSchedule(); renderEditColumns(); forceUpdate();
          showToast(`Restored "${removed.title}"`, 'success');
        });
      });
    });

    // Click day column to select it
    DOM.editCols.querySelectorAll('.dc').forEach(col => {
      col.addEventListener('click', e => {
        if (e.target.closest('.ed')) return;
        const nameEl = col.querySelector('.dn');
        if (nameEl) {
          const match = Object.entries(DAY_SHORT).find(([, label]) => label === nameEl.textContent.trim());
          if (match) { selectedDay = parseInt(match[0]); populateDaySelect(); }
        }
      });
    });
  }

  // Add entry
  $id('addB').addEventListener('click', () => {
    const startTime = DOM.editStart.value;
    const endTime = DOM.editEnd.value;
    const title = DOM.editTitle.value.trim();
    const room = DOM.editRoom.value.trim();
    const instructor = DOM.editInstructor.value.trim();
    const classType = DOM.editType.value;
    const targetDay = parseInt(DOM.editDaySelect.value);

    if (!startTime || !endTime || !title) {
      showToast('Please fill out Start Time, End Time, and Title.', 'warning');
      return;
    }

    if (!schedule[targetDay]) schedule[targetDay] = [];
    schedule[targetDay].push({ start: startTime, end: endTime, title, room, instructor, type: classType });
    schedule[targetDay].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();
    Notifications.scheduleForToday();

    DOM.editTitle.value = ''; DOM.editRoom.value = ''; DOM.editInstructor.value = '';
    showToast(`Added "${title}" to ${DAY_NAMES[targetDay]}`, 'success');
  });

  // Clear day
  $id('clrB').addEventListener('click', () => {
    const targetDay = parseInt(DOM.editDaySelect.value);
    if (!schedule[targetDay] || !schedule[targetDay].length) {
      showToast(`${DAY_NAMES[targetDay]} is already empty.`, 'info');
      return;
    }
    const backup = JSON.parse(JSON.stringify(schedule[targetDay]));
    schedule[targetDay] = [];
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();

    showToast(`Cleared all classes for ${DAY_NAMES[targetDay]}`, 'info', () => {
      schedule[targetDay] = backup;
      Storage.saveSchedule(); renderEditColumns(); forceUpdate();
      showToast(`Restored ${DAY_NAMES[targetDay]} schedule`, 'success');
    });
  });

  // Reset to default
  $id('rstB').addEventListener('click', () => {
    const backup = JSON.parse(JSON.stringify(schedule));
    schedule = JSON.parse(JSON.stringify(normalizeSchedule(CONFIG.defaultRoutine)));
    Storage.saveSchedule(); renderEditColumns(); forceUpdate();

    showToast('Reset to default schedule', 'info', () => {
      schedule = backup;
      Storage.saveSchedule(); renderEditColumns(); forceUpdate();
      showToast('Undo successful', 'success');
    });
  });

  // Export JSON
  $id('exB').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'routine-schedule.json';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Exported schedule JSON', 'success');
  });

  // Import JSON
  $id('imB').addEventListener('click', () => DOM.importFile.click());
  DOM.importFile.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        const backup = JSON.parse(JSON.stringify(schedule));

        for (const key in imported) {
          if (Array.isArray(imported[key])) schedule[key] = imported[key];
        }
        for (const dayIdx of CONFIG.activeDays) {
          if (!schedule[dayIdx]) schedule[dayIdx] = [];
        }

        Storage.saveSchedule(); forceUpdate(); renderEditColumns();
        Notifications.scheduleForToday();

        showToast('Imported schedule successfully!', 'success', () => {
          schedule = backup;
          Storage.saveSchedule(); forceUpdate(); renderEditColumns();
          showToast('Undo import', 'success');
        });
      } catch {
        showToast('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });


  /* ══════════════════════════════════════════════════════════════════════════
     18. Modal Management
     ══════════════════════════════════════════════════════════════════════════ */

  function openModal(modalEl, onOpen) {
    isModalOpen = true;
    Particles.stop();
    document.body.style.overflow = 'hidden';
    modalEl.classList.add('open');
    if (onOpen) onOpen();
  }

  function closeModal(modalEl, onClose) {
    isModalOpen = false;
    Particles.start();
    document.body.style.overflow = '';
    modalEl.classList.remove('open');
    if (modalEl === DOM.viewModal) modalEl.classList.remove('rotated-mode');
    if (onClose) onClose();
  }

  // Time Simulator
  $id('clockTrigger').addEventListener('click', () => openModal(DOM.timeModal));
  $id('tcC').addEventListener('click', () => closeModal(DOM.timeModal));
  $id('applyTimeBtn').addEventListener('click', () => {
    const val = DOM.simTimeInput.value;
    if (!val) return;
    simulatedTimeMins = toMinutes(val);
    updateClock(); forceUpdate();
    closeModal(DOM.timeModal);
    showToast(`Time set to ${format12h(val)}`, 'info');
  });
  $id('resetTimeBtn').addEventListener('click', () => {
    simulatedTimeMins = null;
    updateClock(); forceUpdate();
    closeModal(DOM.timeModal);
    showToast('Reset to real time', 'success');
  });

  // View Weekly Matrix
  $id('vrB').addEventListener('click', () => openModal(DOM.viewModal, renderWeeklyMatrix));
  $id('vcC').addEventListener('click', () => closeModal(DOM.viewModal));

  // Edit Schedule
  $id('editBtn').addEventListener('click', () => {
    openModal(DOM.editModal, () => {
      selectedDay = CONFIG.activeDays.includes(new Date().getDay()) ? new Date().getDay() : CONFIG.activeDays[0];
      populateDaySelect();
      renderEditColumns();
    });
  });
  $id('ecC').addEventListener('click', () => closeModal(DOM.editModal));

  // Notification Settings
  $id('notifSettingsBtn').addEventListener('click', () => {
    openModal(DOM.notifModal, () => Notifications.updatePermissionUI());
  });
  $id('notifModalClose').addEventListener('click', () => closeModal(DOM.notifModal));

  // Announcements Modal triggers
  DOM.announcementsBtn.addEventListener('click', () => {
    openModal(DOM.announceModal, () => Announcements.fetchAll());
    Announcements.markAsRead();
  });
  DOM.announceModalClose.addEventListener('click', () => closeModal(DOM.announceModal));

  DOM.newAnnounceBtn.addEventListener('click', () => {
    closeModal(DOM.announceModal);
    openModal(DOM.postAnnounceModal);
  });
  DOM.postAnnounceClose.addEventListener('click', () => {
    closeModal(DOM.postAnnounceModal);
    openModal(DOM.announceModal);
  });
  DOM.postAnnounceCancel.addEventListener('click', () => {
    closeModal(DOM.postAnnounceModal);
    openModal(DOM.announceModal);
  });

  // Handle Announcement Type change to show/hide override options
  DOM.paType.addEventListener('change', () => {
    const val = DOM.paType.value;
    if (val === 'general') {
      DOM.overrideSection.style.display = 'none';
    } else if (val === 'holiday') {
      DOM.overrideSection.style.display = 'block';
      DOM.paSubjectOverrideContainer.style.display = 'none';
    } else if (val === 'cancellation') {
      DOM.overrideSection.style.display = 'block';
      DOM.paSubjectOverrideContainer.style.display = 'block';
    }
  });

  // Submit Post Announcement
  DOM.postAnnounceSubmit.addEventListener('click', async () => {
    const name = DOM.paName.value.trim();
    const title = DOM.paTitle.value.trim();
    const content = DOM.paContent.value.trim();
    const password = DOM.paPassword.value;
    const subject = DOM.paSubject.value.trim();
    const type = DOM.paType.value;
    const date_override = DOM.paDateOverride.value;
    const subject_override = DOM.paSubjectOverride.value.trim();

    if (!name || !title || !content || !password) {
      showToast('Please fill out all required fields.', 'warning');
      return;
    }

    if (type !== 'general' && !date_override) {
      showToast('Please select a Target Date for the schedule override.', 'warning');
      return;
    }

    if (type === 'cancellation' && !subject_override) {
      showToast('Please specify the Subject to Cancel.', 'warning');
      return;
    }

    DOM.postAnnounceSubmit.disabled = true;
    DOM.postAnnounceSubmit.textContent = 'Publishing...';

    const success = await Announcements.publish(name, title, content, password, {
      subject,
      type,
      date_override,
      subject_override
    });

    DOM.postAnnounceSubmit.disabled = false;
    DOM.postAnnounceSubmit.textContent = 'Publish & Notify';

    if (success) {
      DOM.paName.value = '';
      DOM.paSubject.value = '';
      DOM.paTitle.value = '';
      DOM.paContent.value = '';
      DOM.paPassword.value = '';
      DOM.paDateOverride.value = '';
      DOM.paSubjectOverride.value = '';
      DOM.paType.value = 'general';
      DOM.overrideSection.style.display = 'none';
      closeModal(DOM.postAnnounceModal);
      openModal(DOM.announceModal);
    }
  });

  // Close modals on backdrop click
  [DOM.timeModal, DOM.viewModal, DOM.editModal, DOM.notifModal, DOM.announceModal, DOM.postAnnounceModal].forEach(modal => {
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(modal); });
  });


  /* ══════════════════════════════════════════════════════════════════════════
     19. Notification Settings Handlers
     ══════════════════════════════════════════════════════════════════════════ */

  DOM.notifToggle.addEventListener('change', async () => {
    const settings = Storage.getNotifSettings();
    settings.enabled = DOM.notifToggle.checked;

    if (settings.enabled) {
      const granted = await Notifications.requestPermission();
      if (!granted) {
        DOM.notifToggle.checked = false;
        settings.enabled = false;
        showToast('Notification permission denied by browser.', 'error');
      } else {
        showToast('Notifications enabled!', 'success');
        if (NativePush.isSupported()) {
          NativePush.init();
        }
      }
    } else {
      Notifications.cancelAll();
      showToast('Notifications disabled', 'info');
    }

    Storage.saveNotifSettings(settings);
    Notifications.scheduleForToday();
    Notifications.updatePermissionUI();
  });

  DOM.notifLeadTime.addEventListener('change', () => {
    const settings = Storage.getNotifSettings();
    settings.leadTime = parseInt(DOM.notifLeadTime.value);
    Storage.saveNotifSettings(settings);
    Notifications.scheduleForToday();
    showToast(`Alert time: ${settings.leadTime} min before class`, 'info');
  });

  // Notification banner buttons
  $id('notifAllow').addEventListener('click', async () => {
    const granted = await Notifications.requestPermission();
    DOM.notifBanner.classList.remove('show');
    Storage.dismissBanner(Storage.BANNER_DISMISS_KEY);
    if (granted) {
      const settings = Storage.getNotifSettings();
      settings.enabled = true;
      Storage.saveNotifSettings(settings);
      DOM.notifToggle.checked = true;
      Notifications.scheduleForToday();
      if (NativePush.isSupported()) {
        NativePush.init();
      }
      showToast('Notifications enabled!', 'success');
    } else {
      showToast('Permission denied — you can enable later in settings.', 'warning');
    }
  });
  $id('notifDismiss').addEventListener('click', () => {
    DOM.notifBanner.classList.remove('show');
    Storage.dismissBanner(Storage.BANNER_DISMISS_KEY);
  });


  /* ══════════════════════════════════════════════════════════════════════════
     20. PWA Install Prompt
     ══════════════════════════════════════════════════════════════════════════ */

  let deferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!Storage.isBannerDismissed(Storage.INSTALL_DISMISS_KEY)) {
      DOM.installBanner.classList.add('show');
    }
  });

  $id('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    DOM.installBanner.classList.remove('show');
    if (outcome === 'accepted') showToast('App installed!', 'success');
  });

  $id('installDismiss').addEventListener('click', () => {
    DOM.installBanner.classList.remove('show');
    Storage.dismissBanner(Storage.INSTALL_DISMISS_KEY);
  });


  /* ══════════════════════════════════════════════════════════════════════════
     21. Keyboard Shortcuts
     ══════════════════════════════════════════════════════════════════════════ */

  document.addEventListener('keydown', e => {
    // Don't trigger if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      // Close the topmost open modal
      if (DOM.notifModal.classList.contains('open')) closeModal(DOM.notifModal);
      else if (DOM.editModal.classList.contains('open')) closeModal(DOM.editModal);
      else if (DOM.viewModal.classList.contains('open')) closeModal(DOM.viewModal);
      else if (DOM.timeModal.classList.contains('open')) closeModal(DOM.timeModal);
    }
    if (e.key === 'e' || e.key === 'E') {
      if (!isModalOpen) $id('editBtn').click();
    }
    if (e.key === 'v' || e.key === 'V') {
      if (!isModalOpen) $id('vrB').click();
    }
  });


  /* ══════════════════════════════════════════════════════════════════════════
     22. Page Visibility API — Pause/Resume when tab is hidden
     ══════════════════════════════════════════════════════════════════════════ */

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(clockIntervalId);
      clearInterval(dashboardIntervalId);
    } else {
      updateClock();
      forceUpdate();
      updateGreeting();
      updateStats();
      clockIntervalId = setInterval(updateClock, CONFIG.updateIntervalMs);
      dashboardIntervalId = setInterval(updateDashboard, CONFIG.updateIntervalMs);
      // Re-schedule notifications in case the day changed while hidden
      Notifications.scheduleForToday();
    }
  });


  /* ══════════════════════════════════════════════════════════════════════════
     23. Announcements & Push Notifications System
     ══════════════════════════════════════════════════════════════════════════ */

  function getDateForDayIndex(targetDayIdx) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIdx = today.getDay();
    let diff = targetDayIdx - todayIdx;
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    
    const y = targetDate.getFullYear();
    const m = String(targetDate.getMonth() + 1).padStart(2, '0');
    const d = String(targetDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getOverrideFor(dayIdx, subjectCode) {
    if (!Announcements.list || Announcements.list.length === 0) return null;

    const targetDateStr = getDateForDayIndex(dayIdx);

    const holiday = Announcements.list.find(item => 
      item.type === 'holiday' && 
      item.date_override === targetDateStr
    );
    if (holiday) return { type: 'holiday', announcement: holiday };

    if (subjectCode) {
      const cancellation = Announcements.list.find(item => 
        item.type === 'cancellation' && 
        item.date_override === targetDateStr && 
        item.subject_override &&
        item.subject_override.toUpperCase().trim() === subjectCode.toUpperCase().trim()
      );
      if (cancellation) return { type: 'cancellation', announcement: cancellation };
    }

    return null;
  }

  const Announcements = {
    list: [],

    async fetchAll() {
      try {
        const res = await fetch(`${CONFIG.apiBase || ''}/api/announcements`);
        if (!res.ok) throw new Error('Failed to fetch');
        this.list = await res.json();
        this.renderFeed();
        this.checkBadge();
      } catch (err) {
        console.error('Error fetching announcements:', err);
        DOM.announceList.innerHTML = `<div class="announce-empty">Failed to load announcements. Make sure Vercel API backend is running.</div>`;
      }
    },

    renderFeed() {
      if (!this.list || this.list.length === 0) {
        DOM.announceList.innerHTML = `<div class="announce-empty">No announcements yet. Be the first to post!</div>`;
        return;
      }

      let html = '';
      this.list.forEach(item => {
        const dateStr = new Date(item.created_at).toLocaleString();
        html += `
          <div class="announce-card">
            <div class="announce-card-h">
              <div class="announce-card-title">${escapeHtml(item.title)}</div>
              <span class="announce-card-author">${escapeHtml(item.name)}</span>
            </div>
            <div class="announce-card-body">${escapeHtml(item.announcement)}</div>
            <div class="announce-card-date">${dateStr}</div>
          </div>
        `;
      });
      DOM.announceList.innerHTML = html;
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
            subject_override: extras.subject_override || ''
          })
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to post');
        }

        showToast('Announcement published successfully!', 'success');
        this.fetchAll();
        return true;
      } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
        return false;
      }
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const NativePush = {
    isSupported() {
      return window.Capacitor && window.Capacitor.isNativePlatform();
    },

    async init() {
      if (!this.isSupported()) return;

      try {
        const { PushNotifications } = window.Capacitor.Plugins;

        // Request permissions
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive === 'granted') {
          // Register with Google FCM / Apple APNS
          await PushNotifications.register();
        }

        // On success, save the token to the database
        PushNotifications.addListener('registration', async token => {
          console.log('Push registration success, token: ' + token.value);
          try {
            await fetch(`${CONFIG.apiBase || ''}/api/register-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token.value,
                platform: window.Capacitor.getPlatform()
              })
            });
          } catch (err) {
            console.error('Failed to register device token on server:', err);
          }
        });

        // On error
        PushNotifications.addListener('registrationError', error => {
          console.error('Push registration error: ', error);
        });

        // Handle receiving push notifications while app is in foreground
        PushNotifications.addListener('pushNotificationReceived', notification => {
          console.log('Push notification received in foreground: ', notification);
          showToast(`${notification.title}: ${notification.body}`, 'info');
          Announcements.fetchAll();
        });

        // Handle actions when push notification is clicked/tapped
        PushNotifications.addListener('pushNotificationActionPerformed', notification => {
          console.log('Push notification action performed: ', notification);
          openModal(DOM.announceModal);
          Announcements.markAsRead();
        });
      } catch (err) {
        console.error('Error initializing Capacitor Push Notifications plugin:', err);
      }
    }
  };


  /* ══════════════════════════════════════════════════════════════════════════
     24. Debounced Resize Handler
     ══════════════════════════════════════════════════════════════════════════ */

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      Particles.init();
      if (DOM.viewModal.classList.contains('open')) renderWeeklyMatrix();
    }, 200);
  });


  /* ══════════════════════════════════════════════════════════════════════════
     24. Service Worker Registration
     ══════════════════════════════════════════════════════════════════════════ */

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('New update available!', 'info', () => {
              newWorker.postMessage({ action: 'skipWaiting' });
              window.location.reload();
            });
            DOM.undoBtn.textContent = 'RELOAD';
          }
        });
      });
    }).catch(() => {});

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }


  /* ══════════════════════════════════════════════════════════════════════════
     25. App Initialization
     ══════════════════════════════════════════════════════════════════════════ */

  function initializeApp() {
    // Update streak on app open
    Streak.update();

    fetch('config.json?t=' + Date.now())
      .then(res => { if (!res.ok) throw new Error('Config not found'); return res.json(); })
      .then(configData => {
        if (configData.activeDays) {
          CONFIG.activeDays = configData.activeDays;
          if (!CONFIG.activeDays.includes(currentViewDayIdx)) currentViewDayIdx = CONFIG.activeDays[0];
          if (!CONFIG.activeDays.includes(selectedDay)) selectedDay = CONFIG.activeDays[0];
          if (!CONFIG.activeDays.includes(matrixSelectedDayIdx)) matrixSelectedDayIdx = CONFIG.activeDays[0];
        }
        if (configData.matrixIntervals) CONFIG.matrixIntervals = configData.matrixIntervals;
        if (configData.fullCourseNames) {
          Object.keys(FULL_COURSE_NAMES).forEach(k => delete FULL_COURSE_NAMES[k]);
          Object.assign(FULL_COURSE_NAMES, configData.fullCourseNames);
        }
        if (configData.subjectPalettes) {
          SUBJECT_PALETTES.length = 0;
          SUBJECT_PALETTES.push(...configData.subjectPalettes);
        }
        if (configData.labTheme) {
          Object.assign(LAB_THEME, configData.labTheme);
        }
      })
      .catch(err => {
        console.warn('Failed to load dynamic config, using default constants:', err);
      })
      .then(() => {
        return fetch('schedule.json?t=' + Date.now());
      })
      .then(res => { if (!res.ok) throw new Error('Not found'); return res.json(); })
      .then(data => {
        schedule = normalizeSchedule(data);
        Storage.saveSchedule();
        forceUpdate();
      })
      .catch(() => {
        const saved = Storage.loadSchedule();
        if (saved) {
          schedule = saved;
        } else {
          schedule = JSON.parse(JSON.stringify(normalizeSchedule(CONFIG.defaultRoutine)));
          Storage.saveSchedule();
        }
        forceUpdate();
      })
      .finally(() => {
        // Start particles
        Particles.init();
        Particles.start();

        // Start clocks
        updateClock();
        updateGreeting();
        updateStats();
        clockIntervalId = setInterval(updateClock, CONFIG.updateIntervalMs);
        dashboardIntervalId = setInterval(updateDashboard, CONFIG.updateIntervalMs);

        // Initialize notifications & announcements
        Notifications.init();
        Announcements.fetchAll();
      });
  }

  initializeApp();

})();