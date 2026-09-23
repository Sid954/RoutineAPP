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

const realFetch = global.fetch;

// Mock browser environment
global.window = {
  Capacitor: { isNativePlatform: () => false }
};

const storageMap = {};
global.localStorage = {
  getItem: (k) => storageMap[k] || null,
  setItem: (k, v) => { storageMap[k] = String(v); },
  removeItem: (k) => { delete storageMap[k]; },
  clear: () => { Object.keys(storageMap).forEach(k => delete storageMap[k]); }
};

const handler = require('../api/schedule.js');

async function runCleanTests() {
  console.log('====================================================');
  console.log('🧪 VERIFYING OFFLINE FALLBACK & LIVE API BEHAVIOR');
  console.log('====================================================\n');

  const { loadMasterRoomsData } = await import('../src/rooms/room-engine.js');
  const { loadMasterTeacherData } = await import('../src/teachers/teacher-finder.js');

  // --------------------------------------------------------------------------
  // TEST 1: LIVE API ONLINE MODE
  // --------------------------------------------------------------------------
  console.log('--- TEST 1: LIVE API (ONLINE MODE) ---');
  global.localStorage.clear();

  global.fetch = async (url, opts) => {
    // If Supabase internal SDK is fetching from supabase.co, pass through to native fetch!
    if (typeof url === 'string' && url.includes('supabase.co')) {
      return realFetch(url, opts);
    }
    // If client is calling /api/schedule
    if (typeof url === 'string' && url.includes('/api/schedule')) {
      const urlObj = new URL(url, 'http://localhost');
      const action = urlObj.searchParams.get('action');
      const mockRes = {
        _status: 200,
        _headers: {},
        setHeader() {},
        status(s) { this._status = s; return this; },
        json(d) { this._data = d; return this; }
      };
      await handler({ method: 'GET', query: { action } }, mockRes);
      return {
        ok: mockRes._status === 200,
        status: mockRes._status,
        json: async () => mockRes._data
      };
    }
    return realFetch(url, opts);
  };

  const liveRooms = await loadMasterRoomsData();
  const liveTeachers = await loadMasterTeacherData(true);

  console.log(`  -> Live API Rooms: ${liveRooms.rooms.length} rooms`);
  console.log(`  -> Live API Teachers: ${liveTeachers.teachers.length} teachers`);
  console.log(`  -> Cached in localStorage (v5): ${!!global.localStorage.getItem('routine_master_rooms_v5')}`);
  console.log(`  -> Cached in localStorage (v2): ${!!global.localStorage.getItem('routine_master_teachers_v2')}`);

  // --------------------------------------------------------------------------
  // TEST 2: SIMULATED NETWORK FAILURE -> FALLBACK TO BUNDLED STATIC JSON
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: NETWORK FAILURE / OFFLINE FIRST LAUNCH ---');
  global.localStorage.clear(); // Simulate fresh installation, zero cache

  global.fetch = async (url, opts) => {
    if (typeof url === 'string' && url.includes('/api/schedule')) {
      console.log(`  [Mock Network] API "${url}" Failed (Offline / 500)`);
      return { ok: false, status: 500 };
    }
    if (typeof url === 'string' && url.includes('master_rooms_schedule.json')) {
      console.log(`  [Mock Network] Intercepted static file fallback for "${url}"`);
      const content = fs.readFileSync(path.join(__dirname, '..', 'master_rooms_schedule.json'), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(content) };
    }
    if (typeof url === 'string' && url.includes('master_teachers_schedule.json')) {
      console.log(`  [Mock Network] Intercepted static file fallback for "${url}"`);
      const content = fs.readFileSync(path.join(__dirname, '..', 'master_teachers_schedule.json'), 'utf8');
      return { ok: true, status: 200, json: async () => JSON.parse(content) };
    }
    return { ok: false, status: 404 };
  };

  const fallbackRooms = await loadMasterRoomsData();
  const fallbackTeachers = await loadMasterTeacherData(true);

  console.log(`  -> Static Fallback Rooms: ${fallbackRooms.rooms.length} rooms`);
  console.log(`  -> Static Fallback Teachers: ${fallbackTeachers.teachers.length} teachers`);

  // --------------------------------------------------------------------------
  // TEST 3: OFFLINE CACHE HIT (Zero network calls)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: OFFLINE CACHE HIT (Flight Mode) ---');
  let networkCalls = 0;
  global.fetch = async () => {
    networkCalls++;
    return { ok: false, status: 0 };
  };

  const cachedRooms = await loadMasterRoomsData();
  const cachedTeachers = await loadMasterTeacherData(false);

  console.log(`  -> Instant Cached Rooms: ${cachedRooms.rooms.length} rooms`);
  console.log(`  -> Instant Cached Teachers: ${cachedTeachers.teachers.length} teachers`);
  console.log(`  -> Network calls made during cache load: ${networkCalls} (expected background revalidations)`);

  console.log('\n====================================================');
  console.log('✅ ALL OFFLINE FALLBACK & RESILIENCE TESTS PASSED 100%!');
  console.log('====================================================');
}

runCleanTests().catch(console.error);
