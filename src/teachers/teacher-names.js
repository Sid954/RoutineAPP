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

  // 2. Load approved remote names from Supabase/API backend
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
        _approvedRemoteNames = await res.json();
        try { localStorage.setItem(REMOTE_NAMES_CACHE_KEY, JSON.stringify(_approvedRemoteNames)); } catch (e) {}
      }
    } catch (e) {}
  }
}

/**
 * Returns full details for a teacher code (combining scraped info + remote approved overrides)
 */
export function getTeacherInfo(code) {
  if (!code) return { code: '', name: '', designation: '', emails: [], photo: '', profileUrl: '' };
  const upper = code.trim().toUpperCase();

  const base = _facultyInfoMap[upper] || _facultyInfoMap[code] || {
    code: code,
    name: code,
    designation: 'Faculty Member',
    emails: [],
    photo: '',
    profileUrl: ''
  };

  // Remote approved name override if present
  const remoteApproved = _approvedRemoteNames[upper] || _approvedRemoteNames[code];
  const finalName = remoteApproved || base.name || code;

  return {
    ...base,
    name: finalName
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
 * Submits a crowdsourced teacher info suggestion to the backend
 */
export async function submitNameSuggestion(code, name, email = '', phone = '', designation = '') {
  if (!code || !name) throw new Error('Teacher code and full name are required.');
  if (!CONFIG.apiBase) throw new Error('API server is not configured.');

  const res = await fetch(`${CONFIG.apiBase}/api/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      designation: designation ? designation.trim() : ''
    })
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
export async function reviewSubmission(id, action, code, name, password, extra = {}) {
  if (!password) throw new Error('Admin password required.');
  if (!CONFIG.apiBase) throw new Error('API server is not configured.');

  const res = await fetch(`${CONFIG.apiBase}/api/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      action,
      code: code ? code.trim().toUpperCase() : '',
      name: name ? name.trim() : '',
      email: extra.email || '',
      phone: extra.phone || '',
      designation: extra.designation || '',
      password
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update submission status.');
  }

  // If approved, update local cache immediately
  if (action === 'approve' && code && name) {
    _approvedRemoteNames[code.trim().toUpperCase()] = name.trim();
    try { localStorage.setItem(REMOTE_NAMES_CACHE_KEY, JSON.stringify(_approvedRemoteNames)); } catch (e) {}

    // Update local facultyInfoMap if present
    const upper = code.trim().toUpperCase();
    if (_facultyInfoMap[upper]) {
      _facultyInfoMap[upper].name = name.trim();
      if (extra.email) _facultyInfoMap[upper].emails = [extra.email];
      if (extra.phone) _facultyInfoMap[upper].phone = extra.phone;
      if (extra.designation) _facultyInfoMap[upper].designation = extra.designation;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(_facultyInfoMap)); } catch (e) {}
    }
  }

  return await res.json();
}
