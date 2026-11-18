/**
 * Pure rules for community suggestions (no I/O, unit-tested in tests/test_suggestions.js).
 * Agreed design: see "Item 17 design" in NEXT_TASKS.md.
 */
const RULES = {
  EXPIRE_MS: 7 * 24 * 60 * 60 * 1000, // pending suggestions expire after 7 days
  APPLY_NET: 2,                        // net up-votes before it shows in the routine (flagged)
  HIDE_NET: -5,                        // net down-votes that hide it from the list
  AUTO_RATIO: 0.6,                     // share of up-votes needed to auto-approve
  AUTO_MIN_SECTION: 8,                 // total votes needed (about 20% of an average 40-student section)
  AUTO_MIN_DEPT: 15,                   // department-wide notices are worth more to a spammer
  PER_DEVICE_PER_DAY: 5,
  PER_IP_PER_HOUR: 3
};

const clean = v => String(v == null ? '' : v).trim().toLowerCase();

/** Same section + type + subject + date means the same suggestion. */
function dedupeKey(s) {
  return [clean(s.semester), clean(s.section), clean(s.type || 'general'), clean(s.subject_override || s.subject), clean(s.date_override)].join('|');
}

/** A suggestion with no semester AND no section is department-wide. */
function isDepartment(s) {
  return !clean(s.semester) && !clean(s.section);
}

function tally(up, down) {
  up = Number(up) || 0; down = Number(down) || 0;
  const total = up + down;
  return { up, down, total, net: up - down, ratio: total ? up / total : 0 };
}

/** Votes needed in total before the ratio rule can auto-approve. */
function autoMin(s) {
  return isDepartment(s) ? RULES.AUTO_MIN_DEPT : RULES.AUTO_MIN_SECTION;
}

function isExpired(s, now = Date.now()) {
  return now - new Date(s.created_at).getTime() > RULES.EXPIRE_MS;
}

/**
 * state of a pending suggestion:
 *  'expired' | 'hidden' | 'auto' (becomes an official notice) | 'applied' (shown in the routine, unconfirmed) | 'listed'
 */
function stateOf(s, t, now = Date.now()) {
  if (isExpired(s, now)) return 'expired';
  if (t.net <= RULES.HIDE_NET) return 'hidden';
  if (t.total >= autoMin(s) && t.ratio >= RULES.AUTO_RATIO) return 'auto';
  if (t.net >= RULES.APPLY_NET) return 'applied';
  return 'listed';
}

/** May a voter (their own semester/section) vote on this suggestion? Department-wide: everyone. */
function canVote(s, voterSemester, voterSection) {
  if (isDepartment(s)) return true;
  return clean(s.semester) === clean(voterSemester) && (!clean(s.section) || clean(s.section) === clean(voterSection));
}

module.exports = { RULES, dedupeKey, isDepartment, tally, autoMin, isExpired, stateOf, canVote };
