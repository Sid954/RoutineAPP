import { format12h, toTimeString, getCurrentMinutes } from '../core/utils.js';
import { openModal, closeModal } from '../modals/modal.js';
import { loadMasterRoomData, searchFreeRooms } from './room-finder.js';

let _activeFilter = 'FREE_NOW';
let _activeFloor = 'ALL';
let _searchQuery = '';
let _sortBy = 'availability';
let _lastSearchResults = [];

export function initRoomFinderUI() {
  const fab = document.getElementById('freeRoomsFab');
  const modal = document.getElementById('freeRoomsModal');
  const closeBtn = document.getElementById('freeRoomsCloseBtn');
  const searchInput = document.getElementById('freeRoomsSearchInput');
  const sortSelect = document.getElementById('freeRoomsSortSelect');

  // Room detail modal elements
  const detailModal = document.getElementById('roomDetailModal');
  const detailCloseBtn = document.getElementById('roomDetailCloseBtn');

  if (!fab || !modal) return;

  const handleFabClick = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    modal.style.display = '';
    openModal(modal);

    const container = document.getElementById('freeRoomsGrid');
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--dim);">
          <div style="font-size: 32px; margin-bottom: 8px;" class="spin">⚡</div>
          <div style="font-weight: 700; font-size: 14px; color: var(--text);">Searching available free rooms...</div>
        </div>
      `;
    }

    await loadMasterRoomData(true);
    renderFreeRoomsModal();
  };

  fab.addEventListener('click', handleFabClick);

  if (closeBtn) {
    closeBtn.addEventListener('click', () => closeModal(modal));
  }

  if (detailCloseBtn && detailModal) {
    detailCloseBtn.addEventListener('click', () => closeModal(detailModal));
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      _searchQuery = e.target.value.toLowerCase().trim();
      renderFreeRoomsModal();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      _sortBy = e.target.value;
      renderFreeRoomsModal();
    });
  }

  const floorList = document.getElementById('freeRoomsFloorList');
  if (floorList) {
    floorList.addEventListener('click', (e) => {
      const btn = e.target.closest('.fr-floor-btn');
      if (!btn) return;
      
      const floor = btn.dataset.floor;
      if (floor) {
        _activeFloor = floor;
        floorList.querySelectorAll('.fr-floor-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderFreeRoomsModal();
      }
    });
  }

  const statusTabs = document.getElementById('freeRoomsStatusTabs');
  if (statusTabs) {
    statusTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.fr-filter-pill');
      if (!btn) return;
      
      const filter = btn.dataset.filter;
      if (filter) {
        _activeFilter = filter;
        statusTabs.querySelectorAll('.fr-filter-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderFreeRoomsModal();
      }
    });
  }

  // Room card click -> Open Daily Schedule detail modal
  const grid = document.getElementById('freeRoomsGrid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      const card = e.target.closest('.fr-card-compact');
      if (!card) return;
      const roomNum = card.dataset.room;
      if (roomNum && _lastSearchResults.length > 0) {
        const roomData = _lastSearchResults.find(r => r.room === roomNum);
        if (roomData) {
          openRoomDetailModal(roomData);
        }
      }
    });
  }

  // Pre-fetch fresh data on startup
  loadMasterRoomData(true).then(() => {
    updateFabBadge();
  }).catch(err => {
    console.warn('Background room data load error:', err);
  });

  setInterval(() => {
    loadMasterRoomData(true).then(() => updateFabBadge());
  }, 60000);
}

export function updateFabBadge() {
  const badge = document.getElementById('freeRoomsBadge');
  if (!badge) return;

  const currentDay = new Date().getDay();
  const currentMins = getCurrentMinutes();
  const res = searchFreeRooms(currentDay, currentMins);

  if (res.isAfter5pm || res.isOffDay) {
    badge.style.display = 'none';
    return;
  }

  const freeNowCount = (res.rooms || []).filter(r => r.status === 'FREE_NOW').length;
  badge.textContent = freeNowCount;
  badge.style.display = freeNowCount > 0 ? 'flex' : 'none';
}

export function renderFreeRoomsModal() {
  const container = document.getElementById('freeRoomsGrid');
  const summaryEl = document.getElementById('freeRoomsSummary');
  if (!container) return;

  const currentDay = new Date().getDay();
  const currentMins = getCurrentMinutes();
  const res = searchFreeRooms(currentDay, currentMins, undefined, _sortBy);

  if (res.isOffDay) {
    if (summaryEl) summaryEl.innerHTML = `<span style="color:var(--dim);">Weekend / Off-Day</span>`;
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--dim);">
        <div style="font-size: 36px; margin-bottom: 8px;">🎉</div>
        <div style="font-weight: 800; font-size: 16px; color: var(--text); margin-bottom: 4px;">No Classes Today</div>
        <div style="font-size: 13px;">It is a weekend or off-day. No routine classes scheduled.</div>
      </div>
    `;
    return;
  }

  if (res.isAfter5pm) {
    if (summaryEl) summaryEl.innerHTML = `<span style="color:var(--dim);">Classes ended for today</span>`;
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--dim);">
        <div style="font-size: 36px; margin-bottom: 8px;">🌙</div>
        <div style="font-weight: 800; font-size: 16px; color: var(--text); margin-bottom: 4px;">Campus Closed for Today</div>
        <div style="font-size: 13px;">All classes have ended for the day (After 5:00 PM).</div>
      </div>
    `;
    return;
  }

  const allRooms = res.rooms || [];
  _lastSearchResults = allRooms;

  const freeNowCount = allRooms.filter(r => r.status === 'FREE_NOW').length;
  const freeSoonCount = allRooms.filter(r => r.status === 'FREE_SOON').length;
  const occupiedCount = allRooms.filter(r => r.status === 'OCCUPIED').length;

  if (summaryEl) {
    summaryEl.innerHTML = `<span style="color:#34d399; font-weight:800;">${freeNowCount} free now</span> · <span style="color:#fbbf24; font-weight:700;">${freeSoonCount} soon</span> · <span style="color:#fb7185; font-weight:700;">${occupiedCount} occupied</span>`;
  }

  // Apply filters
  let filtered = allRooms.filter(r => {
    if (_activeFilter === 'FREE_NOW' && r.status !== 'FREE_NOW') return false;
    if (_activeFilter === 'FREE_SOON' && r.status !== 'FREE_SOON') return false;
    if (_activeFilter === 'OCCUPIED' && r.status !== 'OCCUPIED') return false;

    if (_activeFloor !== 'ALL' && !r.floor.toLowerCase().includes(_activeFloor.toLowerCase())) return false;

    if (_searchQuery) {
      const matchRoom = r.room.toLowerCase().includes(_searchQuery);
      const matchFloor = r.floor.toLowerCase().includes(_searchQuery);
      if (!matchRoom && !matchFloor) return false;
    }

    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: var(--dim);">
        <div style="font-size: 32px; margin-bottom: 8px;">🚪</div>
        <div style="font-weight: 700; font-size: 15px; color: var(--text); margin-bottom: 4px;">No rooms match your filter</div>
        <div style="font-size: 12px;">Try switching floor, sorting, or filter tabs.</div>
      </div>
    `;
    return;
  }

  let html = '';
  filtered.forEach(item => {
    const isFreeNow = item.status === 'FREE_NOW';
    const isFreeSoon = item.status === 'FREE_SOON';
    const isOccupied = item.status === 'OCCUPIED';

    let cardClass = 'fr-card-compact-now';
    let statusSubtitle = '';

    if (isFreeNow) {
      cardClass = 'fr-card-compact-now';
      statusSubtitle = item.freeUntilMins >= 17 * 60
        ? '<div class="fr-compact-until">Rest of day</div>'
        : `<div class="fr-compact-until">Until ${format12h(toTimeString(item.freeUntilMins))}</div>`;
    } else if (isFreeSoon) {
      cardClass = 'fr-card-compact-soon';
      statusSubtitle = `<div class="fr-compact-until" style="color:#fbbf24;">Free in ${item.minsUntilFree}m</div>`;
    } else {
      cardClass = 'fr-card-compact-occupied';
      statusSubtitle = '';
    }

    html += `
      <div class="fr-card-compact ${cardClass}" data-room="${escapeHtml(item.room)}" title="Click to view full schedule">
        <div class="fr-compact-top">
          <div class="fr-compact-room">${escapeHtml(item.room)}</div>
        </div>
        ${statusSubtitle}
      </div>
    `;
  });

  container.innerHTML = html;
}

/** Opens Room Daily Schedule Timeline Modal */
export function openRoomDetailModal(roomData) {
  const detailModal = document.getElementById('roomDetailModal');
  const titleEl = document.getElementById('roomDetailTitle');
  const floorEl = document.getElementById('roomDetailFloor');
  const bannerEl = document.getElementById('roomDetailLiveBanner');
  const listEl = document.getElementById('roomTimelineList');

  if (!detailModal || !listEl) return;

  if (titleEl) titleEl.textContent = `Room ${roomData.room}`;
  if (floorEl) floorEl.textContent = roomData.floor;

  const currentMins = getCurrentMinutes();
  const isFreeNow = roomData.status === 'FREE_NOW';
  const isFreeSoon = roomData.status === 'FREE_SOON';

  // Live status banner in modal
  if (bannerEl) {
    if (isFreeNow) {
      const untilStr = roomData.freeUntilMins >= 17 * 60 ? 'for the rest of the day' : `until ${format12h(toTimeString(roomData.freeUntilMins))}`;
      bannerEl.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🟢</span>
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #34d399;">Free Right Now</div>
            <div style="font-size: 11px; color: var(--dim);">Available ${untilStr}</div>
          </div>
        </div>
      `;
    } else if (isFreeSoon) {
      bannerEl.innerHTML = `
        <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🟡</span>
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #fbbf24;">Opening Soon (in ${roomData.minsUntilFree}m)</div>
            <div style="font-size: 11px; color: var(--dim);">Current class ending soon</div>
          </div>
        </div>
      `;
    } else {
      const cur = roomData.currentClass;
      const endsStr = cur ? `until ${format12h(cur.end)}` : '';
      bannerEl.innerHTML = `
        <div style="background: rgba(244, 63, 94, 0.15); border: 1px solid rgba(251, 113, 133, 0.3); border-radius: 12px; padding: 10px 14px; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">🔴</span>
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #fb7185;">In Session: ${escapeHtml(cur ? cur.subject : 'Class')}</div>
            <div style="font-size: 11px; color: var(--dim);">${cur && cur.semSec ? cur.semSec + ' · ' : ''}Occupied ${endsStr}</div>
          </div>
        </div>
      `;
    }
  }

  // Render Classes: Finished (greyed out) -> Current (highlighted) -> Future (vibrant)
  const classes = roomData.allClassesToday || [];

  if (classes.length === 0) {
    listEl.innerHTML = `
      <div style="text-align: center; padding: 30px 14px; color: var(--dim);">
        <div style="font-size: 28px; margin-bottom: 6px;">☕</div>
        <div style="font-weight: 700; font-size: 14px; color: var(--text);">No Classes Scheduled Today</div>
        <div style="font-size: 12px;">This room is completely free all day!</div>
      </div>
    `;
    openModal(detailModal);
    return;
  }

  let timelineHtml = '';

  classes.forEach(c => {
    const isFinished = c.endM <= currentMins;
    const isCurrent = currentMins >= c.startM && currentMins < c.endM;
    const isFuture = c.startM > currentMins;

    const typeClass = (c.type || '').toLowerCase() === 'lab' ? 'fr-tl-type-lab' : 'fr-tl-type-theory';
    const typeLabel = c.type || 'Theory';

    if (isFinished) {
      // 1. Finished Class (Greyed out)
      timelineHtml += `
        <div class="fr-tl-item fr-tl-item-past">
          <div class="fr-tl-header">
            <span class="fr-tl-subject">${escapeHtml(c.subject)}</span>
            <span class="fr-tl-past-badge">✓ Completed</span>
          </div>
          <div class="fr-tl-meta">
            <span>${format12h(c.start)} – ${format12h(c.end)}</span>
            <span>·</span>
            <span>${escapeHtml(c.instructor || 'TBA')}</span>
            <span>·</span>
            <span>${escapeHtml(c.semSec || '')}</span>
          </div>
        </div>
      `;
    } else if (isCurrent) {
      // 2. Current Ongoing Class (Highlighted & Glowing)
      timelineHtml += `
        <div class="fr-tl-item fr-tl-item-current">
          <div class="fr-tl-header">
            <span class="fr-tl-subject" style="color:#38bdf8; font-size:16px;">${escapeHtml(c.subject)}</span>
            <span class="fr-tl-live-badge">● ONGOING NOW</span>
          </div>
          <div class="fr-tl-meta" style="color:var(--text);">
            <span style="color:#38bdf8; font-weight:800;">${format12h(c.start)} – ${format12h(c.end)}</span>
            <span>·</span>
            <span>${escapeHtml(c.instructor || 'TBA')}</span>
            <span>·</span>
            <span style="font-weight:700;">${escapeHtml(c.semSec || '')}</span>
          </div>
        </div>
      `;
    } else {
      // 3. Future Upcoming Class (Vibrant Colors)
      timelineHtml += `
        <div class="fr-tl-item fr-tl-item-future">
          <div class="fr-tl-header">
            <span class="fr-tl-subject">${escapeHtml(c.subject)}</span>
            <span class="fr-tl-future-badge">${format12h(c.start)}</span>
          </div>
          <div class="fr-tl-meta">
            <span class="fr-tl-time">${format12h(c.start)} – ${format12h(c.end)}</span>
            <span>·</span>
            <span>${escapeHtml(c.instructor || 'TBA')}</span>
            <span>·</span>
            <span>${escapeHtml(c.semSec || '')}</span>
          </div>
        </div>
      `;
    }
  });

  listEl.innerHTML = timelineHtml;
  openModal(detailModal);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}
