// Community suggestion rules: dedupe, voting scope, expiry, hide, apply and auto-approve thresholds.
const assert = require('assert');
const { RULES, dedupeKey, isDepartment, tally, stateOf, canVote } = require('../api/_lib/suggestion-rules.js');

const now = Date.now();
const sec = { semester: '4', section: 'C', type: 'cancellation', subject: 'DS', date_override: '2026-11-20', created_at: new Date(now - 1000).toISOString() };
const dept = { type: 'holiday', date_override: '2026-11-21', created_at: new Date(now - 1000).toISOString() };

// dedupe ignores case/whitespace, differs by date/section
assert.strictEqual(dedupeKey(sec), dedupeKey({ ...sec, section: ' c ', subject: 'ds' }));
assert.notStrictEqual(dedupeKey(sec), dedupeKey({ ...sec, date_override: '2026-11-22' }));
assert.notStrictEqual(dedupeKey(sec), dedupeKey({ ...sec, section: 'D' }));
assert.strictEqual(isDepartment(dept), true);
assert.strictEqual(isDepartment(sec), false);

// state thresholds (section)
assert.strictEqual(stateOf(sec, tally(0, 0), now), 'listed');
assert.strictEqual(stateOf(sec, tally(1, 0), now), 'listed');
assert.strictEqual(stateOf(sec, tally(2, 0), now), 'applied');
assert.strictEqual(stateOf(sec, tally(3, 4), now), 'listed');           // net negative, not hidden yet
assert.strictEqual(stateOf(sec, tally(0, 5), now), 'hidden');
assert.strictEqual(stateOf(sec, tally(7, 0), now), 'applied');          // 7 votes: below the 8-vote floor
assert.strictEqual(stateOf(sec, tally(8, 0), now), 'auto');
assert.strictEqual(stateOf(sec, tally(5, 3), now), 'auto');             // 8 votes, 62.5% up
assert.strictEqual(stateOf(sec, tally(4, 4), now), 'listed');           // 8 votes, only 50% up
assert.strictEqual(stateOf(sec, tally(10, 7), now), 'applied');         // 17 votes, 58.8% up: under 60%, so not official yet

// department-wide needs 15 votes
assert.strictEqual(stateOf(dept, tally(14, 0), now), 'applied');
assert.strictEqual(stateOf(dept, tally(15, 0), now), 'auto');
assert.strictEqual(stateOf(dept, tally(9, 6), now), 'auto');            // 15 votes, exactly 60%

// expiry beats everything
const old = { ...sec, created_at: new Date(now - RULES.EXPIRE_MS - 1000).toISOString() };
assert.strictEqual(stateOf(old, tally(20, 0), now), 'expired');

// voting scope: own section only; department-wide for everyone
assert.strictEqual(canVote(sec, '4', 'c'), true);
assert.strictEqual(canVote(sec, '4', 'D'), false);
assert.strictEqual(canVote(sec, '5', 'C'), false);
assert.strictEqual(canVote(dept, '1', 'A'), true);

console.log('suggestion rules tests passed');
