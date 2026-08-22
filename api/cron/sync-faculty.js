/**
 * Vercel Cron Endpoint: Synchronizes faculty directory with Premier University website.
 * Runs weekly (every Friday at 03:00 UTC = 09:00 Bangladesh Time, UTC+6).
 */
const { createClient } = require('@supabase/supabase-js');
const { syncFacultyWithSupabase } = require('../_lib/faculty-scraper.js');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Verify Vercel Cron Authorization
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[CRON sync-faculty] Unauthorized access attempt (invalid or missing CRON_SECRET).');
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing CRON_SECRET.' });
    }
  }

  // 2. Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[CRON sync-faculty] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    return res.status(500).json({ error: 'Server environment missing Supabase credentials.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
