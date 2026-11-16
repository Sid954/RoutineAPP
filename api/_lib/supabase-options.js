/**
 * Shared createClient() options for every api/* function: fail fast when Supabase is
 * unreachable instead of hanging.
 *
 * Why: supabase-js 2.110's PostgREST client retries network errors up to 3 more times with
 * back-off (and does not expose a switch through createClient). During an outage or a
 * paused project, every request took 7–14s before returning "TypeError: fetch failed",
 * longer than the app's own 8s timeout, so users waited on a dead server.
 *
 * The retry loop deliberately does NOT retry errors named "AbortError". This fetch:
 *  - aborts any request after SUPABASE_TIMEOUT_MS with an AbortError, and
 *  - rethrows connection-level failures (DNS, refused, reset) as an AbortError carrying
 *    the original error as `cause`,
 * so an unreachable database fails once, quickly. Retries on real HTTP 5xx responses
 * (transient upstream errors) are unaffected.
 */
const SUPABASE_TIMEOUT_MS = 6000;

function noRetryError(message, cause) {
  const err = new Error(message);
  err.name = 'AbortError';
  err.cause = cause;
  return err;
}

async function fetchFailFast(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', onCallerAbort, { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw noRetryError(`Supabase request aborted after ${SUPABASE_TIMEOUT_MS}ms or by caller`, err);
    }
    throw noRetryError(`Supabase unreachable: ${err && err.message}`, err);
  } finally {
    clearTimeout(timer);
    if (options.signal) options.signal.removeEventListener('abort', onCallerAbort);
  }
}

const SUPABASE_OPTIONS = {
  global: { fetch: fetchFailFast },
  auth: { persistSession: false, autoRefreshToken: false }
};

module.exports = { SUPABASE_OPTIONS, SUPABASE_TIMEOUT_MS };
