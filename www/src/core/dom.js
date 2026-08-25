const $id = id => document.getElementById(id);

export const DOM = {
  // Clock & header
  clockHour: $id('hD'),
  clockMin: $id('mD'),
  clockPeriod: $id('apD'),
  dateDisplay: $id('dateD'),

  // Greeting & stats
  greetText: $id('greetText'),
  greetSub: $id('greetSub'),

  // Current class card
  currentCard: $id('cc'),
  currentTitle: $id('cT'),
  currentRoom: $id('cR'),
  currentTimeRange: $id('cTR'),
  currentElapsed: $id('cEl'),
  currentBar: $id('cBar'),
  currentRemaining: $id('cRm'),

  // Next class card
  nextCard: $id('nc'),
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
  notifPermStatus: $id('notifPermStatus'),
  routineSemesterSelect: $id('routineSemesterSelect'),
  routineSectionSelect: $id('routineSectionSelect'),
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

  // Announcements & App Views
  announcementsAppView: $id('announcementsAppView'),
  postAnnounceAppView: $id('postAnnounceAppView'),
  announcementsBtn: $id('announcementsBtn'),
  announceBadge: $id('announceBadge'),
  dockAnnounceDot: $id('dockAnnounceDot'),
  announcePageBackBtn: $id('announcePageBackBtn'),
  appsHubPageBackBtn: $id('appsHubPageBackBtn'),
  postAnnounceBackBtn: $id('postAnnounceBackBtn'),
  newAnnounceBtn: $id('newAnnounceBtn'),
  announceList: $id('announceList'),
  postAnnounceCancel: $id('postAnnounceCancel'),
  postAnnounceSubmit: $id('postAnnounceSubmit'),
  paEditId: $id('paEditId'),
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
  paClassTestSection: $id('paClassTestSection'),
  paClassTestDate: $id('paClassTestDate'),
  paClassTestSubjectSelect: $id('paClassTestSubjectSelect'),
  paClassTestName: $id('paClassTestName'),
  paClassTestTopics: $id('paClassTestTopics'),
  paClassTestShowAllSubjects: $id('paClassTestShowAllSubjects'),
  paPassword: $id('paPassword'),
};
