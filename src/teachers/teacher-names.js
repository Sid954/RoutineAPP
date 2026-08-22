import { CONFIG } from '../core/config.js';

let _facultyInfoMap = {};
let _approvedRemoteNames = {};
const CACHE_KEY = 'routine_faculty_info_cache';
const REMOTE_NAMES_CACHE_KEY = 'routine_approved_teacher_names';

export async function initTeacherNames() {
  // 1. Load bundled static faculty info
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      _facultyInfoMap = JSON.parse(saved);
    }
  } catch (e) {}

  try {
    const res = await fetch('faculty_info.json?v=' + Date.now());
    if (res.ok) {
      _facultyInfoMap = await res.json();
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(_facultyInfoMap)); } catch (e) {}
    }
  } catch (e) {}

  // 2. Load approved remote overrides from Supabase/API backend
  try {
    const savedRemote = localStorage.getItem(REMOTE_NAMES_CACHE_KEY);
    if (savedRemote) {
      _approvedRemoteNames = JSON.parse(savedRemote);
    }
  } catch (e) {}

  if (CONFIG.apiBase) {
    try {
      const res = await fetch(`${CONFIG.apiBase}/api/teachers`, { mode: 'cors' }).catch(() => null);
      if (res && res.ok) {
        const rawOverrides = await res.json();
        if (rawOverrides && typeof rawOverrides === 'object') {
          _approvedRemoteNames = {};
          Object.entries(rawOverrides).forEach(([code, val]) => {
            const upper = code.trim().toUpperCase();
            if (typeof val === 'string') {
              _approvedRemoteNames[upper] = val;
              if (_facultyInfoMap[upper]) {
                _facultyInfoMap[upper].name = val;
              }
            } else if (val && typeof val === 'object') {
              _approvedRemoteNames[upper] = val.name || upper;
              _facultyInfoMap[upper] = {
                ...(_facultyInfoMap[upper] || {}),
                ...val,
                code: upper,
                emails: val.emails || (val.email ? [val.email] : (_facultyInfoMap[upper]?.emails || []))
              };
            }
          });
          try {
            localStorage.setItem(REMOTE_NAMES_CACHE_KEY, JSON.stringify(_approvedRemoteNames));
            localStorage.setItem(CACHE_KEY, JSON.stringify(_facultyInfoMap));
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
}

export function cleanDesignation(desigStr) {
  if (!desigStr) return 'Faculty Member';
  let cleaned = desigStr
    .replace(/[\s·•\-–—,]*Department\s+of\s+Computer\s+Science\s+(?:and|&)\s+Engineering[\s·•\-–—,]*/gi, ' · ')
    .replace(/[\s·•\-–—,]*Dept\.?\s+of\s+CSE[\s·•\-–—,]*/gi, ' · ')
    .replace(/\s*·\s*·\s*/g, ' · ')
    .replace(/^\s*[·•\-–—,]\s*/, '')
    .replace(/\s*[·•\-–—,]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned || 'Faculty Member';
}

export function isGuestTeacher(target, codeParam) {
  let info = target;
  let code = codeParam;
  if (typeof target === 'string') {
    code = target;
    info = getTeacherInfo(target);
    return !!info.isGuest;
  }
  if (!info) return true;
  const upper = String(code || info.code || '').trim().toUpperCase();
  const hasCustomName = info.name && info.name.trim().toUpperCase() !== upper && info.name.trim() !== '';
  const hasEmail = (info.emails && info.emails.length > 0) || (info.email && info.email.trim());
  const hasPhone = info.phone && info.phone.trim();
  const hasPhoto = info.photo && info.photo.trim();
  const hasRealProfile = info.profileUrl && info.profileUrl.trim() && !info.profileUrl.includes('cse.puc.ac.bd/Home/Profile?userName=') && info.profileUrl !== 'https://cse.puc.ac.bd/' && info.profileUrl !== 'http://cse.puc.ac.bd/';
  const hasRealDesig = info.designation && info.designation.trim() && info.designation.trim() !== 'Faculty Member' && info.designation.trim() !== 'Guest Faculty';

  return !hasCustomName && !hasEmail && !hasPhone && !hasPhoto && !hasRealProfile && !hasRealDesig;
}

/**
 * Returns full details for a teacher code (combining scraped info + remote approved overrides)
 */
export function getTeacherInfo(code) {
  if (!code) return { code: '', name: '', designation: '', emails: [], photo: '', profileUrl: '', isGuest: false };
  const clean = String(code).trim();
  const upper = clean.toUpperCase();

  // 1. Direct key match
  let base = _facultyInfoMap[upper] || _facultyInfoMap[clean] || _facultyInfoMap[clean.toLowerCase()];

  // 2. Match by `info.code`
  if (!base) {
    for (const info of Object.values(_facultyInfoMap)) {
      if (info.code && info.code.trim().toUpperCase() === upper) {
        base = info;
        break;
      }
    }
  }

  // 3. Match by `info.officialUsername`
  if (!base) {
    for (const info of Object.values(_facultyInfoMap)) {
      if (info.officialUsername && info.officialUsername.trim().toUpperCase() === upper) {
        base = info;
        break;
      }
    }
  }

  // 4. Match by full name
  if (!base) {
    const cleanNoTitle = clean.replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.|engr\.)\s+/i, '').trim().toLowerCase();
    for (const info of Object.values(_facultyInfoMap)) {
      if (info.name) {
        if (info.name.toLowerCase() === clean.toLowerCase()) {
          base = info;
          break;
        }
        const infoNoTitle = info.name.replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.|engr\.)\s+/i, '').trim().toLowerCase();
        if (cleanNoTitle && infoNoTitle && cleanNoTitle === infoNoTitle) {
          base = info;
          break;
        }
      }
    }
  }

  if (!base) {
    base = {
      code: code,
      name: code,
      designation: 'Faculty Member',
      emails: [],
      photo: '',
      profileUrl: ''
    };
  }

  // Remote approved override if present
  const remoteApproved = _approvedRemoteNames[upper] || _approvedRemoteNames[code];
  const finalName = (typeof remoteApproved === 'string' ? remoteApproved : remoteApproved?.name) || base.name || code;

  const isGuest = isGuestTeacher(base, code) && (!remoteApproved || remoteApproved === code);
  const defaultDesig = 'Faculty Member';
  const finalDesig = cleanDesignation((base.designation && base.designation !== 'Faculty Member' && base.designation !== 'Guest Faculty') ? base.designation : defaultDesig);

  return {
    ...base,
    name: finalName,
    isGuest: isGuest,
    status: isGuest ? 'Guest' : (base.status || 'Active'),
    designation: finalDesig
  };
}

/**
 * Returns all keys/identifiers in the faculty directory (all 42 official faculty + routine codes)
 */
export function getAllFacultyKeys() {
  return Object.keys(_facultyInfoMap);
}

/**
 * Returns all rich faculty entries
 */
export function getAllFacultyEntries() {
  return Object.values(_facultyInfoMap);
}

/**
 * Helper to get the teacher's full name (or returns the code itself if unknown)
 */
export function getFullName(code) {
  const info = getTeacherInfo(code);
  return (info && info.name && info.name !== code) ? info.name : code;
}

/**
 * Bidirectionally resolves any teacher name, alias, or code to their canonical schedule code
 */
export function resolveTeacherCode(input, masterTeacherList = []) {
  if (!input) return '';
  const clean = String(input).trim();
  const upper = clean.toUpperCase();

  // 1. Direct match in faculty info map
  if (_facultyInfoMap[upper]) {
    return _facultyInfoMap[upper].code ? _facultyInfoMap[upper].code.toUpperCase() : upper;
  }

  // 2. Direct match in master schedule teachers list
  if (masterTeacherList && masterTeacherList.includes(upper)) {
    return upper;
  }

  // 3. Match against faculty_info full names (exact and stripped title)
  const cleanNoTitle = clean.replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.|engr\.)\s+/i, '').trim().toLowerCase();
  for (const [code, info] of Object.entries(_facultyInfoMap)) {
    if (info.name) {
      if (info.name.toLowerCase() === clean.toLowerCase()) {
        return info.code ? info.code.toUpperCase() : code.toUpperCase();
      }
      const infoNoTitle = info.name.replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.|engr\.)\s+/i, '').trim().toLowerCase();
      if (cleanNoTitle && infoNoTitle && cleanNoTitle === infoNoTitle) {
        return info.code ? info.code.toUpperCase() : code.toUpperCase();
      }
    }
  }

  // 4. Match against remote approved overrides
  for (const [code, name] of Object.entries(_approvedRemoteNames)) {
    if (name && (name.toLowerCase() === clean.toLowerCase() || name.replace(/^(dr\.|prof\.|mr\.|ms\.|mrs\.|engr\.)\s+/i, '').trim().toLowerCase() === cleanNoTitle)) {
      return code.toUpperCase();
    }
  }

  return upper;
}

/**
 * Submits a crowdsourced teacher info suggestion to the backend
 */
export async function submitNameSuggestion(payloadOrCode, name = '', email = '', phone = '', designation = '', photo = '', profileUrl = '', oldData = null) {
  if (!CONFIG.apiBase) throw new Error('API server is not configured.');

  let payload = {};
  if (typeof payloadOrCode === 'object' && payloadOrCode !== null) {
    payload = {
      code: (payloadOrCode.code || '').trim().toUpperCase(),
      name: (payloadOrCode.name || '').trim(),
      email: (payloadOrCode.email || '').trim(),
      phone: (payloadOrCode.phone || '').trim(),
      designation: (payloadOrCode.designation || '').trim(),
      photo: (payloadOrCode.photo || '').trim(),
      profileUrl: (payloadOrCode.profileUrl || '').trim(),
      oldData: payloadOrCode.oldData || null
    };
  } else {
    payload = {
      code: String(payloadOrCode).trim().toUpperCase(),
      name: (name || '').trim(),
      email: (email || '').trim(),
      phone: (phone || '').trim(),
      designation: (designation || '').trim(),
      photo: (photo || '').trim(),
      profileUrl: (profileUrl || '').trim(),
      oldData: oldData || null
    };
  }

  if (!payload.code) throw new Error('Teacher code is required.');
  if (!payload.name && !payload.email && !payload.phone && !payload.designation && !payload.photo && !payload.profileUrl) {
    throw new Error('At least one updated field is required.');
  }

  const res = await fetch(`${CONFIG.apiBase}/api/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to submit info suggestion.');
  }

  return await res.json();
}

/**
 * Fetches pending submissions for the Admin Moderation Panel (requires admin password)
 */
export async function fetchPendingSubmissions(password) {
  if (!password) throw new Error('Admin password required.');
  if (!CONFIG.apiBase) throw new Error('API server is not configured.');

  const res = await fetch(`${CONFIG.apiBase}/api/teachers?pending=true&password=${encodeURIComponent(password)}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Invalid password or failed to fetch pending updates.');
  }

  return await res.json();
}

/**
 * Approves or rejects a pending submission
 */
export async function reviewSubmission(id, action, code, updatedFields = {}, password = '') {
  if (!password) throw new Error('Admin password required.');
  if (!CONFIG.apiBase) throw new Error('API server is not configured.');

  let fieldPayload = {};
  if (typeof updatedFields === 'string') {
    fieldPayload = { name: updatedFields.trim() };
  } else if (typeof updatedFields === 'object' && updatedFields !== null) {
    fieldPayload = { ...updatedFields };
  }

  const res = await fetch(`${CONFIG.apiBase}/api/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      action,
      code: code ? code.trim().toUpperCase() : '',
      name: fieldPayload.name ? fieldPayload.name.trim() : '',
      email: fieldPayload.email ? fieldPayload.email.trim() : '',
      phone: fieldPayload.phone ? fieldPayload.phone.trim() : '',
      designation: fieldPayload.designation ? fieldPayload.designation.trim() : '',
      photo: fieldPayload.photo ? fieldPayload.photo.trim() : '',
      profileUrl: fieldPayload.profileUrl ? fieldPayload.profileUrl.trim() : '',
      password
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update submission status.');
  }

  // If approved, update local state & cache immediately
  if (action === 'approve' && code) {
    const upper = code.trim().toUpperCase();
    if (fieldPayload.name) {
      _approvedRemoteNames[upper] = fieldPayload.name.trim();
      try { localStorage.setItem(REMOTE_NAMES_CACHE_KEY, JSON.stringify(_approvedRemoteNames)); } catch (e) {}
    }

    _facultyInfoMap[upper] = {
      ...(_facultyInfoMap[upper] || {}),
      code: upper,
      ...(fieldPayload.name ? { name: fieldPayload.name.trim() } : {}),
      ...(fieldPayload.email ? { email: fieldPayload.email.trim(), emails: [fieldPayload.email.trim()] } : {}),
      ...(fieldPayload.phone ? { phone: fieldPayload.phone.trim() } : {}),
      ...(fieldPayload.designation ? { designation: fieldPayload.designation.trim() } : {}),
      ...(fieldPayload.photo ? { photo: fieldPayload.photo.trim() } : {}),
      ...(fieldPayload.profileUrl ? { profileUrl: fieldPayload.profileUrl.trim() } : {})
    };
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(_facultyInfoMap)); } catch (e) {}
  }

  return await res.json();
}

/**
 * Uploads a faculty photo to Supabase Storage via /api/teachers or /api/upload-photo
 */
export async function uploadFacultyPhoto(imageBase64, teacherCode = '', mimeType = 'image/jpeg') {
  if (!CONFIG.apiBase) throw new Error('API server is not configured.');

  let res = null;
  
  // 1. Try /api/teachers with action: upload_photo
  try {
    res = await fetch(`${CONFIG.apiBase}/api/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'upload_photo', imageBase64, teacherCode, mimeType })
    });
  } catch (e) {}

  // 2. Try /api/upload-photo
  if (!res || !res.ok) {
    try {
      const res2 = await fetch(`${CONFIG.apiBase}/api/upload-photo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, teacherCode, mimeType })
      });
      if (res2.ok) res = res2;
    } catch (e) {}
  }

  if (res && res.ok) {
    return await res.json();
  }

  // Graceful fallback for local development before deploying backend changes
  return {
    success: true,
    url: imageBase64,
    isLocalFallback: true
  };
}


