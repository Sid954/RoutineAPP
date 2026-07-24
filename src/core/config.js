export const CONFIG = {
  apiBase: 'https://routine-app-iota-one.vercel.app',
  remoteAppUrl: 'https://sid954.github.io/RoutineAPP',
  appVersionCode: 8,
  appVersionName: '1.2.0',
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
  updateIntervalMs: 10000,
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

export const FULL_COURSE_NAMES = {
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

export const DAY_NAMES = { 6: 'Saturday', 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
export const DAY_SHORT = { 6: 'Sat', 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' };
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DAY_MAP = { Saturday: 6, Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };

export const SUBJECT_PALETTES = [
  { bg: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '#818cf8', text: '#e0e7ff', badge: 'rgba(129,140,248,0.35)' }, // Indigo
  { bg: 'linear-gradient(135deg, #022c22, #0d9488)', border: '#2dd4bf', text: '#ccfbf1', badge: 'rgba(45,212,191,0.35)' }, // Teal/Emerald
  { bg: 'linear-gradient(135deg, #451a03, #d97706)', border: '#fbbf24', text: '#fef3c7', badge: 'rgba(251,191,36,0.35)' }, // Orange/Amber
  { bg: 'linear-gradient(135deg, #2e1065, #7c3aed)', border: '#a78bfa', text: '#f5f3ff', badge: 'rgba(167,139,250,0.35)' }, // Purple/Violet
  { bg: 'linear-gradient(135deg, #0f172a, #475569)', border: '#94a3b8', text: '#f8fafc', badge: 'rgba(148,163,184,0.35)' }, // Slate Blue/Grey
  { bg: 'linear-gradient(135deg, #4a044e, #c026d3)', border: '#e879f9', text: '#fdf4ff', badge: 'rgba(232,121,249,0.35)' }  // Fuchsia/Magenta
];

export const LAB_THEME = { bg: 'linear-gradient(135deg, #4c0519, #881337, #9f1239)', border: '#f43f5e', text: '#ffffff', badge: 'rgba(244,63,94,0.5)', isLab: true };
