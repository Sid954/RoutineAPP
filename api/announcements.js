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

  // POST: Publish a new announcement OR check password
  if (req.method === 'POST') {
    const { name, title, announcement, password, subject, type, date_override, subject_override, semester, section, checkPasswordOnly } = req.body || {};

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
      const { data: tokensData, error: tokensError } = await supabase
        .from('device_tokens')
        .select('token, semester, section');

      if (!tokensError && tokensData && tokensData.length > 0 && firebaseApp) {
        const targetSem = (semester || '').toString().toLowerCase();
        const targetSec = (section || '').toString().toLowerCase();

        // Filter tokens so only students in target semester & section receive notification
        const tokens = tokensData.filter(t => {
          const semMatch = !targetSem || !t.semester || t.semester.toString().toLowerCase() === targetSem;
          const secMatch = !targetSec || !t.section || t.section.toString().toLowerCase() === targetSec;
          return semMatch && secMatch;
        }).map(t => t.token);

        if (tokens.length > 0) {
          // FCM limit for multicast is 500 tokens per batch
          const batchSize = 500;
          const messagePayloads = [];

          for (let i = 0; i < tokens.length; i += batchSize) {
            const batch = tokens.slice(i, i + batchSize);
            const message = {
              notification: {
                title: `${name}: ${title}`,
                body: announcement.length > 100 ? announcement.substring(0, 97) + '...' : announcement
              },
              data: {
                type: 'announcement',
                announcement_type: type || 'general',
                id: String(newAnnouncement.id),
                semester: String(semester || ''),
                section: String(section || '')
              },
              tokens: batch
            };
            messagePayloads.push(admin.messaging().sendEachForMulticast(message));
          }

          // Run sending in parallel without blocking the response
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
