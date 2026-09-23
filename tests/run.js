const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = __dirname;
const repoRoot = path.join(testsDir, '..');
const TEST_TIMEOUT_MS = 60000;

const files = fs.readdirSync(testsDir)
  .filter(f => /^test_.*\.js$/.test(f))
  .sort();

if (files.length === 0) {
  console.log('No test files found in tests/');
  process.exit(1);
}

let passed = 0;
const failed = [];

for (const file of files) {
  const rel = path.join('tests', file);
  console.log(`\n=== ${rel} ===`);
  const result = spawnSync(process.execPath, [path.join(testsDir, file)], {
    cwd: repoRoot,
    stdio: 'inherit',
    timeout: TEST_TIMEOUT_MS,
  });

  if (result.error && result.error.code === 'ETIMEDOUT') {
    failed.push({ file: rel, reason: `TIMEOUT after ${TEST_TIMEOUT_MS / 1000}s` });
    console.log(`--- ${rel}: TIMEOUT after ${TEST_TIMEOUT_MS / 1000}s`);
  } else if (result.status !== 0) {
    failed.push({ file: rel, reason: `exit ${result.status}${result.signal ? ` (${result.signal})` : ''}` });
    console.log(`--- ${rel}: FAILED (exit ${result.status}${result.signal ? `, ${result.signal}` : ''})`);
  } else {
    passed++;
    console.log(`--- ${rel}: PASS`);
  }
}

console.log('\n========================================');
console.log(`TOTAL: ${files.length}  PASS: ${passed}  FAIL: ${failed.length}`);
failed.forEach(f => console.log(`  FAIL: ${f.file} — ${f.reason}`));
console.log('========================================');

process.exit(failed.length > 0 ? 1 : 0);
