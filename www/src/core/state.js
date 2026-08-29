export const State = {
  schedule: {},
  announcementsList: [],
  allAnnouncementsList: [],
  undoCallback: null,
  toastTimer: null,
  selectedDay: new Date().getDay(),
  currentViewDayIdx: new Date().getDay(),
  matrixSelectedDayIdx: new Date().getDay(),
  viewDate: new Date(),
  isModalOpen: false,
  lastRenderedMinute: -1,
  clockIntervalId: null,
  dashboardIntervalId: null,
  sessionDeletePassword: '',
  deferredInstallPrompt: null,
  resizeTimer: null,
};
if (typeof window !== 'undefined') {
  window.State = State;
}

