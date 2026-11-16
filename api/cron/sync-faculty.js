/**
 * Vercel Cron Endpoint: Synchronizes faculty directory with Premier University website.
 * Runs weekly (every Friday at 03:00 UTC = 09:00 Bangladesh Time, UTC+6).
 */
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_OPTIONS } = require('../_lib/supabase-options.js');
const { applyCors } = require('../_lib/cors.js');
const { syncFacultyWithSupabase } = require('../_lib/faculty-scraper.js');
const { safeEqual } = require('../_lib/security.js');

module.exports = async (req, res) => {
  if (applyCors(req, res, 'GET,POST,OPTIONS')) return;

  // 1. Verify Vercel Cron Authorization
  // Fail closed: without CRON_SECRET anyone could trigger the scraper + DB writes.
  // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" automatically when the env var is set.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[CRON sync-faculty] CRON_SECRET is not configured; refusing to run.');
    return res.status(503).json({ error: 'CRON_SECRET is not configured on the server.' });
  }
  if (!safeEqual(req.headers['authorization'] || '', `Bearer ${cronSecret}`)) {
    console.warn('[CRON sync-faculty] Unauthorized access attempt (invalid or missing CRON_SECRET).');
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET.' });
  }

  // 2. Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[CRON sync-faculty] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    return res.status(500).json({ error: 'Server environment missing Supabase credentials.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, SUPABASE_OPTIONS);

  // 3. Execute Sync
  try {
    console.log('[CRON sync-faculty] Starting automated faculty sync from cse.puc.ac.bd...');
    const result = await syncFacultyWithSupabase(supabase);
    console.log(`[CRON sync-faculty] Completed in ${result.durationMs}ms. Scraped: ${result.scrapedCount}, Suggestions Created: ${result.newSuggestionsCount}`);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[CRON sync-faculty] Sync failed:', err.message);
    return res.status(502).json({
      success: false,
      timestamp: new Date().toISOString(),
      error: err.message || 'Failed to sync faculty directory from university website.'
    });
  }
};
