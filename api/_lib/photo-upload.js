/**
 * Shared faculty-photo upload handler for api/teachers.js (action: 'upload_photo')
 * and api/upload-photo.js. Uploads are public (the edit-suggestion form uses them and
 * an admin approves the suggestion later), so the endpoint is hardened instead:
 *  - teacher code must be on the official whitelist
 *  - real image content (magic bytes) must match an allowed type
 *  - size cap well above what the client sends (600x600 JPEG, ~100KB)
 *  - per-IP upload rate limit
 */
const { getClientIp, createRateLimiter } = require('./security.js');
const { VALID_TEACHER_CODES } = require('./teacher-codes.js');

const BUCKET = 'faculty-photos';
const MAX_BYTES = 1.5 * 1024 * 1024;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const uploadLimiter = createRateLimiter({ max: 10, windowMs: 60 * 60 * 1000 });

let bucketChecked = false;

/** Detects the actual image type from file signature bytes, ignoring the claimed MIME. */
function sniffImageMime(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

async function ensureBucket(supabase) {
  if (bucketChecked) return;
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets || !buckets.some(b => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_BYTES,
        allowedMimeTypes: ALLOWED_MIMES
      });
    }
    bucketChecked = true;
  } catch (e) {
    console.warn('Bucket check/creation notice:', e.message);
  }
}

/**
 * @returns {Promise<{ status: number, body: object }>}
 */
async function handlePhotoUpload(supabase, req) {
  const { imageBase64, teacherCode } = req.body || {};

  const ip = getClientIp(req);
  if (uploadLimiter.isLimited(ip)) {
    return { status: 429, body: { error: 'Too many photo uploads. Please try again later.' } };
  }

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { status: 400, body: { error: 'Missing imageBase64 data.' } };
  }

  const code = (typeof teacherCode === 'string' ? teacherCode : '').trim().toUpperCase();
  if (!code || !VALID_TEACHER_CODES.has(code)) {
    return { status: 400, body: { error: 'Invalid teacher code.' } };
  }

  const match = imageBase64.match(/^data:[^;,]+;base64,(.+)$/s);
  const base64Data = match ? match[1] : imageBase64;
  // base64 is ~4/3 of the decoded size; reject oversized payloads before decoding
  if (base64Data.length > Math.ceil(MAX_BYTES * 4 / 3) + 4) {
    return { status: 400, body: { error: 'Image is too large (max 1.5MB).' } };
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return { status: 400, body: { error: 'Image is empty or too large (max 1.5MB).' } };
  }

  const realMime = sniffImageMime(buffer);
  if (!realMime) {
    return { status: 400, body: { error: 'Only JPEG, PNG, or WebP images are allowed.' } };
  }

  uploadLimiter.hit(ip);
  await ensureBucket(supabase);

  const ext = realMime === 'image/jpeg' ? 'jpg' : realMime.split('/')[1];
  const prefix = code.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const filename = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: realMime, cacheControl: '31536000', upsert: false });

  if (uploadError) {
    console.error('Photo upload error:', uploadError);
    return { status: 500, body: { error: uploadError.message || 'Failed to upload image.' } };
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return { status: 200, body: { success: true, url: publicUrlData.publicUrl, filename } };
}

module.exports = { handlePhotoUpload, sniffImageMime };
