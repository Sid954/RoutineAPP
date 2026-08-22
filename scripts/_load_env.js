const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach(line => {
      const clean = line.trim();
      if (!clean || clean.startsWith('#')) return;
      const eqIdx = clean.indexOf('=');
      if (eqIdx !== -1) {
        const key = clean.slice(0, eqIdx).trim();
        let val = clean.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
  }
}

loadEnv();
module.exports = { loadEnv };
