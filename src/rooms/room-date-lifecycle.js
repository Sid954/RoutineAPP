function isSameCalendarDay(first, second) {
  return first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate();
}

function getMinuteOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function resolveFreeRoomsSelection(targetMode, selectedDate, customMinute, now = new Date()) {
  if (targetMode === 'NOW') {
    return {
      date: new Date(now),
      targetMinute: getMinuteOfDay(now)
    };
  }

  return {
    date: selectedDate,
    targetMinute: customMinute
  };
}

export function createCustomFreeRoomsSelection(selectedDate, now = new Date()) {
  return {
    selectedDate,
    targetMode: 'CUSTOM',
    customMinute: isSameCalendarDay(selectedDate, now) ? getMinuteOfDay(now) : 0
  };
}

export function createNowFreeRoomsSelection(now = new Date()) {
  return {
    selectedDate: new Date(now),
    calViewMonth: now.getMonth(),
    calViewYear: now.getFullYear(),
    targetMode: 'NOW',
    customMinute: getMinuteOfDay(now)
  };
}
