const https = require('https');
const http = require('http');

function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location, timeoutMs));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Scrapes official CSE faculty directory from Premier University website.
 */
async function scrapeFacultyFromWeb() {
  const mainUrl = 'https://cse.puc.ac.bd/Home/FacultyMembers';
  const mainHtml = await fetchUrl(mainUrl, 15000);
  const memberCards = mainHtml.split('<div class="card border-0 shadow-lg').slice(1);

  if (!memberCards.length) {
    throw new Error('No faculty member cards found on PUC CSE page.');
  }

  const scrapedList = [];
  for (const card of memberCards) {
    const imgMatch = card.match(/src="([^"]+)"/i);
    const photo = imgMatch ? imgMatch[1].trim() : '';

    const statusMatch = card.match(/title="([^"]+)"/i);
    const status = statusMatch ? statusMatch[1].trim() : 'Active';

    const nameMatch = card.match(/<h5 class="member-name[^>]*>([\s\S]*?)<\/h5>/i);
    const name = nameMatch ? cleanText(nameMatch[1]) : '';

    const descMatch = card.match(/<div class="mb-3 text-center"[^>]*>([\s\S]*?)<\/div>/i);
    let designation = '';
    if (descMatch) {
      designation = descMatch[1]
        .replace(/<br\s*\/?>/gi, ' · ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const profileMatch = card.match(/href="([^"]*Profile\?userName=([^"&]+))"/i);
    const profilePath = profileMatch ? profileMatch[1] : '';
    const username = profileMatch ? profileMatch[2] : '';
    const profileUrl = profilePath ? `https://cse.puc.ac.bd${profilePath}` : '';

    if (name) {
      scrapedList.push({
        name,
        username,
        designation,
        status,
        photo,
        profileUrl
      });
    }
  }

  return scrapedList;
}

/**
 * Compares scraped faculty against live Supabase faculty_members table,
 * creating pending suggestions in instructor_edit_suggestions for any diffs.
 */
async function syncFacultyWithSupabase(supabase) {
  if (!supabase) {
    throw new Error('Supabase client is required for syncing faculty.');
  }

  const startTime = Date.now();
  const scrapedList = await scrapeFacultyFromWeb();

  const { data: dbFaculty, error: dbError } = await supabase
    .from('faculty_members')
    .select('teacher_code, official_username, name, designation, photo, source_photo_url, profile_url, status');

  if (dbError) throw dbError;

  const dbMap = {};
  (dbFaculty || []).forEach(row => {
    if (row.official_username) {
      dbMap[row.official_username.toLowerCase()] = row;
    }
  });

  let newSuggestionsCount = 0;
  const changes = [];

  for (const f of scrapedList) {
    const existing = dbMap[f.username.toLowerCase()];

    if (!existing) {
      // 1. Brand new faculty member detected on university site
      const newSuggestion = {
        teacher_code: f.username.toUpperCase(),
        full_name: f.name,
        designation: f.designation,
        photo: f.photo,
        source_photo_url: f.photo,
        profile_url: f.profileUrl,
        status: 'pending',
        source: 'build_scraper',
        submitted_at: new Date().toISOString()
      };

      const { error: insErr } = await supabase
        .from('instructor_edit_suggestions')
        .insert([newSuggestion]);

      if (!insErr) {
        newSuggestionsCount++;
        changes.push({
          type: 'new_faculty',
          teacher_code: f.username.toUpperCase(),
          name: f.name,
          designation: f.designation
        });
      }
    } else {
      // 2. Existing faculty member: check for changed designation or photo
      const desigChanged = f.designation && f.designation !== existing.designation;
      const photoChanged = f.photo && f.photo !== existing.source_photo_url;

      if (desigChanged || photoChanged) {
        const updateSuggestion = {
          teacher_code: existing.teacher_code,
          full_name: f.name,
          designation: f.designation,
          photo: existing.photo || f.photo,
          source_photo_url: f.photo,
          profile_url: f.profileUrl,
          old_data: {
            name: existing.name,
            designation: existing.designation,
            photo: existing.photo,
            source_photo_url: existing.source_photo_url,
            profileUrl: existing.profile_url
          },
          status: 'pending',
          source: 'build_scraper',
          submitted_at: new Date().toISOString()
        };

        const { error: insErr } = await supabase
          .from('instructor_edit_suggestions')
          .insert([updateSuggestion]);

        if (!insErr) {
          newSuggestionsCount++;
          changes.push({
            type: 'profile_update',
            teacher_code: existing.teacher_code,
            name: f.name,
            desigChanged,
            photoChanged,
            oldDesig: existing.designation,
            newDesig: f.designation
          });
        }
      }
    }
  }

  const durationMs = Date.now() - startTime;

  return {
    success: true,
    timestamp: new Date().toISOString(),
    durationMs,
    scrapedCount: scrapedList.length,
    databaseCount: (dbFaculty || []).length,
    newSuggestionsCount,
    changes
  };
}

module.exports = {
  fetchUrl,
  cleanText,
  scrapeFacultyFromWeb,
  syncFacultyWithSupabase
};
