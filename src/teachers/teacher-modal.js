import { DAY_NAMES, DAY_SHORT, FULL_COURSE_NAMES } from '../core/config.js';
import { format12h, getCurrentMinutes } from '../core/utils.js';
import { openModal, closeModal } from '../modals/modal.js';
import { showToast } from '../toast/toast.js';
import { loadMasterTeacherData, searchTeachers, getTeacherClassesForDay, getTeacherWeeklySubjects } from './teacher-finder.js';
import { initTeacherNames, getTeacherInfo, resolveTeacherCode, submitNameSuggestion, fetchPendingSubmissions, reviewSubmission, uploadFacultyPhoto, getAllFacultyKeys } from './teacher-names.js';

let _searchQuery = '';
let _lastTeacherResults = [];
let _adminSessionPass = '';
let _currentOpenTeacherData = null;
let _selectedTeacherDetailDay = new Date().getDay();

export function initTeacherFinderUI() {
  const backBtn = document.getElementById('facultyPageBackBtn');
  const searchInput = document.getElementById('teacherFinderSearchInput');
  const searchClear = document.getElementById('teacherFinderSearchClear');

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (window.switchAppView) window.switchAppView('apps');
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value.trim();
      if (searchClear) searchClear.style.display = _searchQuery ? 'block' : 'none';
      renderTeacherFinderModal();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        _searchQuery = '';
      }
      searchClear.style.display = 'none';
      renderTeacherFinderModal();
    });
  }

  window.__renderFacultyDirectory = renderTeacherFinderModal;

  // Suggest / Edit modal
  const suggestBtn = document.getElementById('suggestTeacherNameBtn');
  const suggestModal = document.getElementById('suggestTeacherNameModal');
  const suggestCloseBtn = document.getElementById('suggestTeacherCloseBtn');
  const suggestForm = document.getElementById('suggestTeacherForm');
  const suggestCodeSelect = document.getElementById('suggestTeacherCodeSelect');
  const suggestCodeLockedBox = document.getElementById('suggestTeacherCodeLockedBox');
  const suggestCodeLockedBadge = document.getElementById('suggestTeacherCodeLockedBadge');
  const suggestNameLockedLabel = document.getElementById('suggestTeacherNameLockedLabel');
  const suggestNameInput = document.getElementById('suggestTeacherNameInput');
  const suggestEmailInput = document.getElementById('suggestTeacherEmailInput');
  const suggestPhoneInput = document.getElementById('suggestTeacherPhoneInput');
  const suggestDesigInput = document.getElementById('suggestTeacherDesigInput');
  const suggestPhotoInput = document.getElementById('suggestTeacherPhotoInput');
  const suggestPhotoFileInput = document.getElementById('suggestTeacherPhotoFileInput');
  const suggestUploadBtn = document.getElementById('suggestTeacherUploadBtn');
  const suggestUploadBtnText = document.getElementById('suggestTeacherUploadBtnText');
  const suggestRemovePhotoBtn = document.getElementById('suggestTeacherRemovePhotoBtn');
  const suggestPhotoPreview = document.getElementById('suggestTeacherPhotoPreview');
  const suggestPhotoStatus = document.getElementById('suggestTeacherPhotoStatus');
  const suggestProfileInput = document.getElementById('suggestTeacherProfileInput');

  let _currentEditingOldData = null;
  let _currentEditingLockedCode = '';

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

  if (detailCloseBtn && detailModal) detailCloseBtn.addEventListener('click', () => closeModal(detailModal));
  if (detailModal) {
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) closeModal(detailModal);
    });
  }

  if (dayNav) {
    dayNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.ft-day-btn');
      if (!btn || !_currentOpenTeacherData) return;
      const dayIdx = parseInt(btn.dataset.day, 10);
      _selectedTeacherDetailDay = dayIdx;
      dayNav.querySelectorAll('.ft-day-btn').forEach(b => b.classList.toggle('active', b === btn));
      renderTeacherTimelineForDay(_currentOpenTeacherData.teacher, _selectedTeacherDetailDay);
    });
  }

  // 2. Suggest / Edit Info Handler
  if (suggestBtn && suggestModal) {
    const renderPhotoPreview = (url) => {
      const cleanUrl = url ? String(url).trim() : '';
      if (suggestPhotoInput) suggestPhotoInput.value = cleanUrl;

      if (cleanUrl) {
        if (suggestPhotoPreview) {
          suggestPhotoPreview.innerHTML = `<img src="${escapeHtml(cleanUrl)}" alt="Photo Preview" onload="this.classList.add('loaded');" onerror="this.remove();" />`;
        }
        if (suggestRemovePhotoBtn) suggestRemovePhotoBtn.style.display = 'inline-block';
        if (suggestUploadBtnText) suggestUploadBtnText.textContent = 'Change Photo';
        if (suggestPhotoStatus) suggestPhotoStatus.innerHTML = '<span style="color: #34d399; font-weight: 700;">✅ Photo attached</span>';
      } else {
        if (suggestPhotoPreview) {
          suggestPhotoPreview.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 20px; height: 20px; color: var(--dim);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`;
        }
        if (suggestRemovePhotoBtn) suggestRemovePhotoBtn.style.display = 'none';
        if (suggestUploadBtnText) suggestUploadBtnText.textContent = 'Upload Photo';
        if (suggestPhotoStatus) suggestPhotoStatus.textContent = 'JPG, PNG, or WebP up to 3MB';
      }
    };

    const compressImage = (file, maxWidth = 600, maxHeight = 600, quality = 0.85) => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve({ base64: compressedDataUrl, mimeType: 'image/jpeg' });
          };
          img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
      });
    };

    if (suggestUploadBtn && suggestPhotoFileInput) {
      suggestUploadBtn.addEventListener('click', () => suggestPhotoFileInput.click());
      suggestPhotoFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        if (!file.type.match(/^image\/(jpeg|png|webp|jpg)$/i)) {
          showToast('Please select a valid image file.', 'warning');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          showToast('Selected photo is larger than 5MB.', 'warning');
          return;
        }
        const currentCode = (_currentEditingLockedCode || (suggestCodeSelect ? suggestCodeSelect.value : '') || _currentEditingOldData?.code || 'faculty').trim();
        try {
          if (suggestUploadBtn) suggestUploadBtn.disabled = true;
          if (suggestUploadBtnText) suggestUploadBtnText.textContent = 'Uploading...';
          if (suggestPhotoStatus) suggestPhotoStatus.textContent = 'Compressing and uploading photo...';
          const { base64, mimeType } = await compressImage(file);
          if (suggestPhotoPreview) suggestPhotoPreview.innerHTML = `<img src="${base64}" alt="Preview" />`;
          const uploadRes = await uploadFacultyPhoto(base64, currentCode, mimeType);
          if (uploadRes && uploadRes.url) {
            renderPhotoPreview(uploadRes.url);
            if (uploadRes.isLocalFallback) {
              showToast('Photo attached! (Deploy backend to save in Supabase bucket)', 'info');
            } else {
              showToast('Photo uploaded successfully to Supabase!', 'success');
            }
          }
        } catch (err) {
          console.error(err);
          showToast(err.message || 'Failed to attach photo.', 'error');
          renderPhotoPreview(_currentEditingOldData?.photo || '');
        } finally {
          if (suggestUploadBtn) suggestUploadBtn.disabled = false;
          suggestPhotoFileInput.value = '';
        }
      });
    }

    if (suggestRemovePhotoBtn) {
      suggestRemovePhotoBtn.addEventListener('click', () => {
        renderPhotoPreview('');
        showToast('Photo removed from suggestion.', 'info');
      });
    }

    const populateFieldsForCode = (code) => {
      if (!code) {
        _currentEditingOldData = null;
        if (suggestNameInput) suggestNameInput.value = '';
        if (suggestEmailInput) suggestEmailInput.value = '';
        if (suggestPhoneInput) suggestPhoneInput.value = '';
        if (suggestDesigInput) suggestDesigInput.value = '';
        renderPhotoPreview('');
        if (suggestProfileInput) suggestProfileInput.value = '';
        return;
      }
      const info = getTeacherInfo(code);
      if (info) {
        _currentEditingOldData = {
          code: code,
          name: (info.name && info.name !== code) ? info.name : '',
          email: (info.emails && info.emails.length > 0) ? info.emails[0] : (info.email || ''),
          phone: info.phone || '',
          designation: (info.designation && info.designation !== 'Faculty Member' && info.designation !== 'Guest Faculty') ? info.designation : '',
          photo: info.photo || '',
          profileUrl: (info.profileUrl && !info.profileUrl.includes('cse.puc.ac.bd/Home/Profile?userName=')) ? info.profileUrl : ''
        };
        if (suggestNameInput) suggestNameInput.value = _currentEditingOldData.name;
        if (suggestEmailInput) suggestEmailInput.value = _currentEditingOldData.email;
        if (suggestPhoneInput) suggestPhoneInput.value = _currentEditingOldData.phone;
        if (suggestDesigInput) suggestDesigInput.value = _currentEditingOldData.designation;
        renderPhotoPreview(_currentEditingOldData.photo);
        if (suggestProfileInput) suggestProfileInput.value = _currentEditingOldData.profileUrl;
      }
    };

    let _cooldownTimerInterval = null;

    const checkAndUpdateCooldownUI = () => {
      const submitBtn = document.getElementById('suggestTeacherSubmitBtn');
      const cooldownBanner = document.getElementById('suggestTeacherCooldownBanner');
      const cooldownTimer = document.getElementById('suggestTeacherCooldownTimer');

      const cooldownUntil = parseInt(localStorage.getItem('faculty_suggest_cooldown_until') || '0', 10);
      const remainingMs = cooldownUntil - Date.now();

      if (remainingMs > 0) {
        const remainingSec = Math.ceil(remainingMs / 1000);
        if (cooldownBanner) cooldownBanner.style.display = 'flex';
        if (cooldownTimer) cooldownTimer.textContent = `${remainingSec}s`;
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }

        if (!_cooldownTimerInterval) {
          _cooldownTimerInterval = setInterval(() => {
            checkAndUpdateCooldownUI();
          }, 1000);
        }
        return true;
      } else {
        if (_cooldownTimerInterval) {
          clearInterval(_cooldownTimerInterval);
          _cooldownTimerInterval = null;
        }
        if (cooldownBanner) cooldownBanner.style.display = 'none';
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
        }
        return false;
      }
    };

    const openSuggestModalWithCode = (prefillCode = '') => {
      const cleanPrefill = (prefillCode || '').trim().toUpperCase();
      if (cleanPrefill) {
        _currentEditingLockedCode = cleanPrefill;
        const info = getTeacherInfo(cleanPrefill);
        if (suggestCodeLockedBox) suggestCodeLockedBox.style.display = 'flex';
        if (suggestCodeSelect) suggestCodeSelect.style.display = 'none';
        if (suggestCodeLockedBadge) suggestCodeLockedBadge.textContent = cleanPrefill;
        if (suggestNameLockedLabel) {
          const displayLabel = (info.name && info.name !== cleanPrefill) ? info.name : cleanPrefill;
          suggestNameLockedLabel.textContent = displayLabel;
        }
        populateFieldsForCode(cleanPrefill);
      } else {
        _currentEditingLockedCode = '';
        if (suggestCodeLockedBox) suggestCodeLockedBox.style.display = 'none';
        if (suggestCodeSelect) {
          suggestCodeSelect.style.display = 'block';
          const allCodes = Array.from(new Set(getAllFacultyKeys().map(k => k.toUpperCase()))).sort();
          suggestCodeSelect.innerHTML = '<option value="">Select teacher code...</option>' +
            allCodes.map(code => {
              const info = getTeacherInfo(code);
              const label = (info.name && info.name !== code) ? `${code} — ${info.name}` : code;
              return `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`;
            }).join('');
          suggestCodeSelect.value = '';
        }
        populateFieldsForCode('');
      }

      checkAndUpdateCooldownUI();
      openModal(suggestModal);
    };

    suggestBtn.addEventListener('click', () => openSuggestModalWithCode());
    window.__openFacultyEditModal = openSuggestModalWithCode;
    if (suggestCloseBtn) suggestCloseBtn.addEventListener('click', () => closeModal(suggestModal));
    if (suggestCodeSelect) suggestCodeSelect.addEventListener('change', (e) => populateFieldsForCode(e.target.value));

    if (suggestForm) {
      suggestForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Double-click & cooldown check
        if (checkAndUpdateCooldownUI()) {
          showToast('Please wait before submitting another suggestion.', 'warning');
          return;
        }

        const code = (_currentEditingLockedCode || (suggestCodeSelect ? suggestCodeSelect.value : '') || _currentEditingOldData?.code || '').trim();
        const name = suggestNameInput ? suggestNameInput.value.trim() : '';
        const email = suggestEmailInput ? suggestEmailInput.value.trim() : '';
        const phone = suggestPhoneInput ? suggestPhoneInput.value.trim() : '';
        const desig = suggestDesigInput ? suggestDesigInput.value.trim() : '';
        const photo = suggestPhotoInput ? suggestPhotoInput.value.trim() : '';
        const profileUrl = suggestProfileInput ? suggestProfileInput.value.trim() : '';

        if (!code) {
          showToast('Please select a teacher code.', 'warning');
          return;
        }

        if (!name && !email && !phone && !desig && !photo && !profileUrl) {
          showToast('Please fill in at least one field to suggest.', 'warning');
          return;
        }

        // 2. Client-side Format Validations
        if (email) {
          const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
          if (!emailRegex.test(email)) {
            showToast('Please enter a valid email address.', 'warning');
            if (suggestEmailInput) suggestEmailInput.focus();
            return;
          }
        }

        if (phone) {
          const digitCount = (phone.match(/\d/g) || []).length;
          if (digitCount < 6) {
            showToast('Please enter a valid phone number (at least 6 digits).', 'warning');
            if (suggestPhoneInput) suggestPhoneInput.focus();
            return;
          }
        }

        if (profileUrl) {
          try {
            const parsed = new URL(profileUrl);
            if (!parsed.protocol.startsWith('http')) throw new Error();
            if (!parsed.hostname.endsWith('puc.ac.bd')) {
              showToast('PUC Profile URL must be on the *.puc.ac.bd university domain.', 'warning');
              if (suggestProfileInput) suggestProfileInput.focus();
              return;
            }
          } catch (err) {
            showToast('Please enter a valid PUC Profile URL (e.g. https://cse.puc.ac.bd/...).', 'warning');
            if (suggestProfileInput) suggestProfileInput.focus();
            return;
          }
        }

        // 3. Client-side No-Op Detection
        const isSameName = (name.trim()) === (_currentEditingOldData?.name || '').trim();
        const isSameEmail = (email.trim().toLowerCase()) === (_currentEditingOldData?.email || '').trim().toLowerCase();
        const isSamePhone = (phone.trim()) === (_currentEditingOldData?.phone || '').trim();
        const isSameDesig = (desig.trim()) === (_currentEditingOldData?.designation || '').trim();
        const isSamePhoto = (photo.trim()) === (_currentEditingOldData?.photo || '').trim();
        const isSameProfile = (profileUrl.trim()) === (_currentEditingOldData?.profileUrl || '').trim();

        if (isSameName && isSameEmail && isSamePhone && isSameDesig && isSamePhoto && isSameProfile) {
          showToast('No changes detected. Please modify at least one field before submitting.', 'warning');
          return;
        }

        const submitBtn = document.getElementById('suggestTeacherSubmitBtn');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
        }

        try {
          await submitNameSuggestion({ code, name, email, phone, designation: desig, photo, profileUrl, oldData: _currentEditingOldData });
          showToast(`Faculty info for ${code} submitted for review!`, 'success');
          
          // Set 60-second client-side cooldown
          localStorage.setItem('faculty_suggest_cooldown_until', (Date.now() + 60000).toString());
          checkAndUpdateCooldownUI();

          suggestForm.reset();
          _currentEditingOldData = null;
          _currentEditingLockedCode = '';
          renderPhotoPreview('');
          closeModal(suggestModal);
        } catch (err) {
          showToast(err.message || 'Submission failed.', 'error');
        } finally {
          if (submitBtn && !checkAndUpdateCooldownUI()) {
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

        // Parse oldData for fallbacks
        let cardOldData = {};
        if (card.dataset.oldData) {
          try { cardOldData = JSON.parse(card.dataset.oldData); } catch (e) {}
        }

        // Gather only modified inputs, falling back to existing data
        const getFieldVal = (key, fallback) => {
          const input = card.querySelector(`[data-field="${key}"]`);
          return input ? input.value.trim() : (fallback || '');
        };

        const updatedPayload = {
          name: getFieldVal('name', cardOldData.name),
          email: getFieldVal('email', cardOldData.email),
          phone: getFieldVal('phone', cardOldData.phone),
          designation: getFieldVal('designation', cardOldData.designation),
          photo: getFieldVal('photo', cardOldData.photo),
          profileUrl: getFieldVal('profileUrl', cardOldData.profileUrl)
        };

        const action = approveBtn ? 'approve' : 'reject';
        const actionBtn = approveBtn || rejectBtn;
        actionBtn.disabled = true;
        actionBtn.textContent = 'Processing...';

        try {
          await reviewSubmission(id, action, code, updatedPayload, _adminSessionPass);
          showToast(`Suggestion for ${code} ${action}d!`, 'success');
          card.remove();
          renderTeacherFinderModal();

          if (!adminListBox.children.length) {
            adminListBox.innerHTML = `
              <div style="text-align: center; padding: 40px 20px; color: var(--dim);">
                <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
                <div style="font-weight: 700; font-size: 15px; color: var(--text); margin-bottom: 4px;">All Caught Up!</div>
                <div style="font-size: 12px;">No pending faculty suggestions to review.</div>
              </div>
            `;
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
      const card = e.target.closest('.faculty-app-card, .ft-list-item');
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
  Promise.all([loadMasterTeacherData(true), initTeacherNames()]).catch(err => {
    console.warn('Background teacher data load error:', err);
  });

  setInterval(() => {
    loadMasterTeacherData(true);
  }, 60000);
}

async function loadAdminPendingList(password) {
  const adminListBox = document.getElementById('teacherApprovalListBox');
  if (!adminListBox) return;

  adminListBox.innerHTML = '<div style="text-align:center; padding:20px; color:var(--dim);">Loading pending submissions...</div>';
  
  let pending = [];
  try {
    pending = await fetchPendingSubmissions(password);
  } catch (e) {
    adminListBox.innerHTML = `<div style="text-align:center; padding:20px; color:#fb7185;">${escapeHtml(e.message || 'Failed to load submissions')}</div>`;
    throw e;
  }

  if (!pending || pending.length === 0) {
    adminListBox.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--dim);">
        <div style="font-size: 32px; margin-bottom: 8px;">🎉</div>
        <div style="font-weight: 700; font-size: 15px; color: var(--text); margin-bottom: 4px;">All Caught Up!</div>
        <div style="font-size: 12px;">No pending faculty suggestions to review.</div>
      </div>
    `;
    return;
  }

  let html = '';
  pending.forEach(item => {
    const code = (item.teacher_code || item.code || '').trim().toUpperCase();
    const timeStr = item.submitted_at
      ? new Date(item.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'Recently';

    // Parse old_data snapshot if present, otherwise grab from current faculty info
    let oldData = {};
    if (item.old_data) {
      try {
        oldData = typeof item.old_data === 'string' ? JSON.parse(item.old_data) : item.old_data;
      } catch (e) {}
    } else {
      const currentInfo = getTeacherInfo(code);
      if (currentInfo) {
        oldData = {
          name: currentInfo.name !== code ? currentInfo.name : '',
          email: (currentInfo.emails && currentInfo.emails.length > 0) ? currentInfo.emails[0] : (currentInfo.email || ''),
          phone: currentInfo.phone || '',
          designation: currentInfo.designation && currentInfo.designation !== 'Faculty Member' ? currentInfo.designation : '',
          photo: currentInfo.photo || '',
          profileUrl: currentInfo.profileUrl || ''
        };
      }
    }

    const suggestedName = item.full_name || item.name || '';
    const suggestedEmail = item.email || '';
    const suggestedPhone = item.phone || '';
    const suggestedDesig = item.designation || '';
    const suggestedPhoto = item.photo || '';
    const suggestedProfile = item.profile_url || item.profileUrl || '';

    // Field configuration for side-by-side Before/After diffs
    const allFields = [
      { key: 'name', label: 'Full Name', before: oldData.name || '', after: suggestedName },
      { key: 'designation', label: 'Designation', before: oldData.designation || '', after: suggestedDesig },
      { key: 'email', label: 'Email', before: oldData.email || '', after: suggestedEmail },
      { key: 'phone', label: 'Phone', before: oldData.phone || '', after: suggestedPhone },
      { key: 'photo', label: 'Profile Photo', before: oldData.photo || '', after: suggestedPhoto, isPhoto: true },
      { key: 'profileUrl', label: 'PUC Profile URL', before: oldData.profileUrl || '', after: suggestedProfile }
    ];

    // Filter to ONLY fields where the suggested value differs from the baseline
    const changedFields = allFields.filter(f => {
      const b = (f.before || '').trim();
      const a = (f.after || '').trim();
      return a !== b;
    });

    const fieldsToRender = changedFields.length > 0 ? changedFields : allFields.filter(f => f.after);

    const diffRowsHtml = fieldsToRender.map(f => {
      const hasChange = (f.after || '').trim() !== (f.before || '').trim();
      
      let beforeContentHtml = `<span class="ft-diff-value">${escapeHtml(f.before || '—')}</span>`;
      let afterContentHtml = `<input type="text" class="ft-admin-diff-input" data-field="${f.key}" value="${escapeHtml(f.after || f.before || '')}" placeholder="No value" />`;

      if (f.isPhoto) {
        beforeContentHtml = `
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
            ${f.before ? `<img src="${escapeHtml(f.before)}" class="ft-admin-diff-photo-thumb" alt="Old Photo" onerror="this.style.display='none';" />` : ''}
            <span class="ft-diff-value" style="font-size: 10.5px; word-break: break-all;">${escapeHtml(f.before || 'No photo')}</span>
          </div>
        `;
        afterContentHtml = `
          <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
            ${f.after ? `<img src="${escapeHtml(f.after)}" class="ft-admin-diff-photo-thumb" alt="New Photo" onload="this.classList.add('loaded');" onerror="this.style.display='none';" />` : ''}
            <input type="text" class="ft-admin-diff-input" data-field="${f.key}" value="${escapeHtml(f.after || f.before || '')}" placeholder="Photo URL or image data" />
          </div>
        `;
      }

      return `
        <div class="ft-admin-diff-row ${hasChange ? 'has-change' : ''}">
          <div class="ft-admin-diff-label">
            <span>${escapeHtml(f.label)}</span>
            ${hasChange ? '<span class="ft-admin-diff-badge">Suggested Change</span>' : ''}
          </div>
          <div class="ft-admin-diff-grid">
            <div class="ft-admin-diff-before-box">
              <span class="ft-diff-prefix">Before:</span>
              ${beforeContentHtml}
            </div>
            <div class="ft-admin-diff-after-box">
              <span class="ft-diff-prefix">New:</span>
              ${afterContentHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    html += `
      <div class="ft-admin-pending-card" data-id="${item.id}" data-code="${escapeHtml(code)}" data-old-data="${escapeHtml(JSON.stringify(oldData))}">
        <div class="ft-admin-pending-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="faculty-code-tag">${escapeHtml(code)}</span>
            <span style="font-size: 14px; font-weight: 800; color: var(--text-main);">${escapeHtml(suggestedName || oldData.name || code)}</span>
          </div>
          <span style="font-size: 11px; color: var(--dim); font-family: var(--font-mono);">${escapeHtml(timeStr)}</span>
        </div>

        <div class="ft-admin-diff-container">
          ${diffRowsHtml}
        </div>

        <div class="ft-admin-card-actions">
          <button type="button" class="ft-admin-reject-btn btn" title="Reject this suggestion">Reject ❌</button>
          <button type="button" class="ft-admin-approve-btn btn" title="Approve and apply live to all users">Approve ✅</button>
        </div>
      </div>
    `;
  });

  adminListBox.innerHTML = html;
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

  // Apply intelligent search query (matching full names, codes, and acronyms)
  let filtered = allTeachers.filter(t => matchesTeacherQuery(t, _searchQuery));

  if (summaryEl) {
    summaryEl.innerHTML = `Showing <strong>${filtered.length}</strong> of ${allTeachers.length} faculty ${inClassCount > 0 ? `· <span style="color:#34d399; font-weight:800;">🟢 ${inClassCount} in class now</span>` : ''}`;
  }

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

  const namedGroup = [];
  const unlistedGroup = [];

  filtered.forEach(item => {
    const info = getTeacherInfo(item.teacher);
    const hasFullName = !!(info.name && info.name.trim().toUpperCase() !== item.teacher.trim().toUpperCase());
    if (hasFullName) {
      namedGroup.push({ item, info, displayName: info.name, sortKey: info.name.toLowerCase() });
    } else {
      unlistedGroup.push({ item, info, displayName: item.teacher, sortKey: item.teacher.toLowerCase() });
    }
  });

  // Sort each group alphabetically within itself
  namedGroup.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  unlistedGroup.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  function renderCard(entry, isNamed) {
    const { item, info, displayName } = entry;
    const isInClass = item.status === 'IN_CLASS';
    const initials = (displayName || item.teacher).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const photoHtml = info.photo
      ? `<img class="faculty-app-avatar-squircle" src="${escapeHtml(info.photo)}" alt="${escapeHtml(item.teacher)}" onerror="this.outerHTML='<div class=\\'faculty-app-avatar-squircle\\'>${initials}</div>'" />`
      : `<div class="faculty-app-avatar-squircle">${initials}</div>`;

    const desigText = info.designation && info.designation !== 'Faculty Member' && info.designation !== 'Guest Faculty'
      ? escapeHtml(info.designation.split('·')[0].trim())
      : 'Faculty Member';

    const codePillHtml = isNamed && item.teacher && item.teacher.toLowerCase() !== displayName.toLowerCase()
      ? `<span class="faculty-app-card-code">${escapeHtml(item.teacher)}</span>`
      : '';

    if (isInClass) {
      const cur = item.currentClass;
      const roomStr = cur.room ? `Room ${escapeHtml(cur.room)}` : escapeHtml(cur.subject);

      return `
        <div class="faculty-app-card in-class" data-teacher="${escapeHtml(item.teacher)}" title="Click to view full profile and routine">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
            ${photoHtml}
            <div class="faculty-app-card-body">
              <div class="faculty-app-card-top-row">
                <span class="faculty-app-card-name">${escapeHtml(displayName)}</span>
                ${codePillHtml}
              </div>
              <div class="faculty-app-card-desig">${desigText}</div>
            </div>
          </div>
          <div class="faculty-app-live-tag">
            <span>🟢 ${roomStr}</span>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="faculty-app-card" data-teacher="${escapeHtml(item.teacher)}" title="Click to view full profile and routine">
          <div style="display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1;">
            ${photoHtml}
            <div class="faculty-app-card-body">
              <div class="faculty-app-card-top-row">
                <span class="faculty-app-card-name">${escapeHtml(displayName)}</span>
                ${codePillHtml}
              </div>
              <div class="faculty-app-card-desig">${desigText}</div>
            </div>
          </div>
          <div class="faculty-app-arrow">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      `;
    }
  }

  let html = '';

  if (namedGroup.length > 0) {
    html += `
      <div class="faculty-section-divider">
        <span class="faculty-section-title">Faculty Members</span>
        <span class="faculty-section-badge purple">${namedGroup.length}</span>
      </div>
    `;
    html += namedGroup.map(e => renderCard(e, true)).join('');
  }

  if (unlistedGroup.length > 0) {
    html += `
      <div class="faculty-section-divider" style="${namedGroup.length > 0 ? 'margin-top: 10px;' : ''}">
        <span class="faculty-section-title">Other Instructors</span>
        <span class="faculty-section-badge">${unlistedGroup.length}</span>
      </div>
    `;
    html += unlistedGroup.map(e => renderCard(e, false)).join('');
  }

  container.innerHTML = html;
}

const DAY_TAB_INDEX_MAP = { 'SAT': 6, 'SUN': 0, 'MON': 1, 'TUE': 2, 'WED': 3 };

function getTeacherWeeklyAllClasses(teacherKey) {
  const activeDays = [6, 0, 1, 2, 3];
  const all = [];
  activeDays.forEach(d => {
    const dayClasses = getTeacherClassesForDay(teacherKey, d);
    const dayShort = (DAY_SHORT[d] || DAY_NAMES[d] || 'SAT').substring(0, 3).toUpperCase();
    const dayName = DAY_NAMES[d];
    dayClasses.forEach(c => {
      const durationMins = (typeof c.startM === 'number' && typeof c.endM === 'number' && c.endM > c.startM)
        ? (c.endM - c.startM)
        : (toMinutes(c.end) - toMinutes(c.start));
      const durMins = durationMins > 0 ? durationMins : 75;
      const durHours = Math.floor(durMins / 60);
      const durMinsRemainder = durMins % 60;
      const durationLabel = durHours > 0
        ? (durMinsRemainder > 0 ? `${durHours}h ${durMinsRemainder}m` : `${durHours}h`)
        : `${durMinsRemainder}m`;
      
      const isLab = String(c.type || '').toLowerCase() === 'lab' || String(c.subject || '').toUpperCase().endsWith('L');
      const cleanRoom = (c.room || '').replace(/^room\s*/i, '').trim();

      all.push({
        ...c,
        dayIdx: d,
        dayShort,
        dayName,
        isLab,
        room: cleanRoom,
        duration: durationLabel,
        fullCourseName: FULL_COURSE_NAMES[c.subject] || c.name || c.subject
      });
    });
  });
  return all;
}

function renderTeacherScheduleRowsHtml(teacherKey, activeTab) {
  const allClasses = getTeacherWeeklyAllClasses(teacherKey);
  let filtered = allClasses;
  if (activeTab !== 'ALL') {
    const targetDayIdx = DAY_TAB_INDEX_MAP[activeTab];
    filtered = allClasses.filter(c => c.dayIdx === targetDayIdx);
  }

  if (!filtered || filtered.length === 0) {
    return `<div class="faculty-empty-state">🌴 No Classes Scheduled on ${escapeHtml(activeTab)}</div>`;
  }

  return filtered.map(c => {
    const isLab = c.isLab;
    const roomText = c.room ? `Room ${escapeHtml(c.room)}` : 'Campus Room';
    const courseTitle = escapeHtml(c.fullCourseName || c.subject);
    
    return `
      <div class="faculty-routine-row">
        <div class="faculty-routine-left">
          <div class="faculty-routine-subj-row">
            <span class="faculty-routine-subj">${escapeHtml(c.subject)}</span>
            <span class="resting-tag ${isLab ? 'lab' : 'theory'}">${isLab ? '★ LAB' : 'THEORY'}</span>
            <span class="faculty-day-chip">${escapeHtml(c.dayShort)}</span>
          </div>
          <div class="faculty-routine-meta">
            <span>${roomText}</span>
            <span>&bull;</span>
            <span>${courseTitle}</span>
          </div>
        </div>
        <div class="faculty-routine-right">
          <span class="faculty-routine-time">${format12h(c.start)}</span>
          <span class="faculty-routine-duration">${escapeHtml(c.duration)}</span>
        </div>
      </div>
    `;
  }).join('');
}

export function closeTeacherDetailModal() {
  const detailModal = document.getElementById('teacherDetailModal');
  if (detailModal) {
    closeModal(detailModal);
  }
}
window.closeTeacherDetailModal = closeTeacherDetailModal;

export function openTeacherDetailByCode(teacherCode) {
  if (!teacherCode) return;
  const cleanCode = String(teacherCode).trim().replace(/^[\s·\(\)]+|[\s·\(\)]+$/g, '');
  if (!cleanCode || cleanCode === '—' || cleanCode.toLowerCase() === 'tba') return;

  const canonicalCode = resolveTeacherCode(cleanCode);
  const classDetailModal = document.getElementById('classDetailModal');
  const isFromClassDetail = classDetailModal && classDetailModal.classList.contains('open');

  // Populate content synchronously and trigger spring slide-up entrance animation
  openTeacherDetailModal({ teacher: canonicalCode, isFromClassDetail }, 'ALL');
}

window.openTeacherDetailByCode = openTeacherDetailByCode;
window.__openTeacherProfileByCode = openTeacherDetailByCode;

window.__switchTeacherDetailTab = function(tabName) {
  _selectedTeacherDetailDay = tabName;
  if (!_currentOpenTeacherData) return;
  const rawTeacherKey = _currentOpenTeacherData.teacher || _currentOpenTeacherData.code || _currentOpenTeacherData;
  const teacherKey = resolveTeacherCode(rawTeacherKey);

  // Update tab buttons
  const strip = document.getElementById('facultyDaysStrip');
  if (strip) {
    strip.querySelectorAll('.faculty-day-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
  }

  // Update routine list container
  const routineList = document.getElementById('facultyRoutineList');
  if (routineList) {
    routineList.innerHTML = renderTeacherScheduleRowsHtml(teacherKey, tabName);
    routineList.scrollTop = 0;
  }
};

/** Opens Full Faculty Profile Modal */
export function openTeacherDetailModal(teacherData, activeTab = 'ALL') {
  const detailModal = document.getElementById('teacherDetailModal');
  const heroContainer = document.getElementById('facultyProfileHero');

  if (!detailModal || !heroContainer) return;

  _currentOpenTeacherData = teacherData;
  _selectedTeacherDetailDay = activeTab;

  const rawTeacherKey = teacherData.teacher || teacherData.code || teacherData;
  const teacherKey = resolveTeacherCode(rawTeacherKey);
  const info = getTeacherInfo(teacherKey);
  const fullName = info.name || teacherKey;
  const initials = (fullName || teacherKey).split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const photoHtml = info.photo
    ? `<span class="faculty-avatar-initials">${escapeHtml(initials)}</span><img src="${escapeHtml(info.photo)}" alt="${escapeHtml(teacherKey)}" loading="lazy" decoding="async" onload="this.classList.add('loaded');" onerror="this.remove();" />`
    : `<span class="faculty-avatar-initials">${escapeHtml(initials)}</span>`;

  const desigText = info.designation || 'Assistant Professor';

  // Fix: Code tag (e.g. MHE)
  const isDistinctCode = teacherKey && fullName && (teacherKey.toUpperCase() !== fullName.toUpperCase());
  const codePillHtml = isDistinctCode
    ? `<span class="faculty-code-tag">${escapeHtml(teacherKey)}</span>`
    : '';

  // Status Pill
  const isGuest = info.isGuest || info.status === 'Guest';
  const isLeave = (info.status === 'Study Leave');
  const statusPillHtml = isGuest
    ? `<span class="faculty-status-pill guest">👤 GUEST FACULTY</span>`
    : (isLeave
      ? `<span class="faculty-status-pill leave">🎓 STUDY LEAVE</span>`
      : `<span class="faculty-status-pill active">● ACTIVE FACULTY</span>`);

  // Action Buttons
  const emailsList = Array.isArray(info.emails) ? info.emails.filter(e => e && e.trim()) : [];
  const singleEmail = (typeof info.email === 'string' && info.email.trim()) ? info.email.trim() : '';
  const primaryEmail = emailsList.length > 0 ? emailsList[0] : singleEmail;

  const emailBtn = primaryEmail
    ? `<a href="mailto:${escapeHtml(primaryEmail)}" class="faculty-action-chip" target="_blank" rel="noopener" title="Send Email: ${escapeHtml(primaryEmail)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        <span>Email</span>
      </a>`
    : `<button type="button" class="faculty-action-chip is-disabled" disabled title="No email available for this instructor">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        <span>Email</span>
      </button>`;

  const phone = (info.phone && typeof info.phone === 'string' && info.phone.trim()) ? info.phone.trim() : (info.mobile || info.cell || '');
  const phoneBtn = (phone && phone.trim())
    ? `<a href="tel:${escapeHtml(phone.split(' ')[0])}" class="faculty-action-chip" title="Call Faculty: ${escapeHtml(phone)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>Call</span>
      </a>`
    : `<button type="button" class="faculty-action-chip is-disabled" disabled title="No phone number available for this instructor">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        <span>Call</span>
      </button>`;

  const rawUrl = (info.profileUrl && typeof info.profileUrl === 'string') ? info.profileUrl.trim() : '';
  const isGenericUrl = !rawUrl || rawUrl === 'https://cse.puc.ac.bd' || rawUrl === 'https://cse.puc.ac.bd/' || rawUrl === 'http://cse.puc.ac.bd' || rawUrl === 'http://cse.puc.ac.bd/';
  const hasRealProfile = !isGenericUrl;

  const pucBtn = hasRealProfile
    ? `<a href="${escapeHtml(rawUrl)}" target="_blank" rel="noopener" class="faculty-action-chip" title="View Official PUC Website Profile">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>PUC Profile</span>
      </a>`
    : `<button type="button" class="faculty-action-chip is-disabled" disabled title="No individual PUC profile page available">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>PUC Profile</span>
      </button>`;

  // Day Switcher Tabs (SAT, SUN, MON, TUE, WED, ALL)
  const dayTabs = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'ALL'];
  const dayTabsHtml = dayTabs.map(d => `
    <button class="faculty-day-tab-btn ${d === activeTab ? 'active' : ''}" data-tab="${d}" onclick="window.__switchTeacherDetailTab('${d}')">
      ${d}
    </button>
  `).join('');

  // Schedule rows (Max 3 visible, scrollable if > 3)
  const routineRowsHtml = renderTeacherScheduleRowsHtml(teacherKey, activeTab);

  // Courses Taught (deduplicated short codes)
  const weekly = getTeacherWeeklySubjects(teacherKey);
  const distinctCourses = Array.from(new Set((weekly.subjects || []).map(s => String(s).toUpperCase().trim()))).filter(Boolean).sort();
  const coursesPillsHtml = distinctCourses.length > 0
    ? distinctCourses.map(code => {
        const isLab = code.endsWith('L') || code.toLowerCase().includes('lab');
        return `<span class="resting-tag ${isLab ? 'lab' : 'theory'}" title="${escapeHtml(FULL_COURSE_NAMES[code] || code)}">${escapeHtml(code)}</span>`;
      }).join('')
    : '<span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">No active routine courses</span>';

  const isFromClassDetail = teacherData.isFromClassDetail || (document.getElementById('classDetailModal') && document.getElementById('classDetailModal').classList.contains('open'));
  const backTextEl = document.getElementById('teacherDetailBackText');
  if (backTextEl) {
    backTextEl.textContent = isFromClassDetail ? 'Back to Class' : 'Back to Class';
  }

  heroContainer.innerHTML = `
    <!-- Faculty Hero Card -->
    <div class="faculty-hero-card">
      <div class="faculty-avatar-box">${photoHtml}</div>
      <div class="faculty-hero-info">
        <div class="faculty-hero-name-row">
          <span class="faculty-hero-name">${escapeHtml(fullName)}</span>
          ${codePillHtml}
          <button type="button" class="faculty-hero-edit-btn" onclick="window.__openFacultyEditModal('${escapeHtml(teacherKey)}')" title="Suggest an edit for ${escapeHtml(fullName)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
        </div>
        <div class="faculty-hero-desig">${escapeHtml(desigText)}</div>
        ${statusPillHtml}
      </div>
    </div>

    <!-- Quick Action Row -->
    <div class="faculty-actions-row">
      ${emailBtn}
      ${phoneBtn}
      ${pucBtn}
    </div>

    <!-- Day Switcher Segmented Bar -->
    <div class="faculty-days-strip" id="facultyDaysStrip">
      ${dayTabsHtml}
    </div>

    <!-- Fixed-Height Schedule Row List (Max 3 visible rows) -->
    <div class="faculty-routine-list" id="facultyRoutineList">
      ${routineRowsHtml}
    </div>

    <!-- Courses Taught Section (Always visible below schedule list) -->
    <div class="faculty-courses-section">
      <div class="faculty-courses-header">
        <div style="display: flex; align-items: center; gap: 5px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          <span>Courses Taught</span>
        </div>
        <span class="faculty-courses-count">${distinctCourses.length} ${distinctCourses.length === 1 ? 'course' : 'courses'}</span>
      </div>
      <div class="faculty-courses-pills">
        ${coursesPillsHtml}
      </div>
    </div>
  `;

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
