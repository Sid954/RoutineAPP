import { Storage } from '../storage/storage.js';

export const Streak = {
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
