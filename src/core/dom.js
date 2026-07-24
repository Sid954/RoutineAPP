const $id = id => document.getElementById(id);

export const DOM = {
  // Clock & header
  clockHour: $id('hD'),
  clockMin: $id('mD'),
  clockPeriod: $id('apD'),
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
  viewModal: $id('viewModal'),
  editModal: $id('editModal'),
  notifModal: $id('notifModal'),
  classDetailModal: $id('classDetailModal'),
  classDetailClose: $id('classDetailClose'),
  classDetailBody: $id('classDetailBody'),
  confirmModal: $id('confirmModal'),

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
  notifBriefingToggle: $id('notifBriefingToggle'),
  notifBriefingTime: $id('notifBriefingTime'),
  notifClassEndToggle: $id('notifClassEndToggle'),
  notifDayDoneToggle: $id('notifDayDoneToggle'),
  testBriefingBtn: $id('testBriefingBtn'),
  notifPermStatus: $id('notifPermStatus'),
  routineSemesterSelect: $id('routineSemesterSelect'),
  routineSectionSelect: $id('routineSectionSelect'),
  loadRoutineBtn: $id('loadRoutineBtn'),
  saveAllSettingsBtn: $id('saveAllSettingsBtn'),
  saveNotifSettingsBtn: $id('saveNotifSettingsBtn'),

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
  paType: $id('paType'),
  paGeneralSection: $id('paGeneralSection'),
  paTitle: $id('paTitle'),
  paSubject: $id('paSubject'),
  paContent: $id('paContent'),
  paCancellationSection: $id('paCancellationSection'),
  paCancelSubjectSelect: $id('paCancelSubjectSelect'),
  paCancelDate: $id('paCancelDate'),
  paHolidaySection: $id('paHolidaySection'),
  paHolidayRangeType: $id('paHolidayRangeType'),
  paHolidayStartDate: $id('paHolidayStartDate'),
  paHolidayEndDateContainer: $id('paHolidayEndDateContainer'),
  paHolidayEndDate: $id('paHolidayEndDate'),
  paHolidayDetails: $id('paHolidayDetails'),
  paOnlineSection: $id('paOnlineSection'),
  paOnlineSubjectSelect: $id('paOnlineSubjectSelect'),
  paOnlineDate: $id('paOnlineDate'),
  paOnlineLink: $id('paOnlineLink'),
  paOnlineStart: $id('paOnlineStart'),
  paOnlineEnd: $id('paOnlineEnd'),
  paClassTestSection: $id('paClassTestSection'),
  paClassTestDate: $id('paClassTestDate'),
  paClassTestSubjectSelect: $id('paClassTestSubjectSelect'),
  paClassTestName: $id('paClassTestName'),
  paClassTestTopics: $id('paClassTestTopics'),
  paClassTestShowAllSubjects: $id('paClassTestShowAllSubjects'),
  paPassword: $id('paPassword'),
  notifBriefingToggle: $id('notifBriefingToggle'),
  notifBriefingTime: $id('notifBriefingTime'),
  notifClassEndToggle: $id('notifClassEndToggle'),
  notifDayDoneToggle: $id('notifDayDoneToggle'),
  notifHistoryList: $id('notifHistoryList'),
  notifHistoryModal: $id('notifHistoryModal'),

};
