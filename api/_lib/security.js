/**
 * Shared security helpers for Vercel serverless functions.
 * Files under api/_lib/ are not exposed as endpoints (underscore prefix).
 */
const crypto = require('crypto');

function getClientIp(req) {
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded) return String(forwarded).split(',')[0].trim();
  return (req.headers && req.headers['x-real-ip']) || req.socket?.remoteAddress || 'unknown';
}

/**
 * Constant-time string comparison. Hashing first gives equal-length buffers,
 * so neither content nor length leaks through response timing.
 */
function safeEqual(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Fixed-window in-memory rate limiter.
 * NOTE: state lives per warm serverless instance, so this is best-effort (it stops
 * scripted brute force against one instance, not a distributed attack).
 */
function createRateLimiter({ max, windowMs }) {
  const hits = new Map();
  return {
    /** True when the key is currently over its limit (does not record a hit). */
    isLimited(key) {
      const entry = hits.get(key);
      if (!entry) return false;
      if (Date.now() - entry.start > windowMs) { hits.delete(key); return false; }
      return entry.count >= max;
    },
    /** Records one hit for the key. */
    hit(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || now - entry.start > windowMs) {
        hits.set(key, { start: now, count: 1 });
      } else {
        entry.count++;
      }
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (now - v.start > windowMs) hits.delete(k);
      }
    },
    reset(key) { hits.delete(key); }
  };
}

// Failed password attempts: 10 per IP per 15 minutes, shared by every endpoint in an instance.
const authFailures = createRateLimiter({ max: 10, windowMs: 15 * 60 * 1000 });

/**
 * Checks a password against an env-configured secret, with brute-force throttling.
 * Fails closed when the secret is not configured.
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
function checkPassword(req, provided, expected) {
  if (!expected) {
    return { ok: false, status: 503, error: 'Admin password is not configured on the server.' };
  }
  const ip = getClientIp(req);
  if (authFailures.isLimited(ip)) {
    return { ok: false, status: 429, error: 'Too many failed password attempts. Try again in 15 minutes.' };
  }
  if (!safeEqual(provided, expected)) {
    authFailures.hit(ip);
    return { ok: false, status: 401, error: 'Unauthorized: Invalid password.' };
  }
  authFailures.reset(ip);
  return { ok: true };
}

module.exports = { getClientIp, safeEqual, createRateLimiter, checkPassword };
