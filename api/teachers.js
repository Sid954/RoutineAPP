const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

// Whitelist of all official Premier University faculty & routine teacher codes
const VALID_TEACHER_CODES = new Set([
  "ABRAR_CSE","ABSAR","AD","ADIBA_CSE","ADNAN_CSE","AFSAR_CSE","AHK","AIB","AIR","AJT","AKK","AKRAM_CSE","ALAMGIR","AMS","ANIK_CSE","ARIF_CSE","ASIF","ASIF_CSE","ASIF_SAAD_CSE","ASMA_CSE","ATAUR","ATAUR_CSE","ATIQUR","AU","AVISHEAK-CSE","AVISHEK CHOW","AWAL","AYESHA","AYESHA BANU","AZAD","AZMAIN","CFK","DAB","DHRUBA_CSE","EAS","ESTIAKSAZID","FAHIM_CSECU_GT","FAISAL_CSE","FARIHA_CSE","FIROZA","FJD","FK","FORHAD","FORKAN","FSC","HASAN_CSE","HKR","IFTEKAR MIA","INZAMAM","JA","JANNATTOHFA","JBA","JTC","JU","JUA","KAFAYET_CSE","KAMAL","KD","KINGSHUK_CSE","KLD","KMAY","KMN","MA","MAHBUBUL","MAHMUDUL_HASAN_CSE","MAWLA","MDHASAN_CSE","MDTOUKIRSHAH_CSE","MFF","MH","MHE","MHN","MI","MIHIR","MR","MRI","MRRC","MTH","MTS","NADIM_CSE","NAK","NAZMA_FBS","NBH","NJS","NM","NME","NOORTAZ_CSE","NP","NR","NUSRAT_CSE","RA","RAISULISLAM_CSE","RASHED_CSE","REZAUR_CSE","RM","RMA","ROKON","ROSHNI","RSN","SABRINA_CSE","SAGAR","SAIFUL","SHIRIN_CSE","SHREYASHI_CSE","SHUHENA","SMAI","SN","ST","TAHIATMAHABUB_CSE","TAMIM_HOSSAIN","TANNI_CSE","TANVIRHASSAN_CSE","TASHIN_HOSSAIN_CSE","TASLIMA","TASMIN","TASNIA","TASNIM","TDM","TH","THA","TMC","TMF","TMH","WALI","WMN","WONG_CSE","YAKINUR_CSE","YR","ZAHID","ZIA"
]);

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

function isGarbageString(str) {
  if (!str) return false;
  if (/(.)\1{5,}/.test(str)) return true;
  if (/<script|javascript:|onload=|onerror=/i.test(str)) return true;
  return false;
}

// Table helper with fallback
async function getActiveTable() {
  if (!supabase) return 'teacher_names';
  const { error } = await supabase.from('instructor_edit_suggestions').select('id').limit(1);
  return error ? 'teacher_names' : 'instructor_edit_suggestions';
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

  const tableName = await getActiveTable();

  // GET: Fetch live faculty directory OR pending submissions (admin)
  if (req.method === 'GET') {
    const { pending, password } = req.query || {};

    if (pending === 'true') {
      const adminPassword = process.env.ADMIN_PASSWORD || process.env.ANNOUNCEMENT_PASSWORD || 'secret123';
      if (!password || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin password.' });
      }

      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .eq('status', 'pending')
          .order('submitted_at', { ascending: false });

        if (error) throw error;
        return res.status(200).json(data || []);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Default public GET: Return full faculty directory from faculty_members table
    try {
      const { data, error } = await supabase
        .from('faculty_members')
        .select('*')
        .order('name', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const approvedMap = {};
        data.forEach(row => {
          const code = (row.teacher_code || '').trim().toUpperCase();
          if (code) {
            const profileObj = {
              code,
              officialUsername: row.official_username || '',
              name: (row.name || '').trim(),
              designation: (row.designation || '').trim() || 'Faculty Member',
              department: (row.department || 'CSE').trim(),
              photo: (row.photo || '').trim(),
              status: (row.status || 'Active').trim(),
              emails: Array.isArray(row.emails) ? row.emails : (row.email ? [row.email] : []),
              phone: (row.phone || '').trim(),
              profileUrl: (row.profile_url || '').trim(),
              socialLinks: row.social_links || {},
              aliases: Array.isArray(row.aliases) ? row.aliases : [],
              source: row.source || 'db',
              updatedAt: row.updated_at || null
            };
            approvedMap[code] = profileObj;
            if (profileObj.officialUsername) approvedMap[profileObj.officialUsername] = profileObj;
            if (Array.isArray(profileObj.aliases)) {
              profileObj.aliases.forEach(alias => {
                const upperAlias = String(alias).trim().toUpperCase();
                if (upperAlias && !approvedMap[upperAlias]) {
                  approvedMap[upperAlias] = { ...profileObj, code: upperAlias };
                }
              });
            }
          }
        });
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
        return res.status(200).json(approvedMap);
      }

      // Fallback if faculty_members not yet seeded: query approved overrides from tableName
      const { data: legacyData, error: legacyError } = await supabase
        .from(tableName)
        .select('*')
        .eq('status', 'approved')
        .order('id', { ascending: true });

      if (legacyError) throw legacyError;
      const approvedMap = {};
      (legacyData || []).forEach(row => {
        const code = (row.teacher_code || row.code || '').trim().toUpperCase();
        if (code) {
          approvedMap[code] = {
            code,
            name: (row.full_name || row.name || '').trim(),
            email: (row.email || '').trim(),
            emails: row.email ? [row.email.trim()] : [],
            phone: (row.phone || '').trim(),
            designation: (row.designation || '').trim(),
            photo: (row.photo || '').trim(),
            profileUrl: (row.profile_url || row.profileUrl || '').trim()
          };
        }
      });

      return res.status(200).json(approvedMap);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Submit a suggestion (public) OR Approve / Reject / Seed (admin) OR Upload Photo
  if (req.method === 'POST') {
    const {
      action,
      id,
      code,
      name,
      email,
      phone,
      designation,
      photo,
      profileUrl,
      oldData,
      source,
      password,
      seedList
    } = req.body || {};

    const adminPassword = process.env.ADMIN_PASSWORD || process.env.ANNOUNCEMENT_PASSWORD || 'secret123';

    // 0. Seed Faculty Ground Truth Action (Admin only)
    if (action === 'seed') {
      if (!password || password !== adminPassword) {
        return res.status(401).json({ error: 'Unauthorized: Invalid admin password.' });
      }

      const listToSeed = Array.isArray(seedList) ? seedList : [];
      if (listToSeed.length === 0) {
        return res.status(400).json({ error: 'No faculty items provided to seed.' });
      }

      try {
        const results = [];
        for (const item of listToSeed) {
          const teacherCode = (item.teacher_code || item.code || '').trim().toUpperCase();
          if (!teacherCode) continue;

          const row = {
            teacher_code: teacherCode,
            official_username: (item.official_username || item.officialUsername || '').trim(),
            name: (item.name || '').trim(),
            designation: (item.designation || 'Faculty Member').trim(),
            department: (item.department || 'CSE').trim(),
            photo: (item.photo || '').trim(),
            status: (item.status || 'Active').trim(),
            emails: Array.isArray(item.emails) ? item.emails : (item.email ? [item.email.trim()] : []),
            phone: (item.phone || '').trim(),
            profile_url: (item.profile_url || item.profileUrl || '').trim(),
            social_links: item.social_links || item.socialLinks || {},
            aliases: Array.isArray(item.aliases) ? item.aliases : [],
            source: 'seed',
            updated_at: new Date().toISOString()
          };

          const { data: upsertData, error: upsertErr } = await supabase
            .from('faculty_members')
            .upsert(row, { onConflict: 'teacher_code' })
            .select();

          if (upsertErr) throw upsertErr;
          results.push(upsertData[0]);
        }

        return res.status(200).json({ success: true, count: results.length, data: results });
      } catch (seedErr) {
        return res.status(500).json({ error: seedErr.message });
      }
    }

    // 1. Photo Upload Action
    if (action === 'upload_photo') {
      const { imageBase64, teacherCode, mimeType } = req.body || {};
      if (!imageBase64) {
        return res.status(400).json({ error: 'Missing imageBase64 data.' });
      }

      let cleanMime = mimeType || 'image/jpeg';
      let base64Data = imageBase64;
      const match = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
      if (match) {
        cleanMime = match[1];
        base64Data = match[2];
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
      if (!allowedMimes.includes(cleanMime.toLowerCase())) {
        return res.status(400).json({ error: 'Only JPEG, PNG, or WebP images are allowed.' });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const bucketName = 'faculty-photos';

      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        if (!buckets || !buckets.some(b => b.name === bucketName)) {
          await supabase.storage.createBucket(bucketName, {
            public: true,
            fileSizeLimit: 5242880,
            allowedMimeTypes: allowedMimes
          });
        }
      } catch (bErr) {
        console.warn('Bucket check/creation notice:', bErr.message);
      }

      const ext = cleanMime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
      const codePrefix = (teacherCode || 'faculty').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const filename = `${codePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filename, buffer, {
          contentType: cleanMime,
          cacheControl: '31536000',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filename);

      return res.status(200).json({
        success: true,
        url: publicUrlData.publicUrl,
        filename
      });
    }

    // 2. Admin Moderation Action (Approve / Reject)
    if (action === 'approve' || action === 'reject') {
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
        if (name && name.trim()) updatePayload.full_name = name.trim();
        if (email !== undefined) updatePayload.email = email ? email.trim() : '';
        if (phone !== undefined) updatePayload.phone = phone ? phone.trim() : '';
        if (designation !== undefined) updatePayload.designation = designation ? designation.trim() : '';
        if (photo !== undefined) updatePayload.photo = photo ? photo.trim() : '';
        if (profileUrl !== undefined) updatePayload.profile_url = profileUrl ? profileUrl.trim() : '';

        let updatedRow = null;

        if (id) {
          let updateRes = await supabase
            .from(tableName)
            .update(updatePayload)
            .eq('id', id)
            .select();

          if (updateRes.error && (updateRes.error.message?.includes('photo') || updateRes.error.message?.includes('profile_url'))) {
            delete updatePayload.photo;
            delete updatePayload.profile_url;
            updateRes = await supabase.from(tableName).update(updatePayload).eq('id', id).select();
          }

          if (updateRes.error) throw updateRes.error;
          updatedRow = updateRes.data[0];
        }

        // When approved: write directly into the live faculty_members table!
        if (action === 'approve') {
          const finalCode = ((updatedRow && (updatedRow.teacher_code || updatedRow.code)) || code || '').trim().toUpperCase();
          if (finalCode) {
            const facultyUpsert = {
              teacher_code: finalCode,
              name: (name || (updatedRow && (updatedRow.full_name || updatedRow.name)) || '').trim(),
              designation: (designation || (updatedRow && updatedRow.designation) || '').trim() || 'Faculty Member',
              phone: (phone || (updatedRow && updatedRow.phone) || '').trim(),
              photo: (photo || (updatedRow && updatedRow.photo) || '').trim(),
              profile_url: (profileUrl || (updatedRow && (updatedRow.profile_url || updatedRow.profileUrl)) || '').trim(),
              source: (updatedRow && updatedRow.source) || 'admin_approved',
              updated_at: new Date().toISOString()
            };

            const finalEmail = (email || (updatedRow && updatedRow.email) || '').trim();
            if (finalEmail) {
              facultyUpsert.emails = [finalEmail];
            }

            try {
              await supabase
                .from('faculty_members')
                .upsert(facultyUpsert, { onConflict: 'teacher_code' });
            } catch (facErr) {
              console.warn('Upsert into faculty_members notice:', facErr.message);
            }
          }
        }

        return res.status(200).json({ success: true, action, data: updatedRow });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 3. Public Submission (Suggest Edit for Instructor / Build Scraper Finding)
    // -------------------------------------------------------------
    // PROTECTION 5: Teacher Code Whitelist Validation
    // -------------------------------------------------------------
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode || !VALID_TEACHER_CODES.has(cleanCode)) {
      return res.status(400).json({ error: 'Invalid teacher code. Must reference a verified Premier University faculty code.' });
    }

    // -------------------------------------------------------------
    // PROTECTION 3: Input Length & Format Validation
    // -------------------------------------------------------------
    let cleanName = sanitizeString(name);
    if (cleanName) {
      if (cleanName.length > 100) return res.status(400).json({ error: 'Full Name must not exceed 100 characters.' });
      if (cleanName.length < 2) return res.status(400).json({ error: 'Full Name must be at least 2 characters.' });
      if (isGarbageString(cleanName)) return res.status(400).json({ error: 'Invalid Full Name format detected.' });
    }

    let cleanEmail = sanitizeString(email).toLowerCase();
    if (cleanEmail) {
      if (cleanEmail.length > 120) return res.status(400).json({ error: 'Email address must not exceed 120 characters.' });
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(cleanEmail)) return res.status(400).json({ error: 'Invalid email address format.' });
    }

    let cleanPhone = sanitizeString(phone);
    if (cleanPhone) {
      if (cleanPhone.length > 25) return res.status(400).json({ error: 'Phone number must not exceed 25 characters.' });
      const phoneRegex = /^[\d\s+\-().]{6,25}$/;
      const digitCount = (cleanPhone.match(/\d/g) || []).length;
      if (!phoneRegex.test(cleanPhone) || digitCount < 6) {
        return res.status(400).json({ error: 'Invalid phone number format. Must contain at least 6 digits.' });
      }
    }

    let cleanDesig = sanitizeString(designation);
    if (cleanDesig) {
      if (cleanDesig.length > 100) return res.status(400).json({ error: 'Designation must not exceed 100 characters.' });
      if (isGarbageString(cleanDesig)) return res.status(400).json({ error: 'Invalid designation format.' });
    }

    let cleanProfile = sanitizeString(profileUrl);
    if (cleanProfile) {
      if (cleanProfile.length > 200) return res.status(400).json({ error: 'PUC Profile URL must not exceed 200 characters.' });
      try {
        const parsedUrl = new URL(cleanProfile);
        if (!parsedUrl.protocol.startsWith('http')) {
          return res.status(400).json({ error: 'Profile URL must start with http:// or https://' });
        }
        if (!parsedUrl.hostname.endsWith('puc.ac.bd')) {
          return res.status(400).json({ error: 'Profile URL must belong to Premier University (*.puc.ac.bd).' });
        }
      } catch (uErr) {
        return res.status(400).json({ error: 'Invalid PUC Profile URL format.' });
      }
    }

    let cleanPhoto = (photo || '').trim();
    if (cleanPhoto) {
      if (cleanPhoto.length > 5000000) return res.status(400).json({ error: 'Photo payload is too large.' });
      const isHttp = /^https?:\/\//i.test(cleanPhoto);
      const isDataUri = /^data:image\/(jpeg|png|webp|jpg);base64,/i.test(cleanPhoto);
      const isLocalAsset = /^src\/assets\/faculty\//i.test(cleanPhoto);
      if (!isHttp && !isDataUri && !isLocalAsset) {
        return res.status(400).json({ error: 'Invalid photo format.' });
      }
    }

    if (!cleanName && !cleanEmail && !cleanPhone && !cleanDesig && !cleanPhoto && !cleanProfile) {
      return res.status(400).json({ error: 'At least one updated field is required to submit a suggestion.' });
    }

    // Rate Limiting for public submissions (exempt build_scraper)
    const cleanSource = (source || 'user_suggestion').trim();
    const clientIp = getClientIp(req);

    if (cleanSource !== 'build_scraper') {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      try {
        const { data: recentSubmissions, error: rlError } = await supabase
          .from(tableName)
          .select('id, submitted_at, ip_address')
          .gte('submitted_at', oneHourAgo);

        if (!rlError && Array.isArray(recentSubmissions)) {
          const ipMatches = recentSubmissions.filter(s => s.ip_address === clientIp);
          if (ipMatches.length >= 5) {
            return res.status(429).json({ error: 'Rate limit exceeded: You can submit at most 5 suggestions per hour. Please wait before submitting again.' });
          }
        }
      } catch (rlEx) {
        console.warn('Rate limiter notice:', rlEx.message);
      }
    }

    // Insert pending suggestion
    try {
      let parsedOld = null;
      if (oldData) {
        try { parsedOld = typeof oldData === 'string' ? JSON.parse(oldData) : oldData; } catch (e) { parsedOld = oldData; }
      }

      const submissionRow = {
        teacher_code: cleanCode,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        designation: cleanDesig,
        photo: cleanPhoto,
        profile_url: cleanProfile,
        old_data: parsedOld,
        source: cleanSource,
        status: 'pending',
        ip_address: clientIp,
        submitted_at: new Date().toISOString()
      };

      let insertRes = await supabase.from(tableName).insert([submissionRow]).select();
      if (insertRes.error) {
        const errMsg = insertRes.error.message || '';
        if (errMsg.includes('source')) {
          delete submissionRow.source;
          insertRes = await supabase.from(tableName).insert([submissionRow]).select();
        }
        if (insertRes.error && insertRes.error.message?.includes('old_data')) {
          delete submissionRow.old_data;
          insertRes = await supabase.from(tableName).insert([submissionRow]).select();
        }
        if (insertRes.error && insertRes.error.message?.includes('ip_address')) {
          delete submissionRow.ip_address;
          insertRes = await supabase.from(tableName).insert([submissionRow]).select();
        }
      }

      if (insertRes.error) throw insertRes.error;
      return res.status(201).json({ success: true, message: 'Faculty info submitted for review.', data: insertRes.data[0] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
};
