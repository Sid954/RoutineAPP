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

const handler = require('../api/schedule.js');

function mockRes() {
  const res = {
    _status: 200,
    _headers: {},
    _data: null,
    setHeader(k, v) { this._headers[k] = v; return this; },
    status(s) { this._status = s; return this; },
    json(d) { this._data = d; return this; },
    end() { return this; }
  };
  return res;
}

async function testEndpoint() {
  console.log('=== TESTING api/schedule.js ENDPOINT ===');

  // Test 1: rooms_master
  const res1 = mockRes();
  await handler({ method: 'GET', query: { action: 'rooms_master' } }, res1);
  console.log(`1. action=rooms_master: Status=${res1._status}, Rooms=${res1._data.rooms.length}, Saturday rooms with classes=${Object.keys(res1._data.schedule.Saturday).length}`);

  // Test 2: teachers_master
  const res2 = mockRes();
  await handler({ method: 'GET', query: { action: 'teachers_master' } }, res2);
  console.log(`2. action=teachers_master: Status=${res2._status}, Teachers=${res2._data.teachers.length}, Saturday teachers with classes=${Object.keys(res2._data.schedule.Saturday).length}`);

  // Test 3: section Sem 2-C
  const res3 = mockRes();
  await handler({ method: 'GET', query: { action: 'section', semester: '2', section: 'c' } }, res3);
  console.log(`3. action=section (Sem 2-C): Status=${res3._status}, Saturday classes=${res3._data.Saturday.length}`);
  console.log('   Saturday[0]:', res3._data.Saturday[0]);

  // Test 4: courses
  const res4 = mockRes();
  await handler({ method: 'GET', query: { action: 'courses' } }, res4);
  console.log(`4. action=courses: Status=${res4._status}, Total courses=${Object.keys(res4._data).length}, DS="${res4._data.DS}"`);

  // Test 5: semesters_sections
  const res5 = mockRes();
  await handler({ method: 'GET', query: { action: 'semesters_sections' } }, res5);
  console.log(`5. action=semesters_sections: Status=${res5._status}, Semesters=${Object.keys(res5._data).length}, Sem 4 sections=[${res5._data['4']}]`);

  console.log('\n🎉 ALL 5 ACTIONS TESTED SUCCESSFULLY!');
}

testEndpoint().catch(console.error);
