// Generates the short notification sounds (mono 16-bit WAV) used by the per-type sound choices.
//   node scripts/gen-notif-sounds.js
// Writes android-custom/res/raw/nf_<id>.wav (Android channels) and src/notifications/sounds/<id>.wav (in-app preview).
const fs = require('fs');
const path = require('path');
const RATE = 22050;

// A note: sine (plus optional overtone) with a fast attack and exponential decay
function note(freq, dur, { gain = 0.5, over = 0, decay = 5 } = {}) {
  const n = Math.floor(RATE * dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.006) * Math.exp(-decay * t / dur);
    out[i] = gain * env * (Math.sin(2 * Math.PI * freq * t) + over * Math.sin(2 * Math.PI * freq * 2.01 * t));
  }
  return out;
}
function mix(parts, total) {
  const out = new Float32Array(Math.floor(RATE * total));
  parts.forEach(([at, buf]) => { const o = Math.floor(RATE * at); for (let i = 0; i < buf.length && o + i < out.length; i++) out[o + i] += buf[i]; });
  return out;
}
const SOUNDS = {
  chime: mix([[0, note(784, 0.5, { over: 0.25 })], [0.14, note(1175, 0.6, { over: 0.2 })]], 0.8),
  bell: mix([[0, note(880, 1.0, { over: 0.55, decay: 4 })], [0, note(1320, 0.8, { gain: 0.2, decay: 5 })]], 1.0),
  drop: mix([[0, note(660, 0.35, { decay: 7 })], [0.12, note(440, 0.45, { decay: 6 })]], 0.6),
  pulse: mix([[0, note(988, 0.14, { decay: 3 })], [0.2, note(988, 0.14, { decay: 3 })], [0.4, note(1319, 0.3, { decay: 4 })]], 0.75),
  glass: mix([[0, note(1568, 0.9, { over: 0.35, decay: 5 })], [0.02, note(2349, 0.6, { gain: 0.18, decay: 6 })]], 0.95)
};

function wav(samples) {
  let peak = 0; samples.forEach(v => { peak = Math.max(peak, Math.abs(v)); });
  const k = peak > 0 ? 0.85 / peak : 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * k)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const root = path.join(__dirname, '..');
const raw = path.join(root, 'android-custom', 'res', 'raw');
const web = path.join(root, 'src', 'notifications', 'sounds');
fs.mkdirSync(raw, { recursive: true }); fs.mkdirSync(web, { recursive: true });
Object.entries(SOUNDS).forEach(([id, buf]) => {
  const b = wav(buf);
  fs.writeFileSync(path.join(raw, `nf_${id}.wav`), b);
  fs.writeFileSync(path.join(web, `${id}.wav`), b);
  console.log(`nf_${id}.wav  ${(b.length / 1024).toFixed(0)} KB`);
});
