#!/usr/bin/env node
/**
 * CONTINUATION TRACKER — RA Modularization
 * Run this at any time to see what's done and what's left.
 * Usage: node check-progress.js
 */
const fs = require('fs');
const path = require('path');

const REQUIRED = [
  // JS files
  'src/features.js',
  'src/core/config.js',
  'src/core/state.js',
  'src/core/utils.js',
  'src/core/dom.js',
  'src/storage/storage.js',
  'src/schedule/normalizer.js',
  'src/schedule/queries.js',
  'src/schedule/themes.js',
  'src/clock/clock.js',
  'src/toast/toast.js',
  'src/modals/modal.js',
  'src/streak/streak.js',
  'src/particles/particles.js',
  'src/dashboard/greeting.js',
  'src/dashboard/stats.js',
  'src/dashboard/current-class.js',
  'src/dashboard/next-class.js',
  'src/dashboard/update.js',
  'src/timeline/course-title.js',
  'src/timeline/timeline.js',
  'src/timeline/day-switcher.js',
  'src/weekly-matrix/matrix.js',
  'src/edit-schedule/editor.js',
  'src/edit-schedule/import-export.js',
  'src/notifications/notification-log.js',
  'src/notifications/notifications.js',
  'src/notifications/native-push.js',
  'src/announcements/overrides.js',
  'src/announcements/announcements.js',
  'src/announcements/post-form.js',
  'src/banners/notif-banner.js',
  'src/banners/install-banner.js',
  'src/events/keyboard.js',
  'src/events/visibility.js',
  'src/events/resize.js',
  'src/events/service-worker.js',
  'src/events/init.js',
  'src/main.js',
  // CSS files
  'src/core/core.css',
  'src/banners/banners.css',
  'src/dashboard/dashboard.css',
  'src/timeline/timeline.css',
  'src/modals/modal.css',
  'src/weekly-matrix/matrix.css',
  'src/edit-schedule/editor.css',
  'src/notifications/notifications.css',
  'src/toast/toast.css',
  'src/announcements/announcements.css',
  'src/main.css',
  // Infrastructure
  // (index.html and build.js updates tracked separately)
];

const base = path.join(__dirname);
let done = 0, missing = [];

REQUIRED.forEach(f => {
  if (fs.existsSync(path.join(base, f))) {
    done++;
  } else {
    missing.push(f);
  }
});

console.log(`\n✅ Done:    ${done} / ${REQUIRED.length}`);
console.log(`❌ Missing: ${missing.length}\n`);
if (missing.length) {
  console.log('Files still needed:');
  missing.forEach(f => console.log('  -', f));
}
