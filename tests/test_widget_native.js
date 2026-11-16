// Compiles the pure widget engine (android-custom/.../WidgetNow.java) with javac and runs
// tests/java/WidgetNowTest.java on the JVM. Skips (passes) when no JDK is installed.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
try { execFileSync('javac', ['-version'], { stdio: 'ignore' }); } catch (e) {
  console.log('javac not found: skipping native widget engine tests.');
  process.exit(0);
}
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-engine-'));
try {
  execFileSync('javac', ['-nowarn', '-d', out,
    path.join(root, 'android-custom/java/com/routine/app/WidgetNow.java'),
    path.join(root, 'tests/java/WidgetNowTest.java')], { stdio: 'inherit' });
  execFileSync('java', ['-cp', out, 'WidgetNowTest'], { stdio: 'inherit' });
} catch (e) {
  process.exit(1);
} finally {
  fs.rmSync(out, { recursive: true, force: true });
}
