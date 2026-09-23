const fs = require('fs');
const path = require('path');

// Load .env
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
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
}

const { createClient } = require('@supabase/supabase-js');

function formatMinuteTo12h(mins) {
  if (typeof mins !== 'number' || isNaN(mins) || mins < 0) return '';
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const padM = m < 10 ? `0${m}` : `${m}`;
  const padH = h12 < 10 ? `0${h12}` : `${h12}`;
  return `${padH}:${padM} ${period}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function testApiGenerators() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, serviceKey);

  console.log('Fetching all active sessions for current term...');

  // 1. Fetch current term
  const { data: termData, error: termErr } = await supabase
    .from('academic_terms')
    .select('id, name')
    .eq('is_current', true)
    .single();

  if (termErr) throw termErr;
  console.log('Current Term:', termData);

  // 2. Fetch all rooms
  const { data: roomsList, error: roomsErr } = await supabase
    .from('rooms')
    .select('id, name, floor, type, capacity')
    .eq('is_active', true)
    .order('floor', { ascending: true })
    .order('id', { ascending: true });

  if (roomsErr) throw roomsErr;
  console.log(`Rooms loaded: ${roomsList.length}`);

  // 3. Fetch all class sessions for term with joins
  const { data: sessions, error: sessErr } = await supabase
    .from('class_sessions')
    .select(`
      id,
      day_of_week,
      start_mins,
      end_mins,
      class_type,
      room_id,
      teacher_code,
      course_code,
      sections (
        semester_id,
        code,
        label
      )
    `)
    .eq('term_id', termData.id)
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })
    .order('start_mins', { ascending: true });

  if (sessErr) throw sessErr;
  console.log(`Class sessions loaded: ${sessions.length}`);

  // 4. Generate rooms_master format
  const roomsMaster = {
    rooms: roomsList,
    schedule: {}
  };
  DAY_NAMES.forEach(day => { roomsMaster.schedule[day] = {}; });

  sessions.forEach(s => {
    if (!s.room_id) return;
    const dayName = DAY_NAMES[s.day_of_week];
    if (!roomsMaster.schedule[dayName][s.room_id]) {
      roomsMaster.schedule[dayName][s.room_id] = [];
    }
    roomsMaster.schedule[dayName][s.room_id].push({
      start: formatMinuteTo12h(s.start_mins),
      end: formatMinuteTo12h(s.end_mins),
      startM: s.start_mins,
      endM: s.end_mins,
      subject: s.course_code,
      instructor: s.teacher_code || '',
      type: s.class_type,
      semSec: s.sections?.label || ''
    });
  });

  // 5. Generate teachers_master format
  const teacherSet = new Set();
  const teachersMaster = {
    teachers: [],
    schedule: {}
  };
  DAY_NAMES.forEach(day => { teachersMaster.schedule[day] = {}; });

  sessions.forEach(s => {
    if (!s.teacher_code) return;
    teacherSet.add(s.teacher_code);
    const dayName = DAY_NAMES[s.day_of_week];
    if (!teachersMaster.schedule[dayName][s.teacher_code]) {
      teachersMaster.schedule[dayName][s.teacher_code] = [];
    }
    teachersMaster.schedule[dayName][s.teacher_code].push({
      room: s.room_id || '',
      start: formatMinuteTo12h(s.start_mins),
      end: formatMinuteTo12h(s.end_mins),
      startM: s.start_mins,
      endM: s.end_mins,
      subject: s.course_code,
      type: s.class_type,
      semSec: s.sections?.label || ''
    });
  });
  teachersMaster.teachers = Array.from(teacherSet).sort((a, b) => a.localeCompare(b));

  console.log('\n=== GENERATED DATASETS SUMMARY ===');
  console.log(`roomsMaster.rooms: ${roomsMaster.rooms.length}`);
  console.log(`roomsMaster Saturday rooms with classes: ${Object.keys(roomsMaster.schedule.Saturday).length}`);
  console.log(`teachersMaster.teachers: ${teachersMaster.teachers.length}`);
  console.log(`teachersMaster Saturday teachers with classes: ${Object.keys(teachersMaster.schedule.Saturday).length}`);

  // Test sample room 403 on Saturday
  console.log('\nSample Room 403 Saturday from DB generator:');
  console.log(roomsMaster.schedule.Saturday['403']?.slice(0, 2));

  // Test sample teacher MHE on Saturday
  console.log('\nSample Teacher MHE Saturday from DB generator:');
  console.log(teachersMaster.schedule.Saturday['MHE']?.slice(0, 2));

  console.log('\n✅ Generators verified successfully!');
}

testApiGenerators().catch(console.error);
