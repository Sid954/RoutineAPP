const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, 'www');

// List of files and folders to copy
const FILES_TO_COPY = [
  'index.html',
  'style.css',
  'script.js',
  'schedule.json',
  'config.json',
  'manifest.json',
  'sw.js',
  'icon-192.png',
  'icon-512.png',
  '512.png'
];

function build() {
  console.log('Building web assets for Capacitor...');
  
  // Create or clean dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR);

  // Copy files
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

  console.log('Build completed! Web assets are in the /www folder.');
}

build();
