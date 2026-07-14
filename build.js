const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'www');

// Individual files to copy (not folders)
const FILES_TO_COPY = [
  'index.html',
  'schedule.json',
  'config.json',
  'manifest.json',
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

  console.log('Build completed! Web assets are in the /www folder.');
}

build();
