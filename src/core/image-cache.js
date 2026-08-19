import { getTeacherInfo } from '../teachers/teacher-names.js';

const _preloadedUrls = new Set();

/**
 * Preloads an image URL into browser cache and service worker asynchronously
 */
export function preloadImage(url) {
  if (!url || typeof url !== 'string' || _preloadedUrls.has(url)) return;
  _preloadedUrls.add(url);

  try {
    const img = new Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = url;
  } catch (e) {}
}

/**
 * Preloads instructor avatars for active classes on a given day/week
 */
export function preloadScheduleImages(scheduleMapOrList) {
  if (!scheduleMapOrList) return;

  const runIdle = (typeof window !== 'undefined' && window.requestIdleCallback)
    ? window.requestIdleCallback
    : (cb => setTimeout(cb, 150));

  runIdle(() => {
    try {
      const teacherCodes = new Set();

      if (Array.isArray(scheduleMapOrList)) {
        scheduleMapOrList.forEach(cls => {
          const code = (cls.instructor || cls.teacher || '').trim();
          if (code && code !== '—' && code.toLowerCase() !== 'tba') {
            teacherCodes.add(code);
          }
        });
      } else if (typeof scheduleMapOrList === 'object') {
        Object.values(scheduleMapOrList).forEach(dayClasses => {
          if (Array.isArray(dayClasses)) {
            dayClasses.forEach(cls => {
              const code = (cls.instructor || cls.teacher || '').trim();
              if (code && code !== '—' && code.toLowerCase() !== 'tba') {
                teacherCodes.add(code);
              }
            });
          }
        });
      }

      teacherCodes.forEach(code => {
        const info = getTeacherInfo(code);
        if (info && info.photo && info.photo.startsWith('http')) {
          preloadImage(info.photo);
        }
      });
    } catch (e) {
      console.warn('Preload schedule images encountered an issue:', e);
    }
  });
}
