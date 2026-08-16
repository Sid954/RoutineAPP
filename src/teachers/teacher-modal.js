import { DAY_NAMES, DAY_SHORT, CONFIG, FULL_COURSE_NAMES } from '../core/config.js';
import { format12h, toTimeString, getCurrentMinutes } from '../core/utils.js';
import { openModal, closeModal } from '../modals/modal.js';
import { showToast } from '../toast/toast.js';
import { loadMasterTeacherData, searchTeachers, getTeacherClassesForDay, getTeacherWeeklySubjects } from './teacher-finder.js';
import { initTeacherNames, getTeacherInfo, getFullName, submitNameSuggestion, fetchPendingSubmissions, reviewSubmission } from './teacher-names.js';

let _searchQuery = '';
let _lastTeacherResults = [];
let _adminSessionPass = '';
let _currentOpenTeacherData = null;
let _selectedTeacherDetailDay = new Date().getDay();

export function initTeacherFinderUI() {
  const fab = document.getElementById('findTeacherFab');
  const modal = document.getElementById('teacherFinderModal');
  const closeBtn = document.getElementById('teacherFinderCloseBtn');
  const searchInput = document.getElementById('teacherFinderSearchInput');

  // Suggest / Edit modal
  const suggestBtn = document.getElementById('suggestTeacherNameBtn');
  const suggestModal = document.getElementById('suggestTeacherNameModal');
  const suggestCloseBtn = document.getElementById('suggestTeacherCloseBtn');
  const suggestForm = document.getElementById('suggestTeacherForm');
  const suggestCodeSelect = document.getElementById('suggestTeacherCodeSelect');
  const suggestNameInput = document.getElementById('suggestTeacherNameInput');
  const suggestEmailInput = document.getElementById('suggestTeacherEmailInput');
  const suggestPhoneInput = document.getElementById('suggestTeacherPhoneInput');
  const suggestDesigInput = document.getElementById('suggestTeacherDesigInput');

  // Admin Approval modal
  const adminBtn = document.getElementById('teacherAdminBtn');
  const adminModal = document.getElementById('teacherApprovalModal');
  const adminCloseBtn = document.getElementById('teacherApprovalCloseBtn');
  const adminPassInput = document.getElementById('teacherApprovalPassInput');
  const adminLoginBtn = document.getElementById('teacherApprovalLoginBtn');
  const adminAuthBox = document.getElementById('teacherApprovalAuthBox');
  const adminListBox = document.getElementById('teacherApprovalListBox');

  // Teacher detail modal
  const detailModal = document.getElementById('teacherDetailModal');
  const detailCloseBtn = document.getElementById('teacherDetailCloseBtn');
  const dayNav = document.getElementById('teacherDetailDayNav');

  if (!fab || !modal) return;

  // 1. Open Faculty Finder
  const handleFabClick = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    modal.style.display = '';
    openModal(modal);

    const container = document.getElementById('teacherFinderGrid');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: var(--dim);">
          <div style="font-size: 32px; margin-bottom: 8px;" class="spin">⚡</div>
          <div style="font-weight: 700; font-size: 14px; color: var(--text);">Loading faculty directory...</div>
        </div>
      `;
    }

    await Promise.all([loadMasterTeacherData(true), initTeacherNames()]);
    renderTeacherFinderModal();
  };

  fab.addEventListener('click', handleFabClick);

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal(modal));
  if (detailCloseBtn && detailModal) detailCloseBtn.addEventListener('click', () => closeModal(detailModal));

  // Day navigation click handler inside detail modal
  if (dayNav) {
    dayNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.ft-day-btn');
      if (!btn || !_currentOpenTeacherData) return;
      const dayIdx = parseInt(btn.dataset.day, 10);
      _selectedTeacherDetailDay = dayIdx;

      // Update active button state
      dayNav.querySelectorAll('.ft-day-btn').forEach(b => b.classList.toggle('active', b === btn));

      // Render timeline for chosen day
      renderTeacherTimelineForDay(_currentOpenTeacherData.teacher, _selectedTeacherDetailDay);
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value.toLowerCase().trim();
      renderTeacherFinderModal();
    });
  }

  // 2. Suggest / Edit Info Handler
  if (suggestBtn && suggestModal) {
    const openSuggestModalWithCode = (prefillCode = '') => {
      if (suggestCodeSelect && _lastTeacherResults.length > 0) {
        suggestCodeSelect.innerHTML = '<option value="">Select teacher code...</option>' +
          _lastTeacherResults.map(t => {
            const currentName = getFullName(t.teacher);
            const label = currentName && currentName !== t.teacher ? `${t.teacher} (${currentName})` : t.teacher;
            return `<option value="${escapeHtml(t.teacher)}">${escapeHtml(label)}</option>`;
          }).join('');
      }

      if (prefillCode) {
        suggestCodeSelect.value = prefillCode;
        const info = getTeacherInfo(prefillCode);
        if (info) {
          if (suggestNameInput) suggestNameInput.value = info.name !== prefillCode ? info.name : '';
          if (suggestEmailInput) suggestEmailInput.value = (info.emails && info.emails.length > 0) ? info.emails[0] : '';
          if (suggestPhoneInput) suggestPhoneInput.value = info.phone || '';
          if (suggestDesigInput) suggestDesigInput.value = info.designation && info.designation !== 'Faculty Member' ? info.designation : '';
        }
      } else {
        if (suggestNameInput) suggestNameInput.value = '';
        if (suggestEmailInput) suggestEmailInput.value = '';
        if (suggestPhoneInput) suggestPhoneInput.value = '';
        if (suggestDesigInput) suggestDesigInput.value = '';
      }

      openModal(suggestModal);
    };

    suggestBtn.addEventListener('click', () => openSuggestModalWithCode());

    // Allow opening edit modal from profile hero button
    window.__openFacultyEditModal = openSuggestModalWithCode;

    if (suggestCloseBtn) suggestCloseBtn.addEventListener('click', () => closeModal(suggestModal));

    if (suggestCodeSelect) {
      suggestCodeSelect.addEventListener('change', (e) => {
        const code = e.target.value;
        if (code) {
          const info = getTeacherInfo(code);
          if (info) {
            if (suggestNameInput) suggestNameInput.value = info.name !== code ? info.name : '';
            if (suggestEmailInput) suggestEmailInput.value = (info.emails && info.emails.length > 0) ? info.emails[0] : '';
            if (suggestPhoneInput) suggestPhoneInput.value = info.phone || '';
            if (suggestDesigInput) suggestDesigInput.value = info.designation && info.designation !== 'Faculty Member' ? info.designation : '';
          }
        }
      });
    }

    if (suggestForm) {
      suggestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = suggestCodeSelect.value;
        const name = suggestNameInput.value.trim();
        const email = suggestEmailInput ? suggestEmailInput.value.trim() : '';
        const phone = suggestPhoneInput ? suggestPhoneInput.value.trim() : '';
        const desig = suggestDesigInput ? suggestDesigInput.value.trim() : '';

        if (!code || !name) return;

        const submitBtn = document.getElementById('suggestTeacherSubmitBtn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
        }

        try {
          await submitNameSuggestion(code, name, email, phone, desig);
          showToast(`Faculty info for ${code} submitted for review!`, 'success');
          suggestNameInput.value = '';
          if (suggestEmailInput) suggestEmailInput.value = '';
          if (suggestPhoneInput) suggestPhoneInput.value = '';
          if (suggestDesigInput) suggestDesigInput.value = '';
          closeModal(suggestModal);
        } catch (err) {
          showToast(err.message || 'Submission failed.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit for Review';
          }
        }
      });
    }
  }

  // 3. Admin Approval Modal Handler
  if (adminBtn && adminModal) {
    adminBtn.addEventListener('click', () => {
      if (_adminSessionPass) {
        adminAuthBox.style.display = 'none';
        adminListBox.style.display = 'flex';
        loadAdminPendingList(_adminSessionPass);
      } else {
        adminAuthBox.style.display = 'flex';
        adminListBox.style.display = 'none';
      }
      openModal(adminModal);
    });

    if (adminCloseBtn) adminCloseBtn.addEventListener('click', () => closeModal(adminModal));

    if (adminLoginBtn && adminPassInput) {
      adminLoginBtn.addEventListener('click', async () => {
        const pass = adminPassInput.value.trim();
        if (!pass) {
          showToast('Please enter the admin password.', 'warning');
          return;
        }

        adminLoginBtn.disabled = true;
        adminLoginBtn.textContent = 'Verifying...';

        try {
          await loadAdminPendingList(pass);
          _adminSessionPass = pass;
          adminAuthBox.style.display = 'none';
          adminListBox.style.display = 'flex';
        } catch (err) {
          showToast(err.message || 'Invalid admin password.', 'error');
        } finally {
          adminLoginBtn.disabled = false;
          adminLoginBtn.textContent = 'Unlock Approvals';
        }
      });
    }

    // Handle Approve / Reject clicks inside adminListBox
    if (adminListBox) {
      adminListBox.addEventListener('click', async (e) => {
        const approveBtn = e.target.closest('.ft-admin-approve-btn');
        const rejectBtn = e.target.closest('.ft-admin-reject-btn');
        if (!approveBtn && !rejectBtn) return;

        const card = e.target.closest('.ft-admin-pending-card');
        if (!card) return;

        const id = card.dataset.id;
        const code = card.dataset.code;
        const inputEl = card.querySelector('.ft-admin-name-input');
        const editedName = inputEl ? inputEl.value.trim() : '';

        const action = approveBtn ? 'approve' : 'reject';
        const actionBtn = approveBtn || rejectBtn;
        actionBtn.disabled = true;
        actionBtn.textContent = 'Processing...';

        try {
          await reviewSubmission(id, action, code, editedName, _adminSessionPass);
          showToast(`Suggestion for ${code} ${action}d!`, 'success');
          card.remove();
          renderTeacherFinderModal();

          if (!adminListBox.children.length) {
            adminListBox.innerHTML = '<div style="text-align:center; padding:30px 10px; color:var(--dim);">No more pending submissions! 🎉</div>';
          }
        } catch (err) {
          showToast(err.message || 'Action failed.', 'error');
          actionBtn.disabled = false;
          actionBtn.textContent = action === 'approve' ? 'Approve ✅' : 'Reject ❌';
        }
      });
    }
  }

  // 4. Teacher card click -> Open Daily Schedule detail modal
  const listContainer = document.getElementById('teacherFinderGrid');
  if (listContainer) {
    listContainer.addEventListener('click', (e) => {
      const card = e.target.closest('.ft-list-item');
      if (!card) return;
      const teacherCode = card.dataset.teacher;
      if (teacherCode && _lastTeacherResults.length > 0) {
        const teacherData = _lastTeacherResults.find(t => t.teacher === teacherCode);
        if (teacherData) {
          openTeacherDetailModal(teacherData);
        }
      }
    });
  }

  // 5. Global click delegation for ANY clickable teacher badge across the app
  document.body.addEventListener('click', (e) => {
    const badge = e.target.closest('[data-teacher-code], .teacher-clickable-badge');
    if (badge) {
      e.preventDefault();
      e.stopPropagation();
      const code = badge.dataset.teacherCode || badge.textContent;
      openTeacherDetailByCode(code);
    }
  });

  // Pre-fetch fresh data on startup
  Promise.all([loadMasterTeacherData(true), initTeacherNames()]).then(() => {
    updateTeacherFabBadge();
  }).catch(err => {
    console.warn('Background teacher data load error:', err);
  });

  setInterval(() => {
    loadMasterTeacherData(true).then(() => updateTeacherFabBadge());
  }, 60000);
}

async function loadAdminPendingList(password) {
  const adminListBox = document.getElementById('teacherApprovalListBox');
  if (!adminListBox) return;

  adminListBox.innerHTML = '<div style="text-align:center; padding:20px; color:var(--dim);">Loading pending submissions...</div>';
  const pending = await fetchPendingSubmissions(password);

  if (!pending || pending.length === 0) {
    adminListBox.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--dim);">
        <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
        <div style="font-weight: 700; font-size: 15px; color: var(--text); margin-bottom: 4px;">All Caught Up!</div>
        <div style="font-size: 12px;">No pending faculty name submissions to review.</div>
      </div>
    `;
    return;
  }

  let html = '';
  pending.forEach(item => {
    const timeStr = item.submitted_at ? new Date(item.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    html += `
      <div class="ft-admin-pending-card" data-id="${item.id}" data-code="${escapeHtml(item.teacher_code)}" style="background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 15px; font-weight: 900; color: #c084fc;">Code: ${escapeHtml(item.teacher_code)}</span>
          <span style="font-size: 10.5px; color: var(--dim);">${escapeHtml(timeStr)}</span>
        </div>
        <div>
          <label style="font-size: 10px; font-weight: 800; color: var(--dim); text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">Full Name (Editable)</label>
          <input type="text" class="ft-admin-name-input" value="${escapeHtml(item.full_name)}" style="width: 100%; height: 36px; padding: 0 10px; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; color: #fff; font-size: 13px; outline: none;" />
        </div>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
          <button class="ft-admin-reject-btn btn" style="padding: 6px 14px; background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.3); color: #fb7185; font-size: 12px; font-weight: 700; border-radius: 8px; cursor: pointer;">Reject ❌</button>
          <button class="ft-admin-approve-btn btn" style="padding: 6px 16px; background: linear-gradient(135deg, #10b981, #059669); border: none; color: #fff; font-size: 12px; font-weight: 800; border-radius: 8px; cursor: pointer;">Approve ✅</button>
        </div>
      </div>
    `;
  });

  adminListBox.innerHTML = html;
}

export function updateTeacherFabBadge() {
  const badge = document.getElementById('teacherFinderBadge');
  if (!badge) return;

  const currentDay = new Date().getDay();
  const currentMins = getCurrentMinutes();
  const res = searchTeachers(currentDay, currentMins);

  const inClassCount = (res.teachers || []).filter(t => t.status === 'IN_CLASS').length;
  badge.textContent = inClassCount;
  badge.style.display = inClassCount > 0 ? 'flex' : 'none';
}

export function renderTeacherFinderModal() {
  const container = document.getElementById('teacherFinderGrid');
  const summaryEl = document.getElementById('teacherFinderSummary');
  if (!container) return;

  const currentDay = new Date().getDay();
  const currentMins = getCurrentMinutes();
  const res = searchTeachers(currentDay, currentMins);
  const allTeachers = res.teachers || [];
  _lastTeacherResults = allTeachers;

  const inClassCount = allTeachers.filter(t => t.status === 'IN_CLASS').length;

  if (summaryEl) {
    summaryEl.innerHTML = inClassCount > 0
      ? `<span style="color:#34d399; font-weight:800;">${inClassCount} faculty currently teaching in class</span>`
      : `<span style="color:var(--dim); font-weight:600;">Premier University Department of Computer Science & Engineering</span>`;
  }

  // Apply intelligent search query (matching full names, codes, and acronyms)
  let filtered = allTeachers.filter(t => matchesTeacherQuery(t, _searchQuery));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--dim);">
        <div style="font-size: 32px; margin-bottom: 8px;">👨‍🏫</div>
        <div style="font-weight: 700; font-size: 15px; color: var(--text); margin-bottom: 4px;">No faculty match "${escapeHtml(_searchQuery)}"</div>
        <div style="font-size: 12px;">Try searching another faculty name or code.</div>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(item => {
    const isInClass = item.status === 'IN_CLASS';
    const info = getTeacherInfo(item.teacher);
    const hasFullName = info.name && info.name.toLowerCase() !== item.teacher.toLowerCase();
    const displayName = hasFullName ? info.name : item.teacher;
    const initials = (displayName || item.teacher).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const photoHtml = info.photo
      ? `<img class="ft-avatar" src="${escapeHtml(info.photo)}" alt="${escapeHtml(item.teacher)}" onerror="this.outerHTML='<div class=\\'ft-avatar\\'>${initials}</div>'" />`
      : `<div class="ft-avatar">${initials}</div>`;

    const desigText = info.designation && info.designation !== 'Faculty Member'
      ? escapeHtml(info.designation.split('·')[0].trim())
      : 'Faculty Member';

    if (isInClass) {
      const cur = item.currentClass;
      const roomStr = cur.room ? `Room ${escapeHtml(cur.room)}` : escapeHtml(cur.subject);

      html += `
        <div class="ft-list-item ft-item-in-class" data-teacher="${escapeHtml(item.teacher)}" title="Click to view full profile and routine">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            ${photoHtml}
            <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="ft-item-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
                <span style="font-size: 10px; font-weight: 800; color: #a855f7; background: rgba(168,85,247,0.15); padding: 1px 6px; border-radius: 4px; flex-shrink: 0;">${escapeHtml(item.teacher)}</span>
              </div>
              <div style="font-size: 11.5px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desigText}</div>
            </div>
          </div>
          <div class="ft-item-in-class-tag">
            <span>🟢 ${roomStr}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="ft-list-item ft-item-free" data-teacher="${escapeHtml(item.teacher)}" title="Click to view full profile and routine">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
            ${photoHtml}
            <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span class="ft-item-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</span>
                <span style="font-size: 10px; font-weight: 800; color: #a855f7; background: rgba(168,85,247,0.15); padding: 1px 6px; border-radius: 4px; flex-shrink: 0;">${escapeHtml(item.teacher)}</span>
              </div>
              <div style="font-size: 11.5px; color: var(--dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${desigText}</div>
            </div>
          </div>
          <div style="font-size: 13px; color: var(--dim); padding-right: 4px;">›</div>
        </div>
      `;
    }
  });

  container.innerHTML = html;
}

/**
 * Programmatically open teacher profile modal by short code (e.g. 'AIR', 'MHE', 'MHN')
 */
export async function openTeacherDetailByCode(teacherCode) {
  if (!teacherCode) return;
  const cleanCode = String(teacherCode).trim().replace(/^[\s·\(\)]+|[\s·\(\)]+$/g, '');
  if (!cleanCode || cleanCode === '—' || cleanCode.toLowerCase() === 'tba') return;

  const detailModal = document.getElementById('teacherDetailModal');
  const heroContainer = document.getElementById('facultyProfileHero');

  // Immediately open modal and show instantaneous loading spinner
  if (detailModal) {
    if (heroContainer) {
      heroContainer.innerHTML = `
        <div style="text-align: center; padding: 30px 10px 20px; color: var(--dim);">
          <div style="font-size: 32px; margin-bottom: 8px; display: inline-block;" class="spin">⚡</div>
          <div style="font-size: 15px; font-weight: 800; color: #fff;">Loading ${escapeHtml(cleanCode)}'s Profile...</div>
          <div style="font-size: 11.5px; color: var(--dim); margin-top: 3px;">Fetching faculty details</div>
        </div>
      `;
    }
    openModal(detailModal);
  }

  await initTeacherNames();
  openTeacherDetailModal({ teacher: cleanCode });
}

window.__openTeacherProfileByCode = openTeacherDetailByCode;

/** Opens Full Faculty Profile Modal */
export function openTeacherDetailModal(teacherData) {
  const detailModal = document.getElementById('teacherDetailModal');
  const heroContainer = document.getElementById('facultyProfileHero');

  if (!detailModal) return;

  _currentOpenTeacherData = teacherData;

  const info = getTeacherInfo(teacherData.teacher);
  const fullName = info.name || teacherData.teacher;
  const initials = (fullName || teacherData.teacher).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const photoHtml = info.photo
    ? `<img class="ft-avatar ft-avatar-lg" src="${escapeHtml(info.photo)}" alt="${escapeHtml(teacherData.teacher)}" onerror="this.outerHTML='<div class=\\'ft-avatar ft-avatar-lg\\'>${initials}</div>'" />`
    : `<div class="ft-avatar ft-avatar-lg">${initials}</div>`;

  const desigText = info.designation || 'Faculty Member · Department of Computer Science & Engineering';
  const statusBadge = info.status === 'Study Leave'
    ? `<span style="font-size: 10px; font-weight: 800; color: #fbbf24; background: rgba(251,191,36,0.15); padding: 2px 7px; border-radius: 6px;">Study Leave</span>`
    : `<span style="font-size: 10px; font-weight: 800; color: #34d399; background: rgba(52,211,153,0.15); padding: 2px 7px; border-radius: 6px;">Active Faculty</span>`;

  // Build Action Buttons: Only render Email, Call, or PUC Profile if available
  const primaryEmail = (info.emails && info.emails.length > 0) ? info.emails[0] : '';
  const emailBtn = primaryEmail
    ? `<a href="mailto:${escapeHtml(primaryEmail)}" class="ft-action-btn ft-action-btn-primary" title="Send Email: ${escapeHtml(primaryEmail)}">✉️ Email</a>`
    : '';

  const phoneBtn = (info.phone && info.phone.trim())
    ? `<a href="tel:${escapeHtml(info.phone.split(' ')[0])}" class="ft-action-btn" title="Call Faculty: ${escapeHtml(info.phone)}">📞 Call</a>`
    : '';

  const profileBtn = info.profileUrl
    ? `<a href="${escapeHtml(info.profileUrl)}" target="_blank" rel="noopener" class="ft-action-btn" title="View Official PUC Website Profile">🌐 PUC Profile</a>`
    : '';

  const actionsHtml = (emailBtn || phoneBtn || profileBtn)
    ? `<div class="ft-profile-actions">${emailBtn}${phoneBtn}${profileBtn}</div>`
    : '';

  if (heroContainer) {
    heroContainer.innerHTML = `
      <div class="ft-profile-hero-card">
        <div class="ft-profile-top">
          <div class="ft-avatar-wrapper">
            ${photoHtml}
            <button class="ft-avatar-edit-icon-btn" onclick="window.__openFacultyEditModal('${escapeHtml(teacherData.teacher)}')" title="Suggest / Edit faculty info">✏️</button>
          </div>
          <div class="ft-profile-meta">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="ft-profile-name">${escapeHtml(fullName)}</span>
              <span style="font-size: 11px; font-weight: 900; color: #c084fc; background: rgba(168,85,247,0.2); padding: 2px 8px; border-radius: 6px;">${escapeHtml(teacherData.teacher)}</span>
            </div>
            <div class="ft-profile-desig">${escapeHtml(desigText)}</div>
            <div style="margin-top: 4px; display: flex; gap: 6px;">
              ${statusBadge}
            </div>
          </div>
        </div>

        ${actionsHtml}
      </div>
    `;
  }

  openModal(detailModal);
}

const STOP_WORDS = new Set(['and', 'to', 'of', 'the', 'in', 'for', 'on', 'with', '&', 'lab', 'laboratory']);

function normalizeSearchTerm(str) {
  return (str || '').toLowerCase()
    .replace(/electronics/g, 'electronic')
    .replace(/laboratories|laboratory/g, 'lab')
    .replace(/structures/g, 'structure')
    .replace(/devices/g, 'device')
    .replace(/networks/g, 'network')
    .replace(/systems/g, 'system')
    .replace(/algorithms/g, 'algorithm')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTeacherQuery(teacherObj, query) {
  if (!query) return true;
  const qRaw = query.toLowerCase().trim();
  const qNorm = normalizeSearchTerm(query);

  const queryWords = qRaw.split(/[\s.\-_&]+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));
  const isMultiWordQuery = queryWords.length >= 2;
  const qAcronym = isMultiWordQuery ? queryWords.map(w => w[0]).join('') : '';

  const code = (teacherObj.teacher || '').toLowerCase();
  const info = getTeacherInfo(teacherObj.teacher);
  const fullName = (info.name || '').toLowerCase();
  const fullNameNorm = normalizeSearchTerm(fullName);
  const designation = (info.designation || '').toLowerCase();

  // 1. Direct match in teacher code
  if (code === qRaw || (qRaw.length >= 2 && code.includes(qRaw))) return true;

  // 2. Full Name & Designation match
  if (fullName.includes(qRaw) || fullNameNorm.includes(qNorm) || designation.includes(qRaw)) return true;

  // 3. Name Acronym match (e.g. query "Md. Ariful Islam" -> "mai" / "aib")
  if (isMultiWordQuery && qAcronym && (code === qAcronym || code.includes(qAcronym))) return true;

  // 4. Match across ALL subjects and rooms taught across the entire weekly timetable
  const weekly = getTeacherWeeklySubjects(teacherObj.teacher);

  // Check rooms
  if (weekly.rooms.some(r => r.toLowerCase() === qRaw || `room ${r}`.toLowerCase() === qRaw || `room ${r}`.toLowerCase().includes(qRaw))) {
    return true;
  }

  // Check subjects
  for (const sub of weekly.subjects) {
    const subLower = sub.toLowerCase();

    // Direct code match (e.g. 'EDC', 'DS', 'ALGO')
    if (subLower === qRaw || subLower.startsWith(qRaw)) return true;

    // Multi-word query acronym match (e.g. query 'Electronic Devices and Circuits' -> acronym 'edc' == 'edc')
    if (isMultiWordQuery && qAcronym.length >= 2 && (subLower === qAcronym || subLower === qAcronym + 'l')) return true;

    // Full course title match
    const fullTitle = FULL_COURSE_NAMES[sub] || '';
    if (fullTitle) {
      const fullTitleNorm = normalizeSearchTerm(fullTitle);
      const titleWords = fullTitle.toLowerCase().split(/[\s.\-_&]+/).filter(w => w.length > 0 && !STOP_WORDS.has(w));
      const titleAcronym = titleWords.length >= 2 ? titleWords.map(w => w[0]).join('') : '';

      // Direct full title text containment
      if (fullTitleNorm.includes(qNorm)) return true;
      if (qRaw.length >= 2 && titleAcronym && titleAcronym === qRaw) return true;
      if (isMultiWordQuery && titleAcronym && titleAcronym === qAcronym) return true;

      // Word-overlap check: all significant words in query match in full title
      if (queryWords.length >= 2 && queryWords.every(w => fullTitleNorm.includes(w))) {
        return true;
      }
    }
  }

  return false;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
