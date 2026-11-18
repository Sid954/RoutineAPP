const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_OPTIONS } = require('./_lib/supabase-options.js');
const { applyCors } = require('./_lib/cors.js');
const { checkPassword, guard } = require('./_lib/security.js');
const { sanitizeAndValidatePayload } = require('./_lib/announcement-payload.js');
const { sendNoticePush } = require('./_lib/notice-push.js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, SUPABASE_OPTIONS);
}

// Cap the GET payload: every client polls this every 30s, and without a limit the
// response grew with every announcement ever posted. Pinned items sort first.
const MAX_ANNOUNCEMENTS = 300;

module.exports = async (req, res) => {
  if (applyCors(req, res, 'GET,OPTIONS,PATCH,DELETE,POST,PUT')) return;
  if (guard(req, res, 'announcements', { read: { max: 90, windowMs: 60 * 1000 } })) return;

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials are not configured on the server.' });
  }

  // GET: Fetch all announcements
  if (req.method === 'GET') {
    // Short CDN cache: the app polls every 30s, so a flood of readers mostly hits the edge, not Supabase.
    res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
    try {
      let { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(MAX_ANNOUNCEMENTS);

      if (error) {
        // Fallback in case is_pinned column does not exist in Supabase table
        const fallback = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(MAX_ANNOUNCEMENTS);
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Publish a new announcement OR update existing OR check password
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
    const { id, isUpdate, action, password, checkPasswordOnly } = req.body || {};

    // Constant-time compare + per-IP brute-force throttle; fails closed if unset
    const auth = checkPassword(req, password, process.env.ANNOUNCEMENT_PASSWORD);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    if (checkPasswordOnly) {
      return res.status(200).json({ success: true, valid: true });
    }

    // Validate & Sanitize Payload
    const validationResult = sanitizeAndValidatePayload(req.body);
    if (validationResult.error) {
      return res.status(400).json({ error: validationResult.error });
    }
    const sanitizedPayload = validationResult.data;

    // UPDATE Handler (triggered by PATCH, PUT, or POST with id / isUpdate / action: 'update')
    if (req.method === 'PATCH' || req.method === 'PUT' || isUpdate || action === 'update' || (id && req.method === 'POST')) {
      if (!id) {
        return res.status(400).json({ error: 'Missing announcement ID.' });
      }

      try {
        let { data, error } = await supabase
          .from('announcements')
          .update(sanitizedPayload)
          .eq('id', id)
          .select();

        if (error) {
          // Fallback if is_pinned column does not exist in table
          const payloadWithoutPin = { ...sanitizedPayload };
          delete payloadWithoutPin.is_pinned;
          const retry = await supabase
            .from('announcements')
            .update(payloadWithoutPin)
            .eq('id', id)
            .select();
          if (retry.error) throw retry.error;
          data = retry.data;
          if (data && data[0]) {
            data[0].is_pinned = sanitizedPayload.is_pinned;
          }
        }

        if (!data || data.length === 0) {
          return res.status(404).json({ error: 'Announcement not found.' });
        }

        return res.status(200).json(data[0]);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // INSERT Handler (new announcement)
    try {
      // 1. Insert into Supabase database with semester and section scoping
      let { data, error } = await supabase
        .from('announcements')
        .insert([sanitizedPayload])
        .select();

      if (error) {
        const payloadWithoutPin = { ...sanitizedPayload };
        delete payloadWithoutPin.is_pinned;
        const retry = await supabase
          .from('announcements')
          .insert([payloadWithoutPin])
          .select();
        if (retry.error) throw retry.error;
        data = retry.data;
        if (data && data[0]) {
          data[0].is_pinned = sanitizedPayload.is_pinned;
        }
      }
      const newAnnouncement = data[0];

      // 2. Push to the devices of the notice's audience
      await sendNoticePush(supabase, sanitizedPayload, newAnnouncement);

      return res.status(201).json(newAnnouncement);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE: Delete a specific announcement
  if (req.method === 'DELETE') {
    const id = req.body?.id || req.query?.id;
    // Body only: a password in the query string would be written to request logs
    const password = req.body?.password;

    if (!id) {
      return res.status(400).json({ error: 'Missing announcement ID.' });
    }

    // Constant-time compare + per-IP brute-force throttle; fails closed if unset
    const auth = checkPassword(req, password, process.env.ANNOUNCEMENT_PASSWORD);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Announcement deleted successfully.' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
