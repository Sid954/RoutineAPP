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

async function testDirectFetch() {
  const { loadMasterTeacherData } = await import('../src/teachers/teacher-finder.js');

  global.fetch = async (url) => {
    const urlObj = new URL(url, 'http://localhost');
    const action = urlObj.searchParams.get('action');
    const mockRes = {
      _status: 200,
      _headers: {},
      setHeader: () => {},
      status(s) { this._status = s; return this; },
      json(d) { this._data = d; return this; }
    };
    await handler({ method: 'GET', query: { action } }, mockRes);
    return {
      ok: mockRes._status === 200,
      status: mockRes._status,
      json: async () => mockRes._data
    };
  };

  const data = await loadMasterTeacherData(true);
  console.log('Direct test liveTeachers teachers count:', data.teachers?.length);
  console.log('Sample teachers:', data.teachers?.slice(0, 5));
}

testDirectFetch();
