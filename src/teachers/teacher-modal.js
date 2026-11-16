/**
 * Faculty: wiring for the directory page, the profile sheet, and the Suggest-edit /
 * Admin-review modals. Directory UI: faculty-directory.js. Profile sheet: faculty-profile.js.
 * Data/status helpers: faculty-data.js.
 */
import { openModal, closeModal } from '../modals/modal.js';
import { showToast } from '../toast/toast.js';
import { loadMasterTeacherData } from './teacher-finder.js';
import { initTeacherNames, getTeacherInfo, resolveTeacherCode, submitNameSuggestion, fetchPendingSubmissions, reviewSubmission, uploadFacultyPhoto, getAllFacultyKeys } from './teacher-names.js';
import { initFacultyDirectory, renderFacultyDirectory } from './faculty-directory.js';
import { initTeacherProfile, openTeacherProfile, closeTeacherProfile, refreshTeacherProfileIfOpen } from './faculty-profile.js';

let _adminSessionPass = '';

export function initTeacherFinderUI() {
  initFacultyDirectory(code => openTeacherProfile(code));
  initTeacherProfile();
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
        if (suggestPhotoStatus) suggestPhotoStatus.innerHTML = '<span style="color: #34d399; font-weight: 700;">Photo attached</span>';
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
        if (suggestCodeSelect) (suggestCodeSelect.closest('.fd-select-wrap') || suggestCodeSelect).style.display = 'none';
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
          (suggestCodeSelect.closest('.fd-select-wrap') || suggestCodeSelect).style.display = '';
          const allCodes = Array.from(new Set(getAllFacultyKeys().map(k => k.toUpperCase()))).sort();
          suggestCodeSelect.innerHTML = '<option value="">Choose a teacher code</option>' +
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
                <div style="font-size: 32px; margin-bottom: 8px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
                <div style="font-weight: 700; font-size: 15px; color: var(--text); margin-bottom: 4px;">All Caught Up!</div>
                <div style="font-size: 12px;">No pending faculty suggestions to review.</div>
              </div>
            `;
          }
        } catch (err) {
          showToast(err.message || 'Action failed.', 'error');
          actionBtn.disabled = false;
          actionBtn.textContent = action === 'approve' ? 'Approve' : 'Reject';
        }
      });
    }
  }

  // 5. Global click delegation for ANY clickable teacher badge across the app
  document.body.addEventListener('click', (e) => {
    const badge = e.target.closest('[data-teacher-code], .teacher-clickable-badge');
    if (badge) {
      e.preventDefault();
      e.stopPropagation();
      // Ignore a ghost tap on a teacher badge inside the class detail sheet that just opened
      if (badge.closest('#classDetailModal') && typeof window.__classDetailGhostGuard === 'function' && window.__classDetailGhostGuard()) return;
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
        <div style="font-size: 32px; margin-bottom: 8px;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
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

    const isScraper = item.source === 'build_scraper';
    const sourceBadge = isScraper
      ? `<span class="faculty-code-tag" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-size: 10px; font-weight: 700;">Scraper Finding</span>`
      : '';

    html += `
      <div class="ft-admin-pending-card" data-id="${item.id}" data-code="${escapeHtml(code)}" data-old-data="${escapeHtml(JSON.stringify(oldData))}">
        <div class="ft-admin-pending-header">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="faculty-code-tag">${escapeHtml(code)}</span>
            ${sourceBadge}
            <span style="font-size: 14px; font-weight: 800; color: var(--text-main);">${escapeHtml(suggestedName || oldData.name || code)}</span>
          </div>
          <span style="font-size: 11px; color: var(--dim); font-family: var(--font-mono);">${escapeHtml(timeStr)}</span>
        </div>

        <div class="ft-admin-diff-container">
          ${diffRowsHtml}
        </div>

        <div class="ft-admin-card-actions">
          <button type="button" class="ft-admin-reject-btn btn" title="Reject this suggestion">Reject</button>
          <button type="button" class="ft-admin-approve-btn btn" title="Approve and apply live to all users">Approve</button>
        </div>
      </div>
    `;
  });

  adminListBox.innerHTML = html;
}

/** Re-renders the directory and an open profile (called after data refreshes). */
export function renderTeacherFinderModal() {
  renderFacultyDirectory();
  refreshTeacherProfileIfOpen();
}

export function closeTeacherDetailModal() {
  closeTeacherProfile();
}
window.closeTeacherDetailModal = closeTeacherDetailModal;

export function openTeacherDetailByCode(teacherCode) {
  if (!teacherCode) return;
  const cleanCode = String(teacherCode).trim().replace(/^[\s·\(\)]+|[\s·\(\)]+$/g, '');
  if (!cleanCode || cleanCode === '—' || cleanCode.toLowerCase() === 'tba') return;
  openTeacherProfile(resolveTeacherCode(cleanCode) || cleanCode);
}
window.openTeacherDetailByCode = openTeacherDetailByCode;
window.__openTeacherProfileByCode = openTeacherDetailByCode;

/** Kept for older callers: accepts { teacher } or a code. */
export function openTeacherDetailModal(teacherData) {
  const key = (teacherData && (teacherData.teacher || teacherData.code)) || teacherData;
  if (key) openTeacherProfile(resolveTeacherCode(key) || key);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
