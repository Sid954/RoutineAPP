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
