const fs = require('fs');
const path = require('path');

// Automatically load .env from project root if present (no CLI credentials needed)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const { createClient } = require('@supabase/supabase-js');

// Configuration Constants
const TARGET_TERM = {
  id: 'spring_2026',
  name: 'Spring 2026',
  is_current: true
};

const DAY_NAME_TO_INDEX = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6
};

// Ground Truth Expected Counts for Assertion Safeguard
const EXPECTED = {
  semesters: 8,
  sections: 41,
  sessions: 518,
  courses: 70,
  rooms: 33,
  teachers: 84
};

// Helper: Convert "09:45 AM" -> 585 minutes
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

// Helper: Parse time range "09:45 AM - 11:00 AM" or separate start/end
function parseTimeRange(timeStr, startStr, endStr) {
  let s = startStr || '';
  let e = endStr || '';
  if (!s && timeStr) {
    const parts = timeStr.split(' - ');
    if (parts.length >= 2) {
      s = parts[0].trim();
      e = parts[1].trim();
    }
  }
  const start_mins = parseTimeToMins(s);
  const end_mins = parseTimeToMins(e);
  return { start_mins, end_mins, rawStart: s, rawEnd: e };
}

// ----------------------------------------------------------------------------
// 1. Data Extraction & Ground Truth Cross-Check
// ----------------------------------------------------------------------------
function extractScheduleData() {
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  const roomsMetaPath = path.join(dataDir, 'rooms_metadata.json');
  const configJsPath = path.join(__dirname, '..', 'src', 'core', 'config.js');

  // Load static course names map from config.js
  const configContent = fs.readFileSync(configJsPath, 'utf8');
  const courseMatch = configContent.match(/export const FULL_COURSE_NAMES = ({[\s\S]*?});/);
  let knownCourseNames = {};
  if (courseMatch) {
    try {
      knownCourseNames = eval('(' + courseMatch[1] + ')');
    } catch (e) {
      console.warn('Could not parse FULL_COURSE_NAMES from config.js, using fallback.');
    }
  }

  // Load verified room metadata
  const verifiedRooms = JSON.parse(fs.readFileSync(roomsMetaPath, 'utf8'));
  const roomMap = new Map(verifiedRooms.map(r => [r.id, r]));

  const semesters = [];
  const sections = [];
  const coursesMap = new Map();
  const roomsFound = new Set(verifiedRooms.map(r => r.id));
  const teachersFound = new Set();
  const classSessions = [];

  const semDirs = fs.readdirSync(dataDir)
    .filter(d => d.startsWith('sem-'))
    .sort((a, b) => parseInt(a.replace('sem-', ''), 10) - parseInt(b.replace('sem-', ''), 10));

  semDirs.forEach(semDir => {
    const semNum = parseInt(semDir.replace('sem-', ''), 10);
    semesters.push({ id: semNum, label: `Semester ${semNum}`, is_active: true });

    const semPath = path.join(dataDir, semDir);
    const secDirs = fs.readdirSync(semPath)
      .filter(d => fs.statSync(path.join(semPath, d)).isDirectory())
      .sort();

    secDirs.forEach(secDir => {
      const secCode = secDir.toUpperCase();
      const secLabel = `Sem ${semNum}-${secCode}`;
      const secId = `sec_${semNum}_${secCode.toLowerCase()}`;

      sections.push({
        id: secId,
        semester_id: semNum,
        code: secCode,
        label: secLabel,
        is_active: true
      });

      const routinePath = path.join(semPath, secDir, 'routine.json');
      if (!fs.existsSync(routinePath)) return;

      const rawRoutine = JSON.parse(fs.readFileSync(routinePath, 'utf8'));

      Object.keys(rawRoutine).forEach(dayName => {
        const dayIdx = DAY_NAME_TO_INDEX[dayName];
        if (dayIdx === undefined) return;

        const entries = Array.isArray(rawRoutine[dayName]) ? rawRoutine[dayName] : [];

        entries.forEach((cls, entryIdx) => {
          // Normalize Course Code
          const courseCode = (cls.subject || cls.title || 'Class').trim();
          if (!coursesMap.has(courseCode)) {
            coursesMap.set(courseCode, {
              code: courseCode,
              full_name: knownCourseNames[courseCode] || null, // Seed NULL for unmapped codes per user directive
              type_hint: cls.type === 'Lab' ? 'Lab' : 'Theory'
            });
          }

          // Remap Room 03 -> 503 per User Directive
          let rawRoom = (cls.room || '').replace(/^room\s*/i, '').trim();
          if (rawRoom === '03' || rawRoom === '3') {
            console.log(`ℹ️ Remapping Room "${rawRoom}" to "503" for ${secLabel} on ${dayName} (${courseCode})`);
            rawRoom = '503';
          }
          const roomId = rawRoom && rawRoom !== '—' ? rawRoom : null;
          if (roomId) roomsFound.add(roomId);

          // Normalize Teacher Code
          let teacherCode = (cls.instructor || cls.teacher || '').trim();
          if (teacherCode === '—' || teacherCode.toLowerCase() === 'tba' || !teacherCode) {
            teacherCode = null;
          } else {
            teachersFound.add(teacherCode);
          }

          // Parse Times
          const { start_mins, end_mins } = parseTimeRange(cls.time, cls.start, cls.end);
          if (start_mins < 0 || end_mins <= start_mins) {
            throw new Error(`Invalid time bounds in ${secLabel} ${dayName}[${entryIdx}]: ${cls.time || (cls.start + '-' + cls.end)}`);
          }

          classSessions.push({
            term_id: TARGET_TERM.id,
            section_id: secId,
            section_label: secLabel,
            course_code: courseCode,
            room_id: roomId,
            teacher_code: teacherCode,
            day_of_week: dayIdx,
            start_mins,
            end_mins,
            class_type: cls.type || 'Theory',
            is_active: true
          });
        });
      });
    });
  });

  // Prepare full rooms list
  const rooms = Array.from(roomsFound).map(id => {
    const meta = roomMap.get(id);
    if (meta) {
      return {
        id: meta.id,
        name: meta.name,
        floor: meta.floor,
        type: meta.type || 'classroom',
        capacity: meta.capacity || 60,
        is_active: true
      };
    }
    return {
      id,
      name: `Room ${id}`,
      floor: parseInt(id.replace(/[^0-9]/g, '').slice(0, -2) || '0', 10),
      type: 'classroom',
      capacity: 60,
      is_active: true
    };
  }).sort((a, b) => (a.floor - b.floor) || a.id.localeCompare(b.id, undefined, { numeric: true }));

  const courses = Array.from(coursesMap.values()).sort((a, b) => a.code.localeCompare(b.code));

  return {
    term: TARGET_TERM,
    semesters,
    sections,
    rooms,
    courses,
    teachers: Array.from(teachersFound).sort(),
    classSessions
  };
}

// ----------------------------------------------------------------------------
// 2. Strict Assertion Safeguard
// ----------------------------------------------------------------------------
function validateCounts(data) {
  console.log('\n======================================================');
  console.log('🔍 RUNNING PRE-MIGRATION GROUND TRUTH COUNT ASSERTIONS');
  console.log('======================================================');

  const actual = {
    semesters: data.semesters.length,
    sections: data.sections.length,
    sessions: data.classSessions.length,
    courses: data.courses.length,
    rooms: data.rooms.length,
    teachers: data.teachers.length
  };

  console.log(`• Semesters:     Actual = ${actual.semesters.toString().padEnd(4)} | Expected = ${EXPECTED.semesters}`);
  console.log(`• Sections:      Actual = ${actual.sections.toString().padEnd(4)} | Expected = ${EXPECTED.sections}`);
  console.log(`• Class Sessions:Actual = ${actual.sessions.toString().padEnd(4)} | Expected = ${EXPECTED.sessions}`);
  console.log(`• Unique Courses:Actual = ${actual.courses.toString().padEnd(4)} | Expected = ${EXPECTED.courses}`);
  console.log(`• Unique Rooms:  Actual = ${actual.rooms.toString().padEnd(4)} | Expected = ${EXPECTED.rooms}`);
  console.log(`• Unique Teachers:Actual = ${actual.teachers.toString().padEnd(4)} | Expected = ${EXPECTED.teachers}`);

  const mismatches = [];
  Object.keys(EXPECTED).forEach(k => {
    if (actual[k] !== EXPECTED[k]) {
      mismatches.push(`${k}: actual ${actual[k]} !== expected ${EXPECTED[k]}`);
    }
  });

  if (mismatches.length > 0) {
    console.error('\n❌ FATAL COUNT MISMATCH DETECTED:');
    mismatches.forEach(m => console.error(`   - ${m}`));
    console.error('Migration aborted before touching database.');
    process.exit(1);
  }

  console.log('\n✅ ALL GROUND TRUTH ASSERTIONS PASSED WITH 100% ACCURACY.');
}

// ----------------------------------------------------------------------------
// 3. Database Execution (or Dry-Run)
// ----------------------------------------------------------------------------
async function seedDatabase(data, isDryRun) {
  if (isDryRun) {
    console.log('\n======================================================');
    console.log('🏁 DRY-RUN COMPLETE (No changes made to Supabase)');
    console.log('======================================================');
    console.log(`Ready to seed ${data.classSessions.length} sessions across ${data.sections.length} sections into term "${data.term.name}".`);
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    console.error('   Please provide them in your .env file or environment variables.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
  });

  console.log('\n🚀 Starting Supabase Database Upserts...');

  // 1. Upsert Academic Term
  console.log(`1/7 Seeding Academic Term (${data.term.id})...`);
  const { error: termErr } = await supabase.from('academic_terms').upsert([data.term], { onConflict: 'id' });
  if (termErr) throw new Error(`Term upsert error: ${termErr.message}`);

  // 2. Upsert Semesters
  console.log(`2/7 Seeding ${data.semesters.length} Semesters...`);
  const { error: semErr } = await supabase.from('semesters').upsert(data.semesters, { onConflict: 'id' });
  if (semErr) throw new Error(`Semesters upsert error: ${semErr.message}`);

  // 3. Upsert Rooms
  console.log(`3/7 Seeding ${data.rooms.length} Rooms...`);
  const { error: roomErr } = await supabase.from('rooms').upsert(data.rooms, { onConflict: 'id' });
  if (roomErr) throw new Error(`Rooms upsert error: ${roomErr.message}`);

  // 4. Upsert Courses
  console.log(`4/7 Seeding ${data.courses.length} Courses...`);
  const { error: courseErr } = await supabase.from('courses').upsert(data.courses, { onConflict: 'code' });
  if (courseErr) throw new Error(`Courses upsert error: ${courseErr.message}`);

  // 5. Ensure all 84 Teachers exist in faculty_members (Foreign Key requirement)
  console.log(`5/7 Ensuring all ${data.teachers.length} Faculty codes exist in faculty_members...`);
  const teacherPayload = data.teachers.map(code => ({
    teacher_code: code,
    name: code,
    designation: null,
    department: null,
    status: 'Active',
    source: 'unverified_routine_code'
  }));
  const { error: facErr } = await supabase
    .from('faculty_members')
    .upsert(teacherPayload, { onConflict: 'teacher_code', ignoreDuplicates: true });
  if (facErr) {
    console.warn('Notice on faculty_members sync:', facErr.message);
  }

  // 6. Upsert Sections and retrieve generated UUIDs
  console.log(`6/7 Seeding ${data.sections.length} Sections...`);
  const sectionPayload = data.sections.map(s => ({
    semester_id: s.semester_id,
    code: s.code,
    label: s.label,
    is_active: s.is_active
  }));
  const { data: insertedSections, error: secErr } = await supabase
    .from('sections')
    .upsert(sectionPayload, { onConflict: 'semester_id,code' })
    .select('id, semester_id, code, label');
  if (secErr) throw new Error(`Sections upsert error: ${secErr.message}`);

  const sectionMap = new Map();
  insertedSections.forEach(s => {
    sectionMap.set(`Sem ${s.semester_id}-${s.code}`, s.id);
  });

  // 7. Upsert Class Sessions (Batching in chunks of 100)
  console.log(`7/7 Seeding ${data.classSessions.length} Class Sessions...`);
  const sessionPayload = data.classSessions.map(cs => {
    const realSectionId = sectionMap.get(cs.section_label);
    if (!realSectionId) throw new Error(`Missing section UUID mapping for ${cs.section_label}`);
    return {
      term_id: cs.term_id,
      section_id: realSectionId,
      course_code: cs.course_code,
      room_id: cs.room_id,
      teacher_code: cs.teacher_code,
      day_of_week: cs.day_of_week,
      start_mins: cs.start_mins,
      end_mins: cs.end_mins,
      class_type: cs.class_type,
      is_active: cs.is_active
    };
  });

  // Clear previous active sessions for this term to avoid duplicate accumulation
  await supabase.from('class_sessions').delete().eq('term_id', data.term.id);

  const CHUNK_SIZE = 100;
  for (let i = 0; i < sessionPayload.length; i += CHUNK_SIZE) {
    const chunk = sessionPayload.slice(i, i + CHUNK_SIZE);
    const { error: sessErr } = await supabase.from('class_sessions').insert(chunk);
    if (sessErr) throw new Error(`Session chunk insert error: ${sessErr.message}`);
  }

  // Post-Seed Verification Query
  console.log('\n🔎 Running post-seed verification query...');
  const { count, error: countErr } = await supabase
    .from('class_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('term_id', data.term.id)
    .eq('is_active', true);

  if (countErr) throw new Error(`Post-seed count query failed: ${countErr.message}`);
  console.log(`📊 Verified: ${count} active class sessions found in Supabase for term "${data.term.id}".`);

  if (count === EXPECTED.sessions) {
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY WITH 100% INTEGRITY!');
  } else {
    console.warn(`⚠️ Warning: Seeded count (${count}) did not match expected count (${EXPECTED.sessions}).`);
  }
}

// ----------------------------------------------------------------------------
// Main Execution
// ----------------------------------------------------------------------------
async function main() {
  const isDryRun = process.argv.includes('--dry-run') || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  const data = extractScheduleData();
  validateCounts(data);
  await seedDatabase(data, isDryRun);
}

main().catch(err => {
  console.error('\n❌ Seeder execution error:', err);
  process.exit(1);
});
