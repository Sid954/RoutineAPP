const { createClient } = require('@supabase/supabase-js');
const { applyCors } = require('./_lib/cors.js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

module.exports = async (req, res) => {
  if (applyCors(req, res, 'GET,OPTIONS,PATCH,DELETE,POST,PUT')) return;

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials are not configured on the server.' });
  }

  if (req.method === 'POST') {
    const { token, platform, semester, section } = req.body || {};

    if (!token || !platform) {
      return res.status(400).json({ error: 'Missing token or platform details.' });
    }

    try {
      // Upsert: Save or update the device token with semester and section
      const { data, error } = await supabase
        .from('device_tokens')
        .upsert([{ 
          token, 
          platform,
          semester: semester || null,
          section: section || null
        }], { onConflict: 'token' })
        .select();

      if (error) throw error;

      return res.status(200).json({ message: 'Token registered successfully', data: data[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
