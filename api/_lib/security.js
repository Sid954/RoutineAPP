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

// ── Per-endpoint request limits + temporary blocking ──────────────────────────
// guard() is called first in every api function. Each endpoint has a read limit (GET/HEAD) and
// a stricter write limit. An IP that keeps hitting limits (3 strikes in 10 minutes) is blocked
// on EVERY endpoint of this instance for 15 minutes. Like the limiter above, state is per warm
// instance: a best-effort first line, not a replacement for Vercel's Firewall rate limit.
const DEFAULT_READ = { max: 120, windowMs: 60 * 1000 };
const DEFAULT_WRITE = { max: 20, windowMs: 10 * 60 * 1000 };
const BLOCK_MS = 15 * 60 * 1000;
const guardLimiters = new Map();
const strikes = createRateLimiter({ max: 3, windowMs: 10 * 60 * 1000 });
const blockedUntil = new Map();

function limiterFor(key, cfg) {
  let l = guardLimiters.get(key);
  if (!l) { l = createRateLimiter(cfg); guardLimiters.set(key, l); }
  return l;
}

function deny(res, seconds, message) {
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil(seconds))));
  res.status(429).json({ error: message });
  return true;
}

/**
 * Applies rate limits and the temporary block.
 * @param {string} name endpoint name (separate counters per endpoint)
 * @param {{ read?: {max:number, windowMs:number}, write?: {max:number, windowMs:number} }} [limits]
 * @returns {boolean} true when the request was rejected (a 429 has been sent): stop handling it
 */
function guard(req, res, name, limits = {}) {
  const ip = getClientIp(req);
  const now = Date.now();

  const until = blockedUntil.get(ip);
  if (until) {
    if (until > now) return deny(res, (until - now) / 1000, 'Too many requests. You are blocked for a while, try again later.');
    blockedUntil.delete(ip);
  }

  const isRead = req.method === 'GET' || req.method === 'HEAD';
  const cfg = (isRead ? limits.read : limits.write) || (isRead ? DEFAULT_READ : DEFAULT_WRITE);
  const limiter = limiterFor(`${name}:${isRead ? 'r' : 'w'}`, cfg);

  if (limiter.isLimited(ip)) {
    strikes.hit(ip);
    if (strikes.isLimited(ip)) {
      blockedUntil.set(ip, now + BLOCK_MS);
      strikes.reset(ip);
      if (blockedUntil.size > 5000) {
        for (const [k, v] of blockedUntil) if (v <= now) blockedUntil.delete(k);
      }
      return deny(res, BLOCK_MS / 1000, 'Too many requests. You are blocked for 15 minutes.');
    }
    return deny(res, cfg.windowMs / 1000, 'Too many requests. Slow down and try again shortly.');
  }
  limiter.hit(ip);
  return false;
}

module.exports = { getClientIp, safeEqual, createRateLimiter, checkPassword, guard };
