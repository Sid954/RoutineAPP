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
  'icon-192.png',
  'icon-512.png',
  '512.png',
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

function build() {
  console.log('Building web assets for Capacitor...');

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
        cContent = cContent.replace(/appVersionCode: \d+/, `appVersionCode: ${vCode}`);
        cContent = cContent.replace(/appVersionName: '[^']+'/, `appVersionName: '${vName}'`);
        fs.writeFileSync(configJsPath, cContent, 'utf8');
      }

      // Sync version to www/src/core/config.js
      const wwwConfigJsPath = path.join(DIST_DIR, 'src', 'core', 'config.js');
      if (fs.existsSync(wwwConfigJsPath)) {
        let wcContent = fs.readFileSync(wwwConfigJsPath, 'utf8');
        wcContent = wcContent.replace(/appVersionCode: \d+/, `appVersionCode: ${vCode}`);
        wcContent = wcContent.replace(/appVersionName: '[^']+'/, `appVersionName: '${vName}'`);
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



  console.log('Build completed! Web assets are in the /www folder.');
}

build();
