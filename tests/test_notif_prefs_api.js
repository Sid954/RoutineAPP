const assert = require('assert');
const { sanitizePrefs, pushDecision, pushTitle, noticeChannel } = require('../api/_lib/notif-prefs.js');

console.log('Testing server-side notice push preferences...');

// 1. Sanitising: only known fields, bounded values
assert.strictEqual(sanitizePrefs(null), null);
assert.strictEqual(sanitizePrefs([1, 2]), null);
const p = sanitizePrefs({ enabled: true, types: { general: false, evil: false }, quiet: { on: true, from: 99999, to: -4 }, tz: 360, mutedUntil: 'not a date', extra: 'x'.repeat(1e5) });
assert.deepStrictEqual(Object.keys(p).sort(), ['enabled', 'mutedUntil', 'quiet', 'types', 'tz']);
assert.strictEqual(p.types.general, false);
assert.strictEqual(p.types.cancellation, true);
assert.ok(!('evil' in p.types));
assert.deepStrictEqual(p.quiet, { on: true, from: 1439, to: 0 });
assert.strictEqual(p.mutedUntil, null);
console.log('✅ Test 1: prefs are sanitised');

// 2. Decisions
const noon = Date.UTC(2026, 10, 17, 6, 0); // 12:00 in Dhaka (UTC+6)
assert.deepStrictEqual(pushDecision(null, 'general', noon), { send: true, quiet: false }, 'no prefs: old behaviour');
assert.strictEqual(pushDecision({ enabled: false }, 'general', noon).send, false);
assert.strictEqual(pushDecision({ types: { holiday: false } }, 'holiday', noon).send, false);
assert.strictEqual(pushDecision({ types: { holiday: false } }, 'cancellation', noon).send, true);
assert.strictEqual(pushDecision({ mutedUntil: new Date(noon + 3600e3).toISOString() }, 'general', noon).send, false);
assert.strictEqual(pushDecision({ mutedUntil: new Date(noon - 1).toISOString() }, 'general', noon).send, true);
const night = Date.UTC(2026, 10, 17, 17, 30); // 23:30 in Dhaka
assert.deepStrictEqual(pushDecision({ tz: 360, quiet: { on: true, from: 1380, to: 420 } }, 'general', night), { send: true, quiet: true });
assert.deepStrictEqual(pushDecision({ tz: 360, quiet: { on: true, from: 1380, to: 420 } }, 'general', noon), { send: true, quiet: false });
console.log('✅ Test 2: type switches, pause and quiet hours');

// 3. Titles: no emoji, type label once
assert.strictEqual(pushTitle('cancellation', 'ICMP class'), 'Cancelled: ICMP class');
assert.strictEqual(pushTitle('holiday', 'Holiday tomorrow'), 'Holiday tomorrow');
assert.strictEqual(pushTitle('general', ''), 'Notice');
assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(pushTitle('class_test', 'CT-2')));
console.log('✅ Test 3: plain titles');

// 4. Notice sound channel: only a well-formed id is kept
assert.strictEqual(noticeChannel(sanitizePrefs({ noticeChannel: 'nf_notice_bell_10' })), 'nf_notice_bell_10');
assert.strictEqual(noticeChannel(sanitizePrefs({ noticeChannel: 'announcements_channel; drop' })), '');
assert.strictEqual(noticeChannel(sanitizePrefs({})), '');
console.log('✅ Test 4: notice channel id is validated');

console.log('All notice push preference tests passed.');
