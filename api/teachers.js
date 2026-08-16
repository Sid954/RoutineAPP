const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials are not configured on the server.' });
  }

  // GET: Fetch approved names map OR pending submissions (admin)
  if (req.method === 'GET') {
    const { pending, password } = req.query || {};

    if (pending === 'true') {
      const adminPassword = process.env.ADMIN_PASSWORD || 'secret123';
      if (!password || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin password.' });
      }

      try {
        const { data, error } = await supabase
          .from('teacher_names')
          .select('*')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data || []);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Default public GET: return approved names dictionary
    try {
      const { data, error } = await supabase
        .from('teacher_names')
        .select('teacher_code, full_name')
        .eq('status', 'approved')
        .order('id', { ascending: true });

      if (error) throw error;
      const namesMap = {};
      (data || []).forEach(row => {
        if (row.teacher_code && row.full_name) {
          namesMap[row.teacher_code.trim().toUpperCase()] = row.full_name.trim();
        }
      });

      return res.status(200).json(namesMap);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Submit a suggestion (public) OR Approve / Reject (admin)
  if (req.method === 'POST') {
    const { action, id, code, name, password } = req.body || {};

    // 1. Admin Moderation Action
    if (action === 'approve' || action === 'reject') {
      const adminPassword = process.env.ADMIN_PASSWORD || 'secret123';
      if (!password || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin password.' });
      }

      if (!id && !code) {
        return res.status(400).json({ error: 'Missing submission ID or teacher code.' });
      }

      try {
        const status = action === 'approve' ? 'approved' : 'rejected';
        const updatePayload = {
          status,
          reviewed_at: new Date().toISOString()
        };
        if (name && name.trim()) {
          updatePayload.full_name = name.trim();
        }

        if (id) {
          const { data, error } = await supabase
            .from('teacher_names')
            .update(updatePayload)
            .eq('id', id)
            .select();

          if (error) throw error;
          return res.status(200).json({ success: true, action, data: data[0] });
        } else {
          // Direct insert/upsert approved name by admin
          const { data, error } = await supabase
            .from('teacher_names')
            .insert([{
              teacher_code: code.trim().toUpperCase(),
              full_name: name.trim(),
              status: 'approved',
              reviewed_at: new Date().toISOString()
            }])
            .select();

          if (error) throw error;
          return res.status(200).json({ success: true, action: 'approved', data: data[0] });
        }
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 2. Public Submission (Suggest Full Name)
    if (!code || !name) {
      return res.status(400).json({ error: 'Teacher code and full name are required.' });
    }

    try {
      const { data, error } = await supabase
        .from('teacher_names')
        .insert([{
          teacher_code: code.trim().toUpperCase(),
          full_name: name.trim(),
          status: 'pending'
        }])
        .select();

      if (error) throw error;
      return res.status(201).json({ success: true, message: 'Name submitted for review.', data: data[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
};
