const { createClient } = require('@supabase/supabase-js');
const admin = require('firebase-admin');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey);
}

// Initialize Firebase Admin SDK
let firebaseApp = null;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    if (!admin.apps.length) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        })
      });
    } else {
      firebaseApp = admin.app();
    }
  } catch (e) {
    console.error('Failed to initialize Firebase Admin SDK:', e);
  }
} else {
  console.warn('Firebase environment variables are missing. FCM notifications will be skipped.');
}

const LIMITS = {
  AUTHOR_NAME: 15,
  TITLE: 50,
  EXAM_NAME: 15,
  TOPICS: 50,
  PLATFORM_LINK: 100
};

function collapseNewlines(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function sanitizeAndValidatePayload(body) {
  const { name, title, announcement, type, subject, date_override, subject_override, semester, section, is_pinned } = body || {};

  const cleanName = (typeof name === 'string' ? name.trim() : '');
  if (!cleanName) {
    return { error: 'Name is required and cannot be whitespace only.' };
  }
  if (cleanName.length > LIMITS.AUTHOR_NAME) {
    return { error: `Name cannot exceed ${LIMITS.AUTHOR_NAME} characters.` };
  }

  const cleanTitle = (typeof title === 'string' ? title.trim() : '');
  if (!cleanTitle) {
    return { error: 'Title is required and cannot be whitespace only.' };
  }
  if (cleanTitle.length > LIMITS.TITLE) {
    return { error: `Title cannot exceed ${LIMITS.TITLE} characters.` };
  }

  let cleanAnnouncement = announcement;
  const itemType = type || 'general';

  if (itemType === 'general') {
    cleanAnnouncement = collapseNewlines(typeof announcement === 'string' ? announcement : '');
    if (!cleanAnnouncement) {
      return { error: 'Announcement content is required and cannot be whitespace only.' };
    }
  } else if (itemType === 'class_test') {
    try {
      const parsed = typeof announcement === 'string' ? JSON.parse(announcement) : announcement;
      const examName = (parsed?.exam_name || '').trim();
      const topics = collapseNewlines(parsed?.topics || '');
      
      if (!examName) {
        return { error: 'Exam name is required.' };
      }
      if (examName.length > LIMITS.EXAM_NAME) {
        return { error: `Exam name cannot exceed ${LIMITS.EXAM_NAME} characters.` };
      }
      if (topics.length > LIMITS.TOPICS) {
        return { error: `Syllabus / Topics cannot exceed ${LIMITS.TOPICS} characters.` };
      }
      cleanAnnouncement = JSON.stringify({
        exam_name: examName,
        topics: topics || 'Not Specified'
      });
    } catch (e) {
      return { error: 'Invalid class_test payload structure.' };
    }
  } else if (itemType === 'online_class') {
    try {
      const parsed = typeof announcement === 'string' ? JSON.parse(announcement) : announcement;
      const platform = (parsed?.platform || '').trim();
      if (platform.length > LIMITS.PLATFORM_LINK) {
        return { error: `Platform link cannot exceed ${LIMITS.PLATFORM_LINK} characters.` };
      }
      const isOnline = parsed?.is_online !== undefined ? Boolean(parsed.is_online) : true;
      const isExtra = parsed?.is_extra_class !== undefined ? Boolean(parsed.is_extra_class) : false;
      const room = (parsed?.room || '').trim();
      const teacher = (parsed?.teacher || '').trim();

      const obj = {
        is_extra_class: isExtra,
        is_online: isOnline,
        platform: isOnline ? platform : '',
        room: !isOnline ? room : '',
        teacher,
        start_time: (parsed?.start_time || '09:45 AM').trim()
      };
      if (parsed?.end_time && typeof parsed.end_time === 'string' && parsed.end_time.trim()) {
        obj.end_time = parsed.end_time.trim();
      }
      cleanAnnouncement = JSON.stringify(obj);
    } catch (e) {
      return { error: 'Invalid online_class payload structure.' };
    }
  } else if (itemType === 'rescheduled') {
    try {
      const parsed = typeof announcement === 'string' ? JSON.parse(announcement) : announcement;
      const obj = {
        original_start_time: (parsed?.original_start_time || '').trim(),
        new_start_time: (parsed?.new_start_time || '').trim(),
        new_end_time: (parsed?.new_end_time || '').trim(),
        new_room: (parsed?.new_room || '').trim(),
        reason: collapseNewlines(parsed?.reason || '')
      };
      cleanAnnouncement = JSON.stringify(obj);
    } catch (e) {
      cleanAnnouncement = collapseNewlines(typeof announcement === 'string' ? announcement : '');
    }
  } else if (itemType === 'assignment') {
    try {
      const parsed = typeof announcement === 'string' ? JSON.parse(announcement) : announcement;
      const obj = {
        task_title: (parsed?.task_title || '').trim(),
        due_time: (parsed?.due_time || '').trim(),
        description: collapseNewlines(parsed?.description || '')
      };
      cleanAnnouncement = JSON.stringify(obj);
    } catch (e) {
      cleanAnnouncement = collapseNewlines(typeof announcement === 'string' ? announcement : '');
    }
  } else {
    cleanAnnouncement = collapseNewlines(typeof announcement === 'string' ? announcement : '');
  }

  return {
    data: {
      name: cleanName,
      title: cleanTitle,
      announcement: cleanAnnouncement,
      subject: (typeof subject === 'string' ? subject.trim() : null) || null,
      type: itemType,
      date_override: (typeof date_override === 'string' ? date_override.trim() : null) || null,
      subject_override: (typeof subject_override === 'string' ? subject_override.trim() : null) || null,
      semester: (typeof semester === 'string' ? semester.trim() : null) || null,
      section: (typeof section === 'string' ? section.trim() : null) || null,
      is_pinned: typeof is_pinned === 'boolean' ? is_pinned : (is_pinned === 'true' ? true : false)
    }
  };
}

module.exports = async (req, res) => {
  // CORS Headers
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
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

  // GET: Fetch all announcements
  if (req.method === 'GET') {
    try {
      let { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) {
        // Fallback in case is_pinned column does not exist in Supabase table
        const fallback = await supabase
          .from('announcements')
          .select('*')
          .order('created_at', { ascending: false });
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

    if (!process.env.ANNOUNCEMENT_PASSWORD) {
      return res.status(503).json({ error: 'Announcement password is not configured on the server.' });
    }
    const expectedPassword = process.env.ANNOUNCEMENT_PASSWORD;
    if (password !== expectedPassword) {
      return res.status(401).json({ error: 'Unauthorized: Invalid password.' });
    }

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

      // 2. Fetch device tokens to send targeted FCM push notifications
      if (firebaseApp) {
        const {
          semester: targetSemester,
          section: targetSection,
          announcement: targetAnnouncement,
          type: targetType,
          title: targetTitle,
          subject: targetSubject,
          date_override: targetDateOverride,
          subject_override: targetSubjectOverride
        } = sanitizedPayload;

        let tokenQuery = supabase.from('fcm_tokens').select('token');
        if (targetSemester) tokenQuery = tokenQuery.eq('semester', targetSemester);
        if (targetSection) tokenQuery = tokenQuery.eq('section', targetSection);

        const { data: tokenRows, error: tokenError } = await tokenQuery;

        if (tokenError) {
          console.error('Error fetching section FCM tokens:', tokenError);
        } else if (tokenRows && tokenRows.length > 0) {
          const tokens = tokenRows.map(row => row.token).filter(Boolean);

          let notificationBody = targetAnnouncement;
          if (targetType === 'online_class') {
            try {
              const parsed = JSON.parse(targetAnnouncement);
              notificationBody = `Online class from ${parsed.start_time || '—'} to ${parsed.end_time || '—'}. Join: ${parsed.platform || 'Link'}`;
            } catch (e) {}
          } else if (targetType === 'class_test') {
            try {
              const parsed = JSON.parse(targetAnnouncement);
              notificationBody = `Exam: ${parsed.exam_name || 'Class Test'}. Topics: ${parsed.topics || 'Not Specified'}`;
            } catch (e) {}
          }

          const BATCH_SIZE = 500;
          const messagePayloads = [];

          for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const batchTokens = tokens.slice(i, i + BATCH_SIZE);
            const message = {
              tokens: batchTokens,
              notification: {
                title: `${targetType === 'cancellation' ? '🚫 ' : targetType === 'holiday' ? '🎉 ' : targetType === 'online_class' ? '📡 ' : targetType === 'class_test' ? '📝 ' : '📢 '}${targetTitle}`,
                body: notificationBody,
              },
              data: {
                type: targetType || 'general',
                subject: targetSubject || '',
                date_override: targetDateOverride || '',
                subject_override: targetSubjectOverride || '',
                semester: targetSemester || '',
                section: targetSection || '',
                announcementId: String(newAnnouncement.id)
              },
              android: {
                priority: 'high',
                notification: {
                  channelId: 'announcements_channel',
                  sound: 'default'
                }
              }
            };
            messagePayloads.push(admin.messaging().sendEachForMulticast(message));
          }

          Promise.all(messagePayloads)
            .then(responses => {
              let successCount = 0;
              let failureCount = 0;
              responses.forEach(resp => {
                successCount += resp.successCount;
                failureCount += resp.failureCount;
              });
              console.log(`Section FCM Notifications sent (${tokens.length} target devices). Successes: ${successCount}, Failures: ${failureCount}`);
            })
            .catch(err => {
              console.error('Error sending multicast FCM notification:', err);
            });
        }
      }

      return res.status(201).json(newAnnouncement);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE: Delete a specific announcement
  if (req.method === 'DELETE') {
    const id = req.body?.id || req.query?.id;
    const password = req.body?.password || req.query?.password;

    if (!id) {
      return res.status(400).json({ error: 'Missing announcement ID.' });
    }

    if (!process.env.ANNOUNCEMENT_PASSWORD) {
      return res.status(503).json({ error: 'Announcement password is not configured on the server.' });
    }
    const expectedPassword = process.env.ANNOUNCEMENT_PASSWORD;
    if (password !== expectedPassword) {
      return res.status(401).json({ error: 'Unauthorized: Invalid password.' });
    }

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
