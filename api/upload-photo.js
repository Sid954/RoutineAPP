const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_OPTIONS } = require('./_lib/supabase-options.js');
const { applyCors } = require('./_lib/cors.js');
const { guard } = require('./_lib/security.js');
const { handlePhotoUpload } = require('./_lib/photo-upload.js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, SUPABASE_OPTIONS);
}

module.exports = async (req, res) => {
  if (applyCors(req, res, 'GET,OPTIONS,PATCH,DELETE,POST,PUT')) return;
  if (guard(req, res, 'upload-photo', { write: { max: 10, windowMs: 60 * 60 * 1000 } })) return;

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials are not configured on the server.' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const result = await handlePhotoUpload(supabase, req);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Photo upload error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload image.' });
  }
};
