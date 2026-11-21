/**
 * Posting-password guard (this phone, DOM-free, tested in tests/test_pw_guard.js).
 * Counts wrong posting passwords in a row and locks the Publish button for a while:
 *   3rd wrong  -> 5 minutes, 6th -> 15 minutes, 9th and every wrong one after -> 60 minutes.
 * A right password clears the count; so does a day without a wrong try. The server has its own
 * per-IP limit (api/_lib/security.js); this one stops guessing on the form itself.
 */
const KEY = 'announce_pw_guard_v1';
const DAY = 864e5;
const MIN = 60 * 1000;

const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
const write = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };

/** { fails, until, locked, remainingMs } */
export function getGuard(now = Date.now()) {
  let g = read();
  if (g.last && now - g.last > DAY) g = {};
  const fails = Number(g.fails) || 0;
  const until = Number(g.until) || 0;
  return { fails, until, locked: until > now, remainingMs: Math.max(0, until - now) };
}

/** One more wrong password. Returns the new state. */
export function recordFailure(now = Date.now()) {
  const g = getGuard(now);
  const fails = g.fails + 1;
  const lockMin = fails >= 9 ? 60 : fails === 6 ? 15 : fails === 3 ? 5 : 0;
  const until = lockMin ? now + lockMin * MIN : (g.until > now ? g.until : 0);
  write({ fails, until, last: now });
  return getGuard(now);
}

/** The server said "too many attempts": lock here as well, for 15 minutes. */
export function recordServerLock(now = Date.now()) {
  const g = getGuard(now);
  write({ fails: Math.max(g.fails, 1), until: Math.max(g.until, now + 15 * MIN), last: now });
  return getGuard(now);
}

export function recordSuccess() { try { localStorage.removeItem(KEY); } catch (e) {} }

/** 272000 -> "4:32" */
export function formatRemaining(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
