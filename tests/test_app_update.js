const assert = require('assert');

global.window = {};
global.localStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const stubEl = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild() {}, addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [] });
global.document = { getElementById: () => stubEl(), querySelector: () => stubEl(), querySelectorAll: () => [], addEventListener() {}, createElement: stubEl, body: stubEl(), documentElement: { getAttribute: () => 'dark' } };

const { shouldPrompt, notesHtml, fmtMB } = require('../src/updater/app-update.js');

(async () => {
  console.log('Testing in-app updater (prompt rules, notes, API endpoint)...');

  // 1. When to prompt
  const info = { versionCode: 16, minRequiredVersionCode: 1 };
  assert.deepStrictEqual(shouldPrompt({ info, installedCode: 16, skippedCode: null, manual: false }), { show: false, forced: false }, 'same version');
  assert.deepStrictEqual(shouldPrompt({ info, installedCode: 15, skippedCode: null, manual: false }), { show: true, forced: false });
  assert.deepStrictEqual(shouldPrompt({ info, installedCode: 15, skippedCode: '16', manual: false }), { show: false, forced: false }, 'skipped version stays quiet on auto checks');
  assert.deepStrictEqual(shouldPrompt({ info, installedCode: 15, skippedCode: '16', manual: true }), { show: true, forced: false }, 'manual check ignores skip');
  assert.deepStrictEqual(shouldPrompt({ info: { versionCode: 16, minRequiredVersionCode: 16 }, installedCode: 15, skippedCode: '16', manual: false }), { show: true, forced: true }, 'required update ignores skip');
  assert.deepStrictEqual(shouldPrompt({ info: null, installedCode: 1 }), { show: false, forced: false });
  console.log('✅ Test 1: prompt rules (skip, manual, required)');

  // 2. Release notes rendering is safe and structured
  const html = notesHtml('# My Routine v1.5.6 Release Notes\n\nIntro line\n\n### New\n- **In-app updates:** no browser\n- `code` here\n<script>alert(1)</script>');
  assert.ok(!html.includes('Release Notes'), 'title line dropped');
  assert.ok(html.includes('<h4>New</h4>'));
  assert.ok(html.includes('<li><strong>In-app updates:</strong> no browser</li>'));
  assert.ok(html.includes('<code>code</code>'));
  assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;'), 'HTML is escaped');
  assert.strictEqual(fmtMB(15342380), '14.6 MB');
  assert.strictEqual(fmtMB(0), '');
  console.log('✅ Test 2: release notes markdown (escaped)');

  // 3. API endpoint with GitHub mocked
  const realFetch = global.fetch;
  const calls = [];
  const releaseBody = { tag_name: 'v1.5.6', body: '# Notes\n- a', published_at: '2026-11-17T00:00:00Z',
    assets: [{ name: 'app-release.apk', size: 15000000, digest: 'sha256:ABCDEF', url: 'https://api.github.com/repos/x/y/releases/assets/9', browser_download_url: 'https://github.com/x/y/releases/download/v1.5.6/app-release.apk' }] };
  let mode = 'ok';
  global.fetch = async (url, opts = {}) => {
    calls.push({ url, auth: (opts.headers || {}).Authorization || '', accept: (opts.headers || {}).Accept || '' });
    if (mode === 'private') return { ok: false, status: 404, headers: { get: () => null } };
    if (/releases\/latest$/.test(url)) return { ok: true, status: 200, json: async () => releaseBody };
    if (/contents\/version\.json\?ref=v1\.5\.6$/.test(url)) return { ok: true, status: 200, text: async () => JSON.stringify({ versionCode: 16, versionName: '1.5.6', minRequiredVersionCode: 1, releaseNotes: 'short' }) };
    if (/releases\/assets\/9$/.test(url)) return { ok: false, status: 302, headers: { get: k => (k.toLowerCase() === 'location' ? 'https://release-assets.githubusercontent.com/signed?x=1' : null) } };
    return { ok: false, status: 500, headers: { get: () => null } };
  };
  const handler = require('../api/app-update.js');
  const call = query => new Promise(resolve => {
    const res = { headers: {}, code: 0, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; },
      json(b) { resolve({ code: this.code, body: b, headers: this.headers }); }, end() { resolve({ code: this.code, headers: this.headers }); } };
    handler({ method: 'GET', query, headers: { host: 'example.vercel.app' } }, res);
  });

  process.env.GITHUB_TOKEN = 'test-token';
  let r = await call({});
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.versionCode, 16);
  assert.strictEqual(r.body.versionName, '1.5.6');
  assert.strictEqual(r.body.sha256, 'abcdef', 'digest parsed and lower-cased');
  assert.strictEqual(r.body.size, 15000000);
  assert.strictEqual(r.body.downloadUrl, 'https://example.vercel.app/api/app-update?download=1&v=16');
  assert.ok(/s-maxage=300/.test(r.headers['Cache-Control']), 'metadata is edge-cached');
  assert.ok(calls.every(c => c.auth === 'Bearer test-token'), 'token sent to GitHub');
  console.log('✅ Test 3: metadata from the latest release (+ version.json at the tag)');

  r = await call({ download: '1' });
  assert.strictEqual(r.code, 302);
  assert.strictEqual(r.headers.Location, 'https://release-assets.githubusercontent.com/signed?x=1');
  assert.strictEqual(r.headers['Cache-Control'], 'no-store');
  assert.ok(calls.some(c => /assets\/9$/.test(c.url) && c.accept === 'application/octet-stream'));
  console.log('✅ Test 4: download redirects to the signed asset URL');

  mode = 'private';
  r = await call({});
  assert.strictEqual(r.code, 404);
  assert.ok(r.body.error);
  console.log('✅ Test 5: missing release / unreadable repo returns an error, not a crash');

  delete process.env.GITHUB_TOKEN;
  global.fetch = realFetch;
  console.log('All in-app updater tests passed.');
})().catch(e => { console.error(e); process.exit(1); });
