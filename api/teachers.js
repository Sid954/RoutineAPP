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

  // GET: Fetch approved instructor overrides map OR pending submissions (admin)
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

    // Default public GET: return rich approved faculty overrides
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('status', 'approved')
        .order('id', { ascending: true });

      if (error) throw error;
      const approvedMap = {};
      (data || []).forEach(row => {
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

  // POST: Submit a suggestion (public) OR Approve / Reject (admin) OR Upload Photo
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
      password
    } = req.body || {};

    // 0. Photo Upload Action
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

    // 1. Admin Moderation Action (Approve / Reject)
    if (action === 'approve' || action === 'reject') {
      const adminPassword = process.env.ADMIN_PASSWORD || process.env.ANNOUNCEMENT_PASSWORD || 'secret123';
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

        if (id) {
          const { data, error } = await supabase
            .from(tableName)
            .update(updatePayload)
            .eq('id', id)
            .select();

          if (error) throw error;
          return res.status(200).json({ success: true, action, data: data[0] });
        } else {
          // Direct insert approved override by admin
          const { data, error } = await supabase
            .from(tableName)
            .insert([{
              teacher_code: (code || '').trim().toUpperCase(),
              full_name: (name || '').trim(),
              email: (email || '').trim(),
              phone: (phone || '').trim(),
              designation: (designation || '').trim(),
              photo: (photo || '').trim(),
              profile_url: (profileUrl || '').trim(),
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

    // 2. Public Submission (Suggest Edit for Instructor)
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

    // -------------------------------------------------------------
    // PROTECTION 4: No-Op (Identical Value) Detection
    // -------------------------------------------------------------
    let parsedOldData = {};
    if (oldData) {
      try { parsedOldData = typeof oldData === 'string' ? JSON.parse(oldData) : oldData; } catch (e) {}
    }

    const isSameName = cleanName === (parsedOldData.name || '');
    const isSameEmail = cleanEmail === (parsedOldData.email || '').toLowerCase();
    const isSamePhone = cleanPhone === (parsedOldData.phone || '');
    const isSameDesig = cleanDesig === (parsedOldData.designation || '');
    const isSamePhoto = cleanPhoto === (parsedOldData.photo || '');
    const isSameProfile = cleanProfile === (parsedOldData.profileUrl || '');

    if (isSameName && isSameEmail && isSamePhone && isSameDesig && isSamePhoto && isSameProfile) {
      return res.status(400).json({ error: 'No changes detected. The submitted values are identical to the existing faculty info.' });
    }

    // -------------------------------------------------------------
    // PROTECTION 2: Server-Side IP Rate Limiting (Max 5/hr per IP)
    // -------------------------------------------------------------
    const clientIp = getClientIp(req);
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

    // Insert pending suggestion
    try {
      const submissionRow = {
        teacher_code: cleanCode,
        full_name: cleanName,
        email: cleanEmail,
        phone: cleanPhone,
        designation: cleanDesig,
        photo: cleanPhoto,
        profile_url: cleanProfile,
        old_data: oldData ? JSON.stringify(oldData) : null,
        status: 'pending',
        ip_address: clientIp,
        submitted_at: new Date().toISOString()
      };

      // Attempt insert with ip_address, fallback without if column is missing
      let insertRes = await supabase.from(tableName).insert([submissionRow]).select();
      if (insertRes.error && insertRes.error.message?.includes('ip_address')) {
        delete submissionRow.ip_address;
        insertRes = await supabase.from(tableName).insert([submissionRow]).select();
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

