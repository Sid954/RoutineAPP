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

function cleanText(str) {
  if (!str) return '';
  return str.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function updateFacultyDirectoryFromWeb() {
  console.log('Fetching latest faculty info from https://cse.puc.ac.bd/Home/FacultyMembers ...');
  try {
    const mainHtml = await fetchUrl('https://cse.puc.ac.bd/Home/FacultyMembers', 10000);
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
        scrapedList.push({ name, username, designation, status, photo, profileUrl, emails: [], phone: '', socialLinks: {} });
      }
    }

    const GENERIC_PHONES = [
      '01313044515', '01313044516', '01313044517', '01313044518', '01313044519',
      '09610828282', '01335084717', '8809610828282', '8801313044515'
    ];

    // Fast parallel profile detail fetching
    const batchSize = 10;
    for (let i = 0; i < scrapedList.length; i += batchSize) {
      const batch = scrapedList.slice(i, i + batchSize);
      await Promise.all(batch.map(async f => {
        if (!f.profileUrl) return;
        try {
          const pHtml = await fetchUrl(f.profileUrl, 6000);
          
          // Authentic Teacher Emails
          const emailMatches = pHtml.match(/fa-envelope[^<]*<\/i>\s*([\s\S]*?)<\/span>/i);
          if (emailMatches) {
            f.emails = cleanText(emailMatches[1])
              .split(/[,;\s]+/)
              .map(e => e.trim())
              .filter(e => e.includes('@') && !e.toLowerCase().includes('info@puc.ac.bd') && !e.toLowerCase().includes('controller@puc.ac.bd'));
          }

          // Filter out generic university hotline phone numbers
          const phoneMatches = pHtml.match(/fa-phone[^<]*<\/i>\s*([\s\S]*?)<\/span>/i);
          if (phoneMatches) {
            const rawPhone = cleanText(phoneMatches[1]);
            const isGeneric = GENERIC_PHONES.some(p => rawPhone.replace(/\D/g, '').includes(p)) || rawPhone.toLowerCase().includes('puc.ac.bd') || rawPhone.toLowerCase().includes('student login');
            if (!isGeneric) {
              const phoneMatch = rawPhone.match(/(\+?\d[\d\s-]{7,})/);
              if (phoneMatch) f.phone = phoneMatch[1].trim();
            } else {
              f.phone = '';
            }
          }
        } catch (e) {}
      }));
    }

    // 100% strict, unambiguous verified 1-to-1 letter matches ONLY.
    const exactFacultyMap = {
      "AD": { name: "Avisheak Das", username: "Avisheak-cse" },
      "AHK": { name: "Adnan Hossain Khan", username: "adnan_cse" },
      "AIB": { name: "Md. Ariful Islam Bhuyan", username: "arif_cse" },
      "AJT": { name: "Ms. Asma Joshita Trisha", username: "asma_cse" },
      "AKK": { name: "N.U.M Akramul Kabir Khan", username: "akram_cse" },
      "AMS": { name: "Asif Mohammed Saad", username: "asif_saad_cse" },
      "AU": { name: "Afsar Uddin", username: "afsar_cse" },
      "Ataur": { name: "Md. Ataur Rahman", username: "ataur_cse" },
      "AZMAIN": { name: "Azmain Yakin Srizon", username: "" },
      "CFK": { name: "Chowdhury Fariha Kamrul", username: "fariha_cse" },
      "EAS": { name: "Estiak Ahamed Sazid", username: "estiaksazid" },
      "FSC": { name: "Ms. Farhana Shirin Chowdhury", username: "shirin_cse" },
      "IFTEKAR MIA": { name: "Iftekar Mia", username: "" },
      "JTC": { name: "Jannat Tohfa Chowdhury", username: "jannattohfa" },
      "KD": { name: "Kingshuk Dhar", username: "kingshuk_cse" },
      "KMAY": { name: "Kazi Md. Abrar Yeaser", username: "abrar_cse" },
      "KMN": { name: "Kafayet Monoar Nahin", username: "kafayet_cse" },
      "MFF": { name: "Mohammd Fahim Foisal", username: "fahim_csecu_gt" },
      "MH": { name: "Mohammad Hasan", username: "hasan_cse" },
      "MHE": { name: "Mahmudul Hasan Emon", username: "mahmudul_hasan_cse" },
      "MHN": { name: "Md. Hasan", username: "mdhasan_cse" },
      "MRI": { name: "Md. Raisul Islam", username: "raisulislam_cse" },
      "MRRC": { name: "Mohammed Rezaur Rahman Chowdhury", username: "Rezaur_cse" },
      "MTS": { name: "Md Toukir Shah", username: "mdtoukirshah_cse" },
      "NAK": { name: "Nazma Akther", username: "nazma_fbs" },
      "NBH": { name: "Nadim Bin Hossain", username: "nadim_cse" },
      "NJS": { name: "Ms. Nusrat Jahan Shirin", username: "nusrat_cse" },
      "NR": { name: "Noortaz Rezoana", username: "noortaz_cse" },
      "RA": { name: "Rowshon Akter", username: "roshni" },
      "RM": { name: "Rashed Miah", username: "rashed_cse" },
      "SMAI": { name: "Dr. Shahid Md. Asif Iqbal", username: "asif_cse" },
      "ST": { name: "Ms. Sabrina Tarannum", username: "sabrina_cse" },
      "TDM": { name: "Ms. Tanni Dhoom", username: "tanni_cse" },
      "TH": { name: "Ms. Tashin Hossain", username: "tashin_hossain_cse" },
      "THA": { name: "Tanvir Hassan Ananta", username: "tanvirhassan_cse" },
      "TMC": { name: "Tahiat Mahabub Chowdhury", username: "tahiatmahabub_cse" },
      "TMH": { name: "MD Tamim Hossain", username: "tamim_hossain" },
      "WMN": { name: "Wong May Nu", username: "wong_cse" },
      "YR": { name: "Yakinur Rahman", username: "yakinur_cse" }
    };

    const teacherMasterPath = path.join(__dirname, 'master_teachers_schedule.json');
    const teacherMaster = fs.existsSync(teacherMasterPath) ? JSON.parse(fs.readFileSync(teacherMasterPath, 'utf8')) : { teachers: [] };
    const richFacultyData = {};

    // 1. Insert all 42 scraped official faculty members from the website
    scrapedList.forEach(f => {
      const matchingCodes = Object.keys(exactFacultyMap).filter(code => exactFacultyMap[code].username && exactFacultyMap[code].username.toLowerCase() === f.username.toLowerCase());
      const primaryCode = matchingCodes[0] || '';
      const customName = (exactFacultyMap[primaryCode] && exactFacultyMap[primaryCode].name) || f.name;

      const profileObj = {
        code: primaryCode,
        officialUsername: f.username,
        name: customName,
        designation: f.designation || 'Faculty Member',
        photo: f.photo || '',
        status: f.status || 'Active',
        emails: f.emails || [],
        phone: f.phone || '',
        profileUrl: f.profileUrl || '',
        socialLinks: f.socialLinks || {}
      };

      richFacultyData[f.username] = profileObj;
      if (primaryCode) richFacultyData[primaryCode] = profileObj;
      matchingCodes.forEach(c => {
        richFacultyData[c] = { ...profileObj, code: c };
      });
    });

    // 2. Insert all routine teacher codes that are not already listed
    teacherMaster.teachers.forEach(code => {
      if (!richFacultyData[code]) {
        const mapEntry = exactFacultyMap[code];
        let defaultName = (mapEntry && mapEntry.name) || code;
        if (code === 'AZMAIN') defaultName = 'Azmain Yakin Srizon';
        if (code === 'IFTEKAR MIA') defaultName = 'Iftekar Mia';

        richFacultyData[code] = {
          code: code,
          officialUsername: (mapEntry && mapEntry.username) || '',
          name: defaultName,
          designation: 'Faculty Member',
          photo: '',
          status: 'Active',
          emails: [],
          phone: '',
          profileUrl: '',
          socialLinks: {}
        };
      }
    });

    // Link local bundled faculty photo assets if present
    const assetsDir = path.join(__dirname, 'src', 'assets', 'faculty');
    if (fs.existsSync(assetsDir)) {
      const localFiles = fs.readdirSync(assetsDir);
      for (const [key, info] of Object.entries(richFacultyData)) {
        const cleanKey = (info.code || info.officialUsername || key).toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const matchedFile = localFiles.find(f => {
          const base = path.basename(f, path.extname(f)).toLowerCase();
          return base === cleanKey || base === key.toLowerCase();
        });
        if (matchedFile) {
          info.photo = `src/assets/faculty/${matchedFile}`;
        }
      }
    }

    const outPath = path.join(__dirname, 'src', 'data', 'faculty_rich_map.json');
    fs.writeFileSync(outPath, JSON.stringify(richFacultyData, null, 2), 'utf8');

    const rootOut = path.join(__dirname, 'faculty_info.json');
    fs.writeFileSync(rootOut, JSON.stringify(richFacultyData, null, 2), 'utf8');

    console.log(`✅ Updated faculty directory with ${Object.keys(richFacultyData).length} faculty members from PUC CSE website!`);
  } catch (err) {
    console.warn(`ℹ️ Could not fetch latest faculty updates from university site (${err.message}). Using existing faculty_info.json.`);
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
