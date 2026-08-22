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

function fetchUrl(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}


function downloadFile(url, destPath) {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode === 200) {
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
    req.on('error', () => resolve(false));
    req.setTimeout(15000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function updateFacultyDirectoryFromWeb() {
  console.log('Checking faculty updates from https://cse.puc.ac.bd/Home/FacultyMembers ...');

  try {
    const mainHtml = await fetchUrl('https://cse.puc.ac.bd/Home/FacultyMembers', 15000);
    const memberCards = mainHtml.split('<div class="card border-0 shadow-lg').slice(1);
    if (!memberCards.length) throw new Error('No faculty cards found');

    const scrapedList = [];
    for (const card of memberCards) {
      const imgMatch = card.match(/src="([^"]+)"/i);
      const photo = imgMatch ? imgMatch[1].trim() : '';

      const statusMatch = card.match(/title="([^"]+)"/i);
      const status = statusMatch ? statusMatch[1].trim() : 'Active';

      const nameMatch = card.match(/<h5 class="member-name[^>]*>([\s\S]*?)<\/h5>/i);
      const name = nameMatch ? cleanText(nameMatch[1]) : '';

      const descMatch = card.match(/<div class="mb-3 text-center"[^>]*>([\s\S]*?)<\/div>/i);
      let designation = '';
      if (descMatch) {
        designation = descMatch[1].replace(/<br\s*\/?>/gi, ' · ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      }

      const profileMatch = card.match(/href="([^"]*Profile\?userName=([^"&]+))"/i);
      const profilePath = profileMatch ? profileMatch[1] : '';
      const username = profileMatch ? profileMatch[2] : '';
      const profileUrl = profilePath ? `https://cse.puc.ac.bd${profilePath}` : '';

      if (name) {
        scrapedList.push({ name, username, designation, status, photo, profileUrl });
      }
    }

    // Connect to Supabase if configured to log pending suggestions for any website changes
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseServiceKey) {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: currentDbFaculty } = await supabase.from('faculty_members').select('*');
      const dbMap = {};
      (currentDbFaculty || []).forEach(row => {
        if (row.official_username) dbMap[row.official_username.toLowerCase()] = row;
      });

      let newSuggestionsCount = 0;
      const assetsDir = path.join(__dirname, 'src', 'assets', 'faculty');

      for (const f of scrapedList) {
        const existing = dbMap[f.username.toLowerCase()];
        if (!existing) {
          // New faculty member found on university site
          let localAssetPath = f.photo;
          if (f.photo) {
            const extMatch = f.photo.match(/\.(jpe?g|png|webp)/i);
            const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
            const filename = `${f.username.toLowerCase()}.${ext}`;
            const destPath = path.join(assetsDir, filename);
            const downloaded = await downloadFile(f.photo, destPath);
            if (downloaded) localAssetPath = `src/assets/faculty/${filename}`;
          }

          await supabase.from('instructor_edit_suggestions').insert([{
            teacher_code: f.username.toUpperCase(),
            full_name: f.name,
            designation: f.designation,
            photo: localAssetPath,
            source_photo_url: f.photo,
            profile_url: f.profileUrl,
            status: 'pending',
            source: 'build_scraper',
            submitted_at: new Date().toISOString()
          }]);
          newSuggestionsCount++;
        } else {
          // Check for changed designation or changed remote university photo URL
          const desigChanged = f.designation && f.designation !== existing.designation;
          const photoChanged = f.photo && f.photo !== existing.source_photo_url;

          if (desigChanged || photoChanged) {
            let localAssetPath = existing.photo;
            if (photoChanged && f.photo) {
              const extMatch = f.photo.match(/\.(jpe?g|png|webp)/i);
              const ext = extMatch ? extMatch[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
              const codeLower = (existing.teacher_code || f.username).toLowerCase().replace(/[^a-z0-9_]/g, '_');
              const filename = `${codeLower}.${ext}`;
              const destPath = path.join(assetsDir, filename);
              const downloaded = await downloadFile(f.photo, destPath);
              if (downloaded) localAssetPath = `src/assets/faculty/${filename}`;
            }

            await supabase.from('instructor_edit_suggestions').insert([{
              teacher_code: existing.teacher_code,
              full_name: f.name,
              designation: f.designation,
              photo: localAssetPath,
              source_photo_url: f.photo,
              profile_url: f.profileUrl,
              old_data: {
                name: existing.name,
                designation: existing.designation,
                photo: existing.photo,
                source_photo_url: existing.source_photo_url,
                profileUrl: existing.profile_url
              },
              status: 'pending',
              source: 'build_scraper',
              submitted_at: new Date().toISOString()
            }]);
            newSuggestionsCount++;
          }
        }
      }

      if (newSuggestionsCount > 0) {
        console.log(`ℹ️ Build Scraper: Submitted ${newSuggestionsCount} pending suggestion(s) to Admin Review Panel.`);
      } else {
        console.log(`✅ Build Scraper: Verified ${scrapedList.length} faculty members against Supabase (Directory up to date).`);
      }
    } else {
      console.log(`✅ Build Scraper: Verified ${scrapedList.length} official faculty members on PUC website.`);
    }
  } catch (err) {
    console.warn(`ℹ️ Could not check live faculty site (${err.message}). Using current directory.`);
  }
}

async function build() {
  console.log('Building web assets for Capacitor...');

  // Compile master room & teacher schedule indexes
  compileMasterRoomSchedule();
  compileMasterTeacherSchedule();

  // Fetch and update latest faculty data from university website
  await updateFacultyDirectoryFromWeb();

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
