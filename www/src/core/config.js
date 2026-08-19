export const CONFIG = {
  apiBase: 'https://routine-app-iota-one.vercel.app',
  remoteAppUrl: 'https://sid954.github.io/RoutineAPP',
  appVersionCode: 10,
  appVersionName: '1.5.0',
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
  'AI': 'Artificial Intelligence',
  'AIL': 'Artificial Intelligence Laboratory',
  'ALGO': 'Algorithms',
  'ALGOL': 'Algorithms Laboratory',
  'BDA': 'Big Data Analytics',
  'BDAL': 'Big Data Analytics Laboratory',
  'CC': 'Cloud Computing',
  'CCL': 'Cloud Computing Laboratory',
  'CCS': 'Cyber and Computer Security',
  'CN': 'Computer Networks',
  'CNL': 'Computer Networks Laboratory',
  'COA': 'Computer Organization and Architecture',
  'CPL': 'Competitive Programming Laboratory',
  'DBMS': 'Database Management Systems',
  'DBMSL': 'Database Management Systems Laboratory',
  'DC': 'Distributed Computing',
  'DM': 'Discrete Mathematics',
  'DMNT': 'Discrete Mathematics and Number Theory',
  'DS': 'Data Structures',
  'DSL': 'Data Structures Laboratory',
  'EDC': 'Electronic Devices and Circuits',
  'EDCL': 'Electronic Devices and Circuits Laboratory',
  'EE': 'Engineering Economics',
  'HCI': 'Human Computer Interaction',
  'ICMP': 'Introduction to Classical & Modern Physics',
  'IEE': 'Introduction to Electrical Engineering',
  'IEEL': 'Electrical Engineering Laboratory',
  'IP': 'Image Processing',
  'ISD': 'Information Systems Design',
  'MAD': 'Mobile Application Development',
  'ML': 'Machine Learning',
  'MLL': 'Machine Learning Laboratory',
  'MM': 'Multimedia Systems',
  'MML': 'Multimedia Systems Laboratory',
  'NM': 'Numerical Methods',
  'NS': 'Network Security',
  'NSL': 'Network Security Laboratory',
  'OOP': 'Object Oriented Programming',
  'OOPL': 'Object Oriented Programming Laboratory',
  'OS': 'Operating Systems',
  'OSL': 'Operating Systems Laboratory',
  'PF': 'Programming Fundamentals',
  'PFL': 'Programming Fundamentals Laboratory',
  'PHYL': 'Physics Laboratory',
  'SE': 'Software Engineering',
  'SEL': 'Software Engineering Laboratory',
  'STQA': 'Software Testing and Quality Assurance',
  'STQAL': 'Software Testing and Quality Assurance Laboratory',
  'TC': 'Telecommunication Engineering'
};

export const DAY_NAMES = { 6: 'Saturday', 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
export const DAY_SHORT = { 6: 'Sat', 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri' };
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DAY_MAP = { Saturday: 6, Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };

export const SUBJECT_PALETTES = [
  { bg: 'linear-gradient(135deg, #1e1b4b, #312e81)', border: '#818cf8', text: '#e0e7ff', badge: 'rgba(129,140,248,0.35)' }, // 0: Royal Indigo / Blue
  { bg: 'linear-gradient(135deg, #042f2e, #0e7490)', border: '#22d3ee', text: '#ecfeff', badge: 'rgba(34,211,238,0.35)' },  // 1: Cyan / Turquoise 
  { bg: 'linear-gradient(135deg, #0f4c5c, #0d9488)', border: '#2dd4bf', text: '#ccfbf1', badge: 'rgba(45,212,191,0.35)' },  // 2: Deep Ocean Teal
  { bg: 'linear-gradient(135deg, #2e1065, #6d28d9)', border: '#c084fc', text: '#f5f3ff', badge: 'rgba(192,132,252,0.35)' }, // 3: Electric Violet 
  { bg: 'linear-gradient(135deg, #4c0519, #be123c)', border: '#fb7185', text: '#fff1f2', badge: 'rgba(251,113,133,0.35)' }, // 4: Ruby Crimson 
  { bg: 'linear-gradient(135deg, #4a044e, #a21caf)', border: '#f0abfc', text: '#fdf4ff', badge: 'rgba(240,171,252,0.35)' }, // 5: Fuchsia Magenta 
  { bg: 'linear-gradient(135deg, #022c22, #15803d)', border: '#4ade80', text: '#f0fdf4', badge: 'rgba(74,222,128,0.35)' },  // 6: Emerald Green 
  { bg: 'linear-gradient(135deg, #0c4a6e, #1d4ed8)', border: '#60a5fa', text: '#eff6ff', badge: 'rgba(96,165,250,0.35)' },  // 7: Sapphire Azure 
  { bg: 'linear-gradient(135deg, #581c87, #7e22ce)', border: '#c084fc', text: '#f5f3ff', badge: 'rgba(192,132,252,0.35)' }, // 8: Berry Plum
  { bg: 'linear-gradient(135deg, #3b0764, #7e22ce)', border: '#e879f9', text: '#fdf4ff', badge: 'rgba(232,121,249,0.35)' }, // 9: Deep Violet
  { bg: 'linear-gradient(135deg, #0f172a, #334155)', border: '#94a3b8', text: '#f8fafc', badge: 'rgba(148,163,184,0.35)' }, // 10: Slate Steel
  { bg: 'linear-gradient(135deg, #14532d, #16a34a)', border: '#86efac', text: '#f0fdf4', badge: 'rgba(134,239,172,0.35)' }  // 11: Dark Lime
];

export const LAB_THEME = { bg: 'linear-gradient(135deg, #4c0519, #881337, #9f1239)', border: '#f43f5e', text: '#ffffff', badge: 'rgba(244,63,94,0.5)', isLab: true };
