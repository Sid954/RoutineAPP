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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase credentials are not configured on the server.' });
  }

  try {
    const { data, error } = await supabase
      .from('faculty_members')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    const facultyMap = {};

    (data || []).forEach(row => {
      const code = (row.teacher_code || '').trim().toUpperCase();
      if (!code) return;

      const profileObj = {
        code,
        officialUsername: row.official_username || '',
        name: (row.name || '').trim(),
        designation: (row.designation || '').trim() || 'Faculty Member',
        department: (row.department || 'CSE').trim(),
        photo: (row.photo || '').trim(),
        sourcePhotoUrl: (row.source_photo_url || '').trim(),
        status: (row.status || 'Active').trim(),
        emails: Array.isArray(row.emails) ? row.emails : (row.email ? [row.email] : []),
        phone: (row.phone || '').trim(),
        profileUrl: (row.profile_url || '').trim(),
        socialLinks: row.social_links || {},
        aliases: Array.isArray(row.aliases) ? row.aliases : [],
        source: row.source || 'db',
        updatedAt: row.updated_at || null
      };

      // Index by primary teacher code
      facultyMap[code] = profileObj;

      // Index by official username
      if (profileObj.officialUsername) {
        facultyMap[profileObj.officialUsername] = profileObj;
      }

      // Index by aliases (e.g. KLD)
      if (Array.isArray(profileObj.aliases)) {
        profileObj.aliases.forEach(alias => {
          const cleanAlias = String(alias).trim().toUpperCase();
          if (cleanAlias && !facultyMap[cleanAlias]) {
            facultyMap[cleanAlias] = { ...profileObj, code: cleanAlias };
          }
        });
      }
    });

    // Cache-Control: Edge cache for 5 minutes, serve stale up to 24 hours while revalidating
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    return res.status(200).json(facultyMap);
  } catch (err) {
    console.error('Error fetching faculty_members:', err);
    return res.status(500).json({ error: err.message });
  }
};
