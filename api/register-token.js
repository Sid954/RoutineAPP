const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_OPTIONS } = require('./_lib/supabase-options.js');
const { applyCors } = require('./_lib/cors.js');
const { sanitizePrefs } = require('./_lib/notif-prefs.js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, SUPABASE_OPTIONS);
}

module.exports = async (req, res) => {
  if (applyCors(req, res, 'GET,OPTIONS,PATCH,DELETE,POST,PUT')) return;

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials are not configured on the server.' });
  }

  if (req.method === 'POST') {
    const { token, platform, semester, section, prefs } = req.body || {};

    if (!token || !platform || typeof token !== 'string' || token.length > 4096) {
      return res.status(400).json({ error: 'Missing token or platform details.' });
    }

    try {
      const row = { token, platform: String(platform).slice(0, 20), semester: semester || null, section: section || null };
      const cleanPrefs = sanitizePrefs(prefs);
      // Upsert with notice preferences; servers whose device_tokens has no `prefs` column yet
      // (supabase_notification_prefs.sql not run) fall back to the old row so pushes keep working.
      let prefsSaved = false;
      let result = await supabase.from('device_tokens')
        .upsert([cleanPrefs ? { ...row, prefs: cleanPrefs } : row], { onConflict: 'token' })
        .select('token');
      if (result.error && cleanPrefs && /prefs/i.test(result.error.message || '')) {
        result = await supabase.from('device_tokens').upsert([row], { onConflict: 'token' }).select('token');
      } else if (!result.error && cleanPrefs) {
        prefsSaved = true;
      }
      if (result.error) throw result.error;

      return res.status(200).json({ message: 'Token registered successfully', prefsSaved });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
