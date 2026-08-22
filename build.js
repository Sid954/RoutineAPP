const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'www');

// Individual files to copy (not folders)
const FILES_TO_COPY = [
  'index.html',
  'schedule.json',
  'config.json',
  'manifest.json',
  'version.json',
  'sw.js',
  'master_rooms_schedule.json',
  'master_teachers_schedule.json',
  'faculty_info.json',
  'icon-192.png',
  'icon-512.png',
];

// Directories to copy recursively
const DIRS_TO_COPY = [
  'src',
];

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function compileMasterRoomSchedule() {
  const master = { rooms: [], schedule: {} };
  const roomSet = new Set();
  const dataDir = path.join(__dirname, 'src', 'data');

  function parseTimeToMins(str) {
    if (!str) return -1;
    const match = str.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const period = match[3] ? match[3].toUpperCase() : null;
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    return -1;
  }

  function parseRoutine(routineObj, semSec) {
    Object.keys(routineObj).forEach(day => {
      if (!master.schedule[day]) master.schedule[day] = {};
      const arr = routineObj[day];
      if (Array.isArray(arr)) {
        arr.forEach(cls => {
          let room = (cls.room || '').replace(/^room\s*/i, '').trim();
          if (!room || room === '—' || room.toLowerCase() === 'no room' || room === '03' || room === '3') return;
          roomSet.add(room);
          if (!master.schedule[day][room]) master.schedule[day][room] = [];

          let startStr = cls.start || '';
          let endStr = cls.end || '';
          if (!startStr && cls.time) {
            const timeParts = cls.time.split('-');
            if (timeParts.length >= 2) {
              startStr = timeParts[0].trim();
              endStr = timeParts[1].trim();
            }
          }
          const startM = parseTimeToMins(startStr);
          const endM = parseTimeToMins(endStr);
          if (startM >= 0 && endM > startM) {
            master.schedule[day][room].push({
              start: startStr,
              end: endStr,
              startM,
              endM,
              subject: cls.subject || cls.title || 'Class',
              instructor: cls.instructor || '',
              type: cls.type || 'Theory',
              semSec: semSec
            });
          }
        });
      }
    });
  }

  function scanDir(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name === 'routine.json') {
        try {
          const parts = fullPath.split(path.sep);
          const semIdx = parts.findIndex(p => p.startsWith('sem-'));
          let semSec = 'Class';
          if (semIdx !== -1 && parts[semIdx + 1]) {
            const semNum = parts[semIdx].replace('sem-', '');
            const secName = parts[semIdx + 1].toUpperCase();
            semSec = `Sem ${semNum}-${secName}`;
          }
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          parseRoutine(content, semSec);
        } catch (e) {}
      }
    }
  }

  scanDir(dataDir);

  master.rooms = Array.from(roomSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const outPath = path.join(__dirname, 'master_rooms_schedule.json');
  fs.writeFileSync(outPath, JSON.stringify(master, null, 2), 'utf8');
  console.log(`Compiled master_rooms_schedule.json with ${master.rooms.length} unique rooms across all semesters.`);
}

function compileMasterTeacherSchedule() {
  const master = { teachers: [], schedule: {} };
  const teacherSet = new Set();
  const dataDir = path.join(__dirname, 'src', 'data');

  function parseTimeToMins(str) {
    if (!str) return -1;
    const match = str.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([ap]m))?$/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const period = match[3] ? match[3].toUpperCase() : null;
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    return -1;
  }

  function parseRoutine(routineObj, semSec) {
    Object.keys(routineObj).forEach(day => {
      if (!master.schedule[day]) master.schedule[day] = {};
      const arr = routineObj[day];
      if (Array.isArray(arr)) {
        arr.forEach(cls => {
          const teacher = (cls.instructor || '').trim();
          const room = (cls.room || '').replace(/^room\s*/i, '').trim();
          if (!teacher || teacher === '—' || teacher.toLowerCase() === 'tba') return;
          teacherSet.add(teacher);
          if (!master.schedule[day][teacher]) master.schedule[day][teacher] = [];

          let startStr = cls.start || '';
          let endStr = cls.end || '';
          if (!startStr && cls.time) {
            const timeParts = cls.time.split('-');
            if (timeParts.length >= 2) {
              startStr = timeParts[0].trim();
              endStr = timeParts[1].trim();
            }
          }
          const startM = parseTimeToMins(startStr);
          const endM = parseTimeToMins(endStr);
          if (startM >= 0 && endM > startM) {
            const alreadyExists = master.schedule[day][teacher].some(c => c.startM === startM && c.endM === endM);
            if (!alreadyExists) {
              master.schedule[day][teacher].push({
                room: (room && room !== '—' && room !== '03' && room !== '3') ? room : '',
                start: startStr,
                end: endStr,
                startM,
                endM,
                subject: cls.subject || cls.title || 'Class',
                type: cls.type || 'Theory',
                semSec: semSec
              });
            }
          }
        });
      }
    });
  }

  function scanDir(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name === 'routine.json') {
        try {
          const parts = fullPath.split(path.sep);
          const semIdx = parts.findIndex(p => p.startsWith('sem-'));
          let semSec = 'Class';
          if (semIdx !== -1 && parts[semIdx + 1]) {
            const semNum = parts[semIdx].replace('sem-', '');
            const secName = parts[semIdx + 1].toUpperCase();
            semSec = `Sem ${semNum}-${secName}`;
          }
          const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          parseRoutine(content, semSec);
        } catch (e) {}
      }
    }
  }

  scanDir(dataDir);

  master.teachers = Array.from(teacherSet).sort((a, b) => a.localeCompare(b));

  const outPath = path.join(__dirname, 'master_teachers_schedule.json');
  fs.writeFileSync(outPath, JSON.stringify(master, null, 2), 'utf8');
  console.log(`Compiled master_teachers_schedule.json with ${master.teachers.length} unique faculty members.`);
}

const https = require('https');

// Optional manual faculty sync when invoked with --scrape-faculty flag
async function handleOptionalFacultyScrape() {
  if (process.argv.includes('--scrape-faculty')) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && supabaseServiceKey) {
      try {
        console.log('Running manual faculty directory sync (--scrape-faculty)...');
        const { createClient } = require('@supabase/supabase-js');
        const { syncFacultyWithSupabase } = require('./api/_lib/faculty-scraper.js');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const result = await syncFacultyWithSupabase(supabase);
        console.log(`✅ Faculty sync finished: ${result.scrapedCount} checked, ${result.newSuggestionsCount} new suggestions created.`);
      } catch (e) {
        console.warn('⚠️ Manual faculty sync notice:', e.message);
      }
    } else {
      console.log('ℹ️ Skipped --scrape-faculty: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
    }
  }
}

async function build() {
  console.log('Building web assets for Capacitor...');

  // Compile master room & teacher schedule indexes
  compileMasterRoomSchedule();
  compileMasterTeacherSchedule();

  // Run faculty scraper only if explicitly requested
  await handleOptionalFacultyScrape();

  // Create or clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR);

  // Copy individual files
  FILES_TO_COPY.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(DIST_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied: ${file}`);
    } else {
      console.warn(`Warning: file not found: ${file}`);
    }
  });

  // Copy directories recursively
  DIRS_TO_COPY.forEach(dir => {
    const src = path.join(__dirname, dir);
    const dest = path.join(DIST_DIR, dir);
    if (fs.existsSync(src)) {
      copyDir(src, dest);
      console.log(`Copied dir: ${dir}/`);
    } else {
      console.warn(`Warning: directory not found: ${dir}`);
    }
  });

  const versionId = Date.now();

  // Inject dynamic CACHE_VERSION into output sw.js
  const swPath = path.join(DIST_DIR, 'sw.js');
  if (fs.existsSync(swPath)) {
    let swContent = fs.readFileSync(swPath, 'utf8');
    swContent = swContent.replace(/const CACHE_VERSION = '[^']*'/, `const CACHE_VERSION = 'routine-cache-${versionId}'`);
    fs.writeFileSync(swPath, swContent, 'utf8');
    console.log(`Injected dynamic CACHE_VERSION: routine-cache-${versionId} into www/sw.js`);
  }

  // Read version.json as single source of truth and sync to build.gradle & config.js
  const versionJsonPath = path.join(__dirname, 'version.json');
  if (fs.existsSync(versionJsonPath)) {
    try {
      const vData = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
      const vCode = vData.versionCode || 1;
      const vName = vData.versionName || '1.0.0';

      // Sync version to android/app/build.gradle
      const gradlePath = path.join(__dirname, 'android', 'app', 'build.gradle');
      if (fs.existsSync(gradlePath)) {
        let gContent = fs.readFileSync(gradlePath, 'utf8');
        gContent = gContent.replace(/versionCode \d+/, `versionCode ${vCode}`);
        gContent = gContent.replace(/versionName "[^"]+"/, `versionName "${vName}"`);
        fs.writeFileSync(gradlePath, gContent, 'utf8');
        console.log(`Synced Gradle to versionCode ${vCode}, versionName "${vName}"`);
      }

      // Sync version to src/core/config.js
      const configJsPath = path.join(__dirname, 'src', 'core', 'config.js');
      if (fs.existsSync(configJsPath)) {
        let cContent = fs.readFileSync(configJsPath, 'utf8');
        cContent = cContent.replace(/appVersionCode:\s*\d+/, `appVersionCode: ${vCode}`);
        cContent = cContent.replace(/appVersionName:\s*['"][^'"]+['"]/, `appVersionName: '${vName}'`);
        fs.writeFileSync(configJsPath, cContent, 'utf8');
      }

      // Sync version to www/src/core/config.js
      const wwwConfigJsPath = path.join(DIST_DIR, 'src', 'core', 'config.js');
      if (fs.existsSync(wwwConfigJsPath)) {
        let wcContent = fs.readFileSync(wwwConfigJsPath, 'utf8');
        wcContent = wcContent.replace(/appVersionCode:\s*\d+/, `appVersionCode: ${vCode}`);
        wcContent = wcContent.replace(/appVersionName:\s*['"][^'"]+['"]/, `appVersionName: '${vName}'`);
        fs.writeFileSync(wwwConfigJsPath, wcContent, 'utf8');
        console.log(`Synced CONFIG to appVersionCode ${vCode}, appVersionName '${vName}'`);
      }
    } catch (e) {
      console.warn('Could not sync version.json:', e);
    }
  }

  // Also update root sw.js so GitHub Pages serves fresh cache version
  const rootSwPath = path.join(__dirname, 'sw.js');
  if (fs.existsSync(rootSwPath)) {
    let rootSwContent = fs.readFileSync(rootSwPath, 'utf8');
    rootSwContent = rootSwContent.replace(/const CACHE_VERSION = '[^']*'/, `const CACHE_VERSION = 'routine-cache-${versionId}'`);
    fs.writeFileSync(rootSwPath, rootSwContent, 'utf8');
    console.log(`Injected dynamic CACHE_VERSION: routine-cache-${versionId} into root sw.js`);
  }

  // Copy web assets directly to Android assets/public for instant APK builds
  const androidPublicDir = path.join(__dirname, 'android', 'app', 'src', 'main', 'assets', 'public');
  if (fs.existsSync(path.dirname(androidPublicDir))) {
    copyDir(DIST_DIR, androidPublicDir);
    console.log('Synced web assets directly to android/app/src/main/assets/public/');
  }

  // Restore all custom Android native & Widget files from android-custom/
  const androidCustomDir = path.join(__dirname, 'android-custom');
  const androidMainDir = path.join(__dirname, 'android', 'app', 'src', 'main');
  if (fs.existsSync(androidCustomDir) && fs.existsSync(androidMainDir)) {
    // 1. Copy Java files
    const customJava = path.join(androidCustomDir, 'java');
    const mainJava = path.join(androidMainDir, 'java');
    if (fs.existsSync(customJava)) copyDir(customJava, mainJava);

    // 2. Copy res files (layouts, widgets, drawables, strings)
    const customRes = path.join(androidCustomDir, 'res');
    const mainRes = path.join(androidMainDir, 'res');
    if (fs.existsSync(customRes)) copyDir(customRes, mainRes);

    // 3. Copy AndroidManifest.xml
    const customManifest = path.join(androidCustomDir, 'AndroidManifest.xml');
    const mainManifest = path.join(androidMainDir, 'AndroidManifest.xml');
    if (fs.existsSync(customManifest)) fs.copyFileSync(customManifest, mainManifest);

    console.log('✅ Injected custom Android & Widget native files from android-custom/ to android/app/src/main/');
  }

  console.log('Build completed! Web assets are in the /www folder.');
}

build();
