// Preferences: defaults, persistence, schema consistency, accent colours.
// Run from the repo root: node tests/test_prefs.js
const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  const imp = f => import(pathToFileURL(path.join(__dirname, '..', 'src', 'settings', f)).href);
  const prefs = await imp('prefs.js');
  const { PREF_GROUPS } = await imp('pref-schema.js');

  // Memory-only storage when localStorage is absent: set / get / reset
  assert.strictEqual(prefs.getPref('room'), 'on');
  prefs.setPref('room', 'off');
  assert.strictEqual(prefs.getPref('room'), 'off');
  assert.strictEqual(prefs.isOn('room'), false);
  prefs.setPref('nonsense', 'x'); // unknown keys are ignored
  assert.strictEqual(prefs.getPref('nonsense'), undefined);
  prefs.resetPrefs();
  assert.strictEqual(prefs.getPref('room'), 'on');

  // Every schema entry maps to a real preference and its options include the default
  const seen = new Set();
  for (const [group, items] of Object.entries(PREF_GROUPS)) {
    for (const it of items) {
      assert.ok(it.key in prefs.DEFAULTS, `${group}/${it.key} missing from DEFAULTS`);
      assert.ok(!seen.has(it.key), `${it.key} listed twice`);
      seen.add(it.key);
      assert.ok(it.title && it.desc && it.section, `${it.key} needs a title, a description and a section`);
      if (it.type === 'switch') assert.ok(['on', 'off'].includes(prefs.DEFAULTS[it.key]), `${it.key} switch default`);
      if (it.type === 'choice') {
        assert.ok(it.options.length >= 2);
        assert.ok(it.options.some(o => o[0] === prefs.DEFAULTS[it.key]), `${it.key} default is not an option`);
      }
    }
  }
  // Every preference is reachable from the UI
  for (const k of Object.keys(prefs.DEFAULTS)) assert.ok(seen.has(k), `${k} has no control in the schema`);

  // Accent colours: default has no overrides, others fill all six variables on both themes
  assert.strictEqual(prefs.accentVars('default', 'dark'), null);
  for (const id of Object.keys(prefs.ACCENTS)) {
    if (id === 'default') continue;
    for (const theme of ['dark', 'light']) {
      const v = prefs.accentVars(id, theme);
      assert.ok(/^#[0-9a-f]{6}$/i.test(v['--accent']), `${id}/${theme} accent`);
      assert.ok(/^#[0-9a-f]{6}$/i.test(v['--accent-hover']), `${id}/${theme} hover`);
      assert.ok(v['--accent-soft'].startsWith('rgba('));
      assert.ok(v['--btn-text']);
    }
  }
  console.log('test_prefs: ok');
})().catch(e => { console.error(e); process.exit(1); });
