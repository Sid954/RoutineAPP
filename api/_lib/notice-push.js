/**
 * Shared FCM push for notices (used by api/announcements.js and api/suggestions.js).
 * Initialises Firebase Admin once; without FIREBASE_* env vars every send is skipped.
 */
const admin = require('firebase-admin');
const { pushDecision, pushTitle, noticeChannel } = require('./notif-prefs.js');

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

/**
 * Sends the push for one published notice to the devices of its audience, honouring each
 * device's notice preferences. Awaited by callers: Vercel may freeze the function as soon as
 * the response is sent.
 * @param opts { loudChannel, loudSound, titlePrefix } optional Android channel / title override
 */
async function sendNoticePush(supabase, sanitizedPayload, newAnnouncement, opts = {}) {
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

    // Tokens are written by api/register-token.js into device_tokens (see supabase_schema.sql)
    // With per-device notice preferences (device_tokens.prefs, supabase_notification_prefs.sql);
    // falls back to tokens only when that column doesn't exist yet.
    const tokenQueryFor = cols => {
      let q = supabase.from('device_tokens').select(cols);
      if (targetSemester) q = q.ilike('semester', targetSemester);
      if (targetSection) q = q.ilike('section', targetSection);
      return q;
    };
    let { data: tokenRows, error: tokenError } = await tokenQueryFor('token, prefs');
    if (tokenError && /prefs/i.test(tokenError.message || '')) {
      ({ data: tokenRows, error: tokenError } = await tokenQueryFor('token'));
    }

    if (tokenError) {
      console.error('Error fetching section FCM tokens:', tokenError);
    } else if (tokenRows && tokenRows.length > 0) {
      // Skip devices that turned this notice type off or are paused; quiet hours -> silent channel
      const nowMs = Date.now();
      const loudTokens = [];
      const quietTokens = [];
      const loudChannelOf = new Map(); // token -> the device's own notice channel (its chosen sound), if any
      tokenRows.forEach(row => {
        if (!row.token) return;
        const d = pushDecision(row.prefs, targetType || 'general', nowMs);
        if (!d.send) return;
        (d.quiet ? quietTokens : loudTokens).push(row.token);
        const own = noticeChannel(row.prefs);
        if (own && !d.quiet) loudChannelOf.set(row.token, own);
      });

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
      } else if (targetType === 'rescheduled') {
        try {
          const parsed = JSON.parse(targetAnnouncement);
          notificationBody = `Class rescheduled to ${parsed.new_date ? `${parsed.new_date} at ` : ''}${parsed.new_start_time || 'new slot'}${parsed.new_room ? ` (Room ${parsed.new_room})` : ''}`;
        } catch (e) {}
      } else if (targetType === 'assignment') {
        try {
          const parsed = JSON.parse(targetAnnouncement);
          const taskTitle = parsed.task_title || 'Assignment';
          const dueTime = parsed.due_time || '';
          const desc = (parsed.description || '').trim();
          notificationBody = `${taskTitle}${dueTime ? ` — Due ${dueTime}` : ''}${desc ? `. ${desc.length > 60 ? desc.slice(0, 57) + '…' : desc}` : ''}`;
        } catch (e) {}
      }

      const BATCH_SIZE = 500;
      const messagePayloads = [];
      const tokens = loudTokens.concat(quietTokens);
      const batches = [];
      // Loud pushes grouped by the channel each device chose (its notice sound); the rest use the default one
      const loudGroups = new Map();
      loudTokens.forEach(t => { const ch = loudChannelOf.get(t) || ''; if (!loudGroups.has(ch)) loudGroups.set(ch, []); loudGroups.get(ch).push(t); });
      loudGroups.forEach((list, ch) => {
        for (let i = 0; i < list.length; i += BATCH_SIZE) batches.push({ list: list.slice(i, i + BATCH_SIZE), quiet: false, channel: opts.loudChannel ? '' : ch });
      });
      for (let i = 0; i < quietTokens.length; i += BATCH_SIZE) batches.push({ list: quietTokens.slice(i, i + BATCH_SIZE), quiet: true });

      for (const batch of batches) {
        const batchTokens = batch.list;
        const message = {
          tokens: batchTokens,
          notification: {
            title: opts.titlePrefix ? `${opts.titlePrefix}${targetTitle}` : pushTitle(targetType || 'general', targetTitle),
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
          android: batch.quiet
            ? { priority: 'normal', notification: { channelId: 'notices_quiet' } }
            : { priority: 'high', notification: opts.loudChannel ? { channelId: opts.loudChannel, sound: opts.loudSound || 'default' } : (batch.channel ? { channelId: batch.channel } : { channelId: 'announcements_channel', sound: 'default' }) }
        };
        messagePayloads.push({ batchTokens, send: admin.messaging().sendEachForMulticast(message) });
      }

      // Must be awaited BEFORE responding: Vercel may freeze the function as soon as
      // the response is sent, silently dropping un-awaited sends.
      try {
        const responses = await Promise.all(messagePayloads.map(p => p.send));
        let successCount = 0;
        let failureCount = 0;
        const deadTokens = [];
        responses.forEach((resp, batchIdx) => {
          successCount += resp.successCount;
          failureCount += resp.failureCount;
          (resp.responses || []).forEach((r, i) => {
            const code = r.error && r.error.code;
            if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
              deadTokens.push(messagePayloads[batchIdx].batchTokens[i]);
            }
          });
        });
        console.log(`Section FCM Notifications sent (${tokens.length} target devices). Successes: ${successCount}, Failures: ${failureCount}`);

        // Prune tokens FCM reports as permanently invalid (uninstalled apps, etc.)
        if (deadTokens.length > 0) {
          const { error: pruneError } = await supabase.from('device_tokens').delete().in('token', deadTokens);
          if (pruneError) console.error('Error pruning dead FCM tokens:', pruneError);
          else console.log(`Pruned ${deadTokens.length} dead FCM tokens.`);
        }
      } catch (err) {
        console.error('Error sending multicast FCM notification:', err);
      }
    }
  }
}

module.exports = { sendNoticePush };
