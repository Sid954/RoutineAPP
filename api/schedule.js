const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

function formatMinuteTo24h(mins) {
  if (typeof mins !== 'number' || isNaN(mins) || mins < 0) return '';
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const padM = m < 10 ? `0${m}` : `${m}`;
  const padH = h < 10 ? `0${h}` : `${h}`;
  return `${padH}:${padM}`;
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials are not configured on the server.' });
  }

  const { action, semester, section, term_id } = req.query;

  try {
    // 1. Resolve Target Academic Term
    let targetTermId = term_id;
    if (!targetTermId) {
      const { data: currentTerm, error: termErr } = await supabase
        .from('academic_terms')
        .select('id')
        .eq('is_current', true)
        .single();
      if (termErr && termErr.code !== 'PGRST116') throw termErr;
      targetTermId = currentTerm ? currentTerm.id : 'spring_2026';
    }

    // ------------------------------------------------------------------------
    // Action: rooms_master (Department-wide Free Rooms dataset)
    // ------------------------------------------------------------------------
    if (action === 'rooms_master') {
      const { data: roomsList, error: roomsErr } = await supabase
        .from('rooms')
        .select('id, name, floor, type, capacity')
        .eq('is_active', true)
        .order('floor', { ascending: true })
        .order('id', { ascending: true });
      if (roomsErr) throw roomsErr;

      const { data: sessions, error: sessErr } = await supabase
        .from('class_sessions')
        .select(`
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
        .eq('term_id', targetTermId)
        .eq('is_active', true)
        .order('start_mins', { ascending: true });
      if (sessErr) throw sessErr;

      const roomsMaster = {
        rooms: roomsList || [],
        schedule: {}
      };
      DAY_NAMES.forEach(day => { roomsMaster.schedule[day] = {}; });

      (sessions || []).forEach(s => {
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
          type: s.class_type || 'Theory',
          semSec: s.sections?.label || ''
        });
      });

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(roomsMaster);
    }

    // ------------------------------------------------------------------------
    // Action: teachers_master (Department-wide Teacher Finder dataset)
    // ------------------------------------------------------------------------
    if (action === 'teachers_master') {
      const { data: sessions, error: sessErr } = await supabase
        .from('class_sessions')
        .select(`
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
        .eq('term_id', targetTermId)
        .eq('is_active', true)
        .order('start_mins', { ascending: true });
      if (sessErr) throw sessErr;

      const teacherSet = new Set();
      const teachersMaster = {
        teachers: [],
        schedule: {}
      };
      DAY_NAMES.forEach(day => { teachersMaster.schedule[day] = {}; });

      (sessions || []).forEach(s => {
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
          type: s.class_type || 'Theory',
          semSec: s.sections?.label || ''
        });
      });
      teachersMaster.teachers = Array.from(teacherSet).sort((a, b) => a.localeCompare(b));

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(teachersMaster);
    }

    // ------------------------------------------------------------------------
    // Action: section (Student Routine by Semester & Section)
    // ------------------------------------------------------------------------
    if (action === 'section' || (semester && section)) {
      const semNum = parseInt(semester, 10);
      const secCode = (section || '').toUpperCase().trim();

      const { data: secRow, error: secErr } = await supabase
        .from('sections')
        .select('id, label')
        .eq('semester_id', semNum)
        .eq('code', secCode)
        .single();

      if (secErr || !secRow) {
        return res.status(404).json({ error: `Section Sem ${semNum}-${secCode} not found.` });
      }

      const { data: sessions, error: sessErr } = await supabase
        .from('class_sessions')
        .select(`
          day_of_week,
          start_mins,
          end_mins,
          class_type,
          room_id,
          teacher_code,
          course_code
        `)
        .eq('term_id', targetTermId)
        .eq('section_id', secRow.id)
        .eq('is_active', true)
        .order('start_mins', { ascending: true });

      if (sessErr) throw sessErr;

      const routineObj = {};
      DAY_NAMES.forEach(day => { routineObj[day] = []; });

      (sessions || []).forEach(s => {
        const dayName = DAY_NAMES[s.day_of_week];
        const start12h = formatMinuteTo12h(s.start_mins);
        const end12h = formatMinuteTo12h(s.end_mins);
        routineObj[dayName].push({
          time: `${start12h} - ${end12h}`,
          subject: s.course_code,
          room: s.room_id || 'TBA',
          instructor: s.teacher_code || '',
          type: s.class_type || 'Theory',
          start: formatMinuteTo24h(s.start_mins),
          end: formatMinuteTo24h(s.end_mins),
          startM: s.start_mins,
          endM: s.end_mins
        });
      });

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      return res.status(200).json(routineObj);
    }

    // ------------------------------------------------------------------------
    // Action: courses (Course code -> full name catalog)
    // ------------------------------------------------------------------------
    if (action === 'courses') {
      const { data: coursesList, error: courseErr } = await supabase
        .from('courses')
        .select('code, full_name, type_hint')
        .order('code', { ascending: true });

      if (courseErr) throw courseErr;

      const courseMap = {};
      (coursesList || []).forEach(c => {
        courseMap[c.code] = c.full_name || c.code;
      });

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(courseMap);
    }

    // ------------------------------------------------------------------------
    // Action: semesters_sections (Metadata for selector UI)
    // ------------------------------------------------------------------------
    if (action === 'semesters_sections') {
      const { data: sectionsList, error: secErr } = await supabase
        .from('sections')
        .select('semester_id, code, label')
        .eq('is_active', true)
        .order('semester_id', { ascending: true })
        .order('code', { ascending: true });

      if (secErr) throw secErr;

      const structure = {};
      (sectionsList || []).forEach(s => {
        if (!structure[s.semester_id]) structure[s.semester_id] = [];
        structure[s.semester_id].push(s.code.toLowerCase());
      });

      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.status(200).json(structure);
    }

    return res.status(400).json({
      error: 'Invalid action parameter. Supported actions: rooms_master, teachers_master, section, courses, semesters_sections'
    });
  } catch (error) {
    console.error('[API/Schedule] Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
};
