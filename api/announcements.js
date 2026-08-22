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

  // GET: Fetch all announcements
  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: Publish a new announcement OR update existing OR check password
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
    const { id, isUpdate, action, name, title, announcement, password, subject, type, date_override, subject_override, semester, section, checkPasswordOnly } = req.body || {};

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

    // UPDATE Handler (triggered by PATCH, PUT, or POST with id / isUpdate / action: 'update')
    if (req.method === 'PATCH' || req.method === 'PUT' || isUpdate || action === 'update' || (id && req.method === 'POST')) {
      if (!id) {
        return res.status(400).json({ error: 'Missing announcement ID.' });
      }
      if (!name || !title || !announcement) {
        return res.status(400).json({ error: 'Missing name, title, or announcement content.' });
      }

      try {
        const updatePayload = {
          name,
          title,
          announcement,
          subject: subject || null,
          type: type || 'general',
          date_override: date_override || null,
          subject_override: subject_override || null,
          semester: semester || null,
          section: section || null
        };

        const { data, error } = await supabase
          .from('announcements')
          .update(updatePayload)
          .eq('id', id)
          .select();

        if (error) throw error;
        if (!data || data.length === 0) {
          return res.status(404).json({ error: 'Announcement not found.' });
        }

        return res.status(200).json(data[0]);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // INSERT Handler (new announcement)
    if (!name || !title || !announcement) {
      return res.status(400).json({ error: 'Missing name, title, or announcement content.' });
    }

    try {
      // 1. Insert into Supabase database with semester and section scoping
      const { data, error } = await supabase
        .from('announcements')
        .insert([{ 
          name, 
          title, 
          announcement, 
          subject: subject || null, 
          type: type || 'general', 
          date_override: date_override || null, 
          subject_override: subject_override || null,
          semester: semester || null,
          section: section || null
        }])
        .select();

      if (error) throw error;
      const newAnnouncement = data[0];

      // 2. Fetch device tokens to send targeted FCM push notifications
      if (firebaseApp) {
        let tokenQuery = supabase.from('fcm_tokens').select('token');
        if (semester) tokenQuery = tokenQuery.eq('semester', semester);
        if (section) tokenQuery = tokenQuery.eq('section', section);

        const { data: tokenRows, error: tokenError } = await tokenQuery;

        if (tokenError) {
          console.error('Error fetching section FCM tokens:', tokenError);
        } else if (tokenRows && tokenRows.length > 0) {
          const tokens = tokenRows.map(row => row.token).filter(Boolean);

          let notificationBody = announcement;
          if (type === 'online_class') {
            try {
              const parsed = JSON.parse(announcement);
              notificationBody = `Online class from ${parsed.start_time || '—'} to ${parsed.end_time || '—'}. Join: ${parsed.platform || 'Link'}`;
            } catch (e) {}
          } else if (type === 'class_test') {
            try {
              const parsed = JSON.parse(announcement);
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
                title: `${type === 'cancellation' ? '🚫 ' : type === 'holiday' ? '🎉 ' : type === 'online_class' ? '📡 ' : type === 'class_test' ? '📝 ' : '📢 '}${title}`,
                body: notificationBody,
              },
              data: {
                type: type || 'general',
                subject: subject || '',
                date_override: date_override || '',
                subject_override: subject_override || '',
                semester: semester || '',
                section: section || '',
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
