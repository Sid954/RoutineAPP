/**
 * Community suggestions: anyone can suggest a notice, devices on the same section vote on it,
 * and enough votes (or the announcement password) turn it into a normal notice.
 * Rules and thresholds live in _lib/suggestion-rules.js; design notes in NEXT_TASKS.md (item 17).
 * Tables: supabase_suggestions.sql. All access uses the service role; the client never talks to Supabase.
 *
 *   GET  ?semester=&section=     pending suggestions for that section + department-wide, with vote counts
 *   POST action=suggest          { device, name, title, announcement, type, subject, date_override, subject_override, semester, section }
 *   POST action=vote             { device, id, value: 1 | -1 | 0, semester, section }   (semester/section = the voter's own)
 *   POST action=admin_list       { password }                      everything pending, including hidden ones
 *   POST action=approve|reject   { password, id }
 */
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_OPTIONS } = require('./_lib/supabase-options.js');
const { applyCors } = require('./_lib/cors.js');
const { checkPassword, guard, getClientIp, createRateLimiter } = require('./_lib/security.js');
const { sanitizeAndValidatePayload } = require('./_lib/announcement-payload.js');
const { sendNoticePush } = require('./_lib/notice-push.js');
const { RULES, dedupeKey, tally, stateOf, canVote } = require('./_lib/suggestion-rules.js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey, SUPABASE_OPTIONS) : null;

const MAX_LIST = 300;
const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;
const ipSuggestLimiter = createRateLimiter({ max: RULES.PER_IP_PER_HOUR, windowMs: 60 * 60 * 1000 });

const clean = v => String(v == null ? '' : v).trim().toLowerCase();
const cutoffIso = () => new Date(Date.now() - RULES.EXPIRE_MS).toISOString();

/** Public shape of a suggestion (never exposes device ids). */
function publicRow(row, t) {
  return {
    id: row.id, created_at: row.created_at, name: row.name, title: row.title, announcement: row.announcement,
    subject: row.subject, type: row.type, date_override: row.date_override, subject_override: row.subject_override,
    semester: row.semester, section: row.section,
    up: t.up, down: t.down, state: stateOf(row, t)
  };
}

/** Map of suggestion id -> { up, down } from the votes table. */
async function loadTallies(ids) {
  const map = new Map(ids.map(id => [id, { up: 0, down: 0 }]));
  if (!ids.length) return map;
  const { data, error } = await supabase.from('suggestion_votes').select('suggestion_id, value').in('suggestion_id', ids);
  if (error) throw error;
  (data || []).forEach(v => {
    const m = map.get(v.suggestion_id);
    if (m) { if (v.value > 0) m.up++; else m.down++; }
  });
  return map;
}

async function tallyOne(id) {
  const m = await loadTallies([id]);
  const v = m.get(id) || { up: 0, down: 0 };
  return tally(v.up, v.down);
}

/**
 * Turns a pending suggestion into a normal notice. The status flip is the atomic claim, so two
 * simultaneous votes can never publish it twice. via: 'community' (votes) | 'admin'.
 */
async function promote(sug, via) {
  const claim = await supabase.from('suggestions').update({ status: 'approved' }).eq('id', sug.id).eq('status', 'pending').select('id');
  if (claim.error) throw claim.error;
  if (!claim.data || !claim.data.length) return null; // someone else already decided it

  const payload = {
    name: sug.name, title: sug.title, announcement: sug.announcement, subject: sug.subject || null, type: sug.type,
    date_override: sug.date_override || null, subject_override: sug.subject_override || null,
    semester: sug.semester || null, section: sug.section || null, is_pinned: false
  };
  let ins = await supabase.from('announcements').insert([via === 'community' ? { ...payload, source: 'community' } : payload]).select();
  if (ins.error) ins = await supabase.from('announcements').insert([payload]).select(); // `source` column not added yet
  if (ins.error || !ins.data || !ins.data[0]) {
    await supabase.from('suggestions').update({ status: 'pending' }).eq('id', sug.id); // give it back
    throw ins.error || new Error('Could not publish the suggestion.');
  }
  const notice = ins.data[0];
  await supabase.from('suggestions').update({ announcement_id: notice.id }).eq('id', sug.id);

  try {
    await sendNoticePush(supabase, payload, notice, via === 'community'
      ? { loudChannel: 'suggestions_channel', loudSound: 'suggestion_chime', titlePrefix: 'Community confirmed: ' }
      : {});
  } catch (e) {
    console.error('Suggestion push failed:', e);
  }
  return notice;
}

async function handleList(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
  const sem = clean(req.query && req.query.semester);
  const sec = clean(req.query && req.query.section);
  const { data, error } = await supabase.from('suggestions').select('*').eq('status', 'pending')
    .gte('created_at', cutoffIso()).order('created_at', { ascending: false }).limit(MAX_LIST);
  if (error) throw error;
  const mine = (data || []).filter(r => (!clean(r.semester) && !clean(r.section)) || (clean(r.semester) === sem && clean(r.section) === sec));
  const tallies = await loadTallies(mine.map(r => r.id));
  const rows = mine.map(r => { const v = tallies.get(r.id); return publicRow(r, tally(v.up, v.down)); })
    .filter(r => r.state !== 'hidden' && r.state !== 'expired');
  return res.status(200).json(rows);
}

async function handleSuggest(req, res, body) {
  if (!DEVICE_RE.test(String(body.device || ''))) return res.status(400).json({ error: 'Missing device id.' });
  const v = sanitizeAndValidatePayload(body);
  if (v.error) return res.status(400).json({ error: v.error });
  const p = v.data;
  if (!!p.semester !== !!p.section) return res.status(400).json({ error: 'Suggest to one section or to the whole department.' });

  const ip = getClientIp(req);
  if (ipSuggestLimiter.isLimited(ip)) return res.status(429).json({ error: 'Too many suggestions from this network. Try again in an hour.' });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today = await supabase.from('suggestions').select('id', { count: 'exact', head: true }).eq('device_id', body.device).gte('created_at', since);
  if (today.error) throw today.error;
  if ((today.count || 0) >= RULES.PER_DEVICE_PER_DAY) return res.status(429).json({ error: `You can suggest ${RULES.PER_DEVICE_PER_DAY} notices a day.` });

  const key = dedupeKey(p);
  const dup = await supabase.from('suggestions').select('id').eq('dedupe_key', key).eq('status', 'pending').gte('created_at', cutoffIso()).limit(1);
  if (dup.error) throw dup.error;
  if (dup.data && dup.data.length) return res.status(409).json({ error: 'Someone already suggested this.', duplicateId: dup.data[0].id });

  ipSuggestLimiter.hit(ip);
  const { is_pinned, ...fields } = p; // suggestions are never pinned
  const ins = await supabase.from('suggestions').insert([{ ...fields, device_id: body.device, dedupe_key: key }]).select();
  if (ins.error) throw ins.error;
  const row = ins.data[0];
  await supabase.from('suggestion_votes').upsert([{ suggestion_id: row.id, device_id: body.device, value: 1 }]); // the suggester agrees
  return res.status(201).json(publicRow(row, tally(1, 0)));
}

async function handleVote(req, res, body) {
  if (!DEVICE_RE.test(String(body.device || ''))) return res.status(400).json({ error: 'Missing device id.' });
  const value = Number(body.value);
  if (![1, -1, 0].includes(value)) return res.status(400).json({ error: 'Invalid vote.' });
  const id = Number(body.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Missing suggestion id.' });

  const got = await supabase.from('suggestions').select('*').eq('id', id).limit(1);
  if (got.error) throw got.error;
  const sug = got.data && got.data[0];
  if (!sug || sug.status !== 'pending') return res.status(404).json({ error: 'This suggestion is no longer open.' });
  if (!canVote(sug, body.semester, body.section)) return res.status(403).json({ error: 'Only students of that section can vote on it.' });

  if (value === 0) {
    const del = await supabase.from('suggestion_votes').delete().eq('suggestion_id', id).eq('device_id', body.device);
    if (del.error) throw del.error;
  } else {
    const up = await supabase.from('suggestion_votes').upsert([{ suggestion_id: id, device_id: body.device, value }]);
    if (up.error) throw up.error;
  }

  const t = await tallyOne(id);
  let state = stateOf(sug, t);
  if (state === 'auto') {
    const notice = await promote(sug, 'community');
    return res.status(200).json({ id, up: t.up, down: t.down, state: 'approved', announcementId: notice ? notice.id : null });
  }
  return res.status(200).json({ id, up: t.up, down: t.down, state });
}

async function handleAdmin(req, res, body, action) {
  const auth = checkPassword(req, body.password, process.env.ANNOUNCEMENT_PASSWORD);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  if (action === 'admin_list') {
    const { data, error } = await supabase.from('suggestions').select('*').eq('status', 'pending')
      .gte('created_at', cutoffIso()).order('created_at', { ascending: false }).limit(MAX_LIST);
    if (error) throw error;
    const tallies = await loadTallies((data || []).map(r => r.id));
    return res.status(200).json((data || []).map(r => { const v = tallies.get(r.id); return publicRow(r, tally(v.up, v.down)); }));
  }

  const id = Number(body.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Missing suggestion id.' });
  const got = await supabase.from('suggestions').select('*').eq('id', id).limit(1);
  if (got.error) throw got.error;
  const sug = got.data && got.data[0];
  if (!sug || sug.status !== 'pending') return res.status(404).json({ error: 'This suggestion is no longer open.' });

  if (action === 'reject') {
    const r = await supabase.from('suggestions').update({ status: 'rejected' }).eq('id', id).eq('status', 'pending');
    if (r.error) throw r.error;
    return res.status(200).json({ success: true, state: 'rejected' });
  }
  const notice = await promote(sug, 'admin');
  return res.status(200).json({ success: true, state: 'approved', announcementId: notice ? notice.id : null });
}

module.exports = async (req, res) => {
  if (applyCors(req, res, 'GET,POST,OPTIONS')) return;
  if (!supabase) return res.status(500).json({ error: 'Supabase credentials are not configured on the server.' });

  try {
    if (req.method === 'GET') {
      if (guard(req, res, 'suggestions', { read: { max: 90, windowMs: 60 * 1000 } })) return;
      return await handleList(req, res);
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || '');
      if (action === 'vote') {
        if (guard(req, res, 'suggestions-vote', { write: { max: 60, windowMs: 10 * 60 * 1000 } })) return;
        return await handleVote(req, res, body);
      }
      if (action === 'suggest') {
        if (guard(req, res, 'suggestions-suggest', { write: { max: 10, windowMs: 10 * 60 * 1000 } })) return;
        return await handleSuggest(req, res, body);
      }
      if (action === 'admin_list' || action === 'approve' || action === 'reject') {
        if (guard(req, res, 'suggestions-admin', { write: { max: 30, windowMs: 10 * 60 * 1000 } })) return;
        return await handleAdmin(req, res, body, action);
      }
      return res.status(400).json({ error: 'Unknown action.' });
    }
    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('suggestions error:', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
};
