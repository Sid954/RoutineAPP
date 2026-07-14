import { FULL_COURSE_NAMES } from '../core/config.js';

export function toggleCourseTitle(element, shortTitle) {
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
export function bindCourseTitleClicks(container) {
  container.querySelectorAll('.course-click-title').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      toggleCourseTitle(el, el.dataset.title);
    });
  });
}
