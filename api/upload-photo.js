const { createClient } = require('@supabase/supabase-js');

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

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end('Method Not Allowed');
  }

  try {
    const { imageBase64, teacherCode, mimeType } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 data.' });
    }

    // Extract mime type and raw base64 buffer
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
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size exceeds maximum limit of 5MB.' });
    }

    const bucketName = 'faculty-photos';

    // Ensure bucket exists as public
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

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filename);

    return res.status(200).json({
      success: true,
      url: publicUrlData.publicUrl,
      filename
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    return res.status(500).json({ error: err.message || 'Failed to upload image.' });
  }
};
