const fs = require('fs');
const path = require('path');

const dataDir = 'src/data';
const facMap = JSON.parse(fs.readFileSync('src/data/faculty_rich_map.json', 'utf8'));

const routineTeachers = new Set();

fs.readdirSync(dataDir).filter(d => d.startsWith('sem-')).forEach(sem => {
  const semPath = path.join(dataDir, sem);
  fs.readdirSync(semPath).filter(d => fs.statSync(path.join(semPath, d)).isDirectory()).forEach(sec => {
    const routinePath = path.join(semPath, sec, 'routine.json');
    if (!fs.existsSync(routinePath)) return;
    const data = JSON.parse(fs.readFileSync(routinePath, 'utf8'));
    Object.keys(data).forEach(day => {
      (data[day] || []).forEach(cls => {
        let t = (cls.instructor || cls.teacher || '').trim();
        if (t && t !== '—' && t.toLowerCase() !== 'tba') {
          routineTeachers.add(t);
        }
      });
    });
  });
});

console.log(`Total unique routine teachers: ${routineTeachers.size}`);

const stubFacultyEntries = [];
Array.from(routineTeachers).sort().forEach(code => {
  const existing = facMap[code] || facMap[code.toUpperCase()];
  if (!existing) {
    stubFacultyEntries.push({
      teacher_code: code,
      name: code,
      designation: 'Faculty Member',
      department: 'General / Allied',
      status: 'Active',
      source: 'routine_sync'
    });
  }
});

console.log(`Missing faculty stubs to upsert: ${stubFacultyEntries.length}`);
console.log(stubFacultyEntries.slice(0, 10));
