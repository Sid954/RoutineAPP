import { Storage } from '../storage/storage.js';
import { localDateStr } from '../core/utils.js';

export const Streak = {
  update() {
    const data = Storage.getStreak();
    const today = localDateStr();

    if (data.lastDate === today) return data.count;

    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = localDateStr(y);
    data.count = (data.lastDate === yesterday) ? data.count + 1 : 1;
    data.lastDate = today;
    Storage.saveStreak(data);
    return data.count;
  },

  getCount() {
    return Storage.getStreak().count || 0;
  }
};
