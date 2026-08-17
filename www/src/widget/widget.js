import { State } from '../core/state.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { toMinutes, format12h, getCurrentMinutes, formatRoom, pad, escapeHtml } from '../core/utils.js';
import { showToast } from '../toast/toast.js';

let selectedWidgetType = 'live'; // 'live', 'landscape', 'portrait'

function formatDuration(mins) {
  if (mins < 0) return '0m';
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

export function renderWidgetPreview(type = 'live') {
  const container = document.getElementById('widgetPreviewContainer');
  if (!container) return;

  const todayIdx = new Date().getDay();
  const classes = getClassesForDay(todayIdx);
  const now = getCurrentMinutes();

  let activeClass = null;
  let nextClass = null;
  let afterNextClass = null;

  for (let i = 0; i < classes.length; i++) {
    const item = classes[i];
    const startMins = toMinutes(item.start);
    const endMins = toMinutes(item.end);

    if (now >= startMins && now < endMins) {
      activeClass = item;
      if (i + 1 < classes.length) nextClass = classes[i + 1];
      break;
    } else if (now < startMins && !nextClass) {
      nextClass = item;
      if (i + 1 < classes.length) afterNextClass = classes[i + 1];
    }
  }

  if (type === 'live') {
    let statusLabel = '● FREE TIME 🌴';
    let timeRange = 'No Active Class';
    let courseTitle = 'Free Time';
    let roomChip = 'FREE';
    let elapsedText = '';
    let progressPct = 0;
    let remainingText = 'Check back tomorrow!';

    let followingLabel = 'FOLLOWING';
    let followingTitle = 'None';
    let followingEta = '';
    let followingRoom = '';
    let showFollowing = false;

    if (activeClass) {
      const startMins = toMinutes(activeClass.start);
      const endMins = toMinutes(activeClass.end);
      const elapsedMins = Math.max(0, now - startMins);
      const durationMins = Math.max(1, endMins - startMins);
      const remMins = Math.max(0, endMins - now);
      progressPct = Math.min(100, Math.max(0, Math.round((elapsedMins / durationMins) * 100)));

      const override = getOverrideFor(todayIdx, activeClass.title);
      const isCancelled = override && override.type === 'cancellation';
      const isOnline = override && override.type === 'online_class';

      statusLabel = isCancelled ? '● CANCELLED 🚫' : (isOnline ? '● ONLINE 📡' : '● CURRENT');
      timeRange = `${format12h(activeClass.start)} – ${format12h(activeClass.end)}`;
      courseTitle = `${activeClass.title}${activeClass.instructor ? ` (${activeClass.instructor})` : ''}`;
      roomChip = isOnline ? 'ONLINE' : (formatRoom(activeClass.room) || 'TBA');
      elapsedText = `${formatDuration(elapsedMins)} elapsed`;
      remainingText = `Remaining: ${formatDuration(remMins)}`;

      if (nextClass) {
        const nextStart = toMinutes(nextClass.start);
        const diff = Math.max(0, nextStart - now);
        followingLabel = 'NEXT';
        followingTitle = `${nextClass.title}${nextClass.instructor ? ` (${nextClass.instructor})` : ''}`;
        followingEta = `in ${formatDuration(diff)}`;
        followingRoom = `Room: ${formatRoom(nextClass.room) || 'TBA'} · ${format12h(nextClass.start)} – ${format12h(nextClass.end)}`;
        showFollowing = true;
      }
    } else if (nextClass) {
      const nextStart = toMinutes(nextClass.start);
      const diff = Math.max(0, nextStart - now);

      statusLabel = diff <= 30 ? '● STARTING SOON ⏰' : '● UP NEXT 📚';
      timeRange = `${format12h(nextClass.start)} – ${format12h(nextClass.end)}`;
      courseTitle = `${nextClass.title}${nextClass.instructor ? ` (${nextClass.instructor})` : ''}`;
      roomChip = formatRoom(nextClass.room) || 'TBA';
      elapsedText = `Starts in ${formatDuration(diff)}`;
      progressPct = 0;
      remainingText = `First Class at ${format12h(nextClass.start)}`;

      if (afterNextClass) {
        const afterStart = toMinutes(afterNextClass.start);
        const afterDiff = Math.max(0, afterStart - now);
        followingLabel = 'FOLLOWING';
        followingTitle = `${afterNextClass.title}${afterNextClass.instructor ? ` (${afterNextClass.instructor})` : ''}`;
        followingEta = `in ${formatDuration(afterDiff)}`;
        followingRoom = `Room: ${formatRoom(afterNextClass.room) || 'TBA'} · ${format12h(afterNextClass.start)} – ${format12h(afterNextClass.end)}`;
        showFollowing = true;
      }
    }

    container.className = 'widget-adaptive-preview';
    container.innerHTML = `
      <div class="w-card-top">
        <div class="w-header-row">
          <span class="w-status-badge">${escapeHtml(statusLabel)}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="w-time-chip">${escapeHtml(timeRange)}</span>
            <span style="font-size: 11px; opacity: 0.6; color: #38bdf8;">🔄</span>
          </div>
        </div>

        <div class="w-title-text">${escapeHtml(courseTitle)}</div>

        <div style="display: flex; justify-content: center; margin-top: 4px;">
          <span class="w-room-pill">${escapeHtml(roomChip)}</span>
        </div>

        <div class="w-elapsed-label">${escapeHtml(elapsedText)}</div>
        <div class="w-track-bar">
          <div class="w-fill-bar" style="width: ${progressPct}%;"></div>
        </div>
        <div class="w-remaining-label">${escapeHtml(remainingText)}</div>
      </div>

      ${showFollowing ? `
      <div class="w-card-bottom">
        <div class="w-following-label">${escapeHtml(followingLabel)}</div>
        <div class="w-following-course-row">
          <span class="w-following-title">${escapeHtml(followingTitle)}</span>
          <span class="w-eta-pill">${escapeHtml(followingEta)}</span>
        </div>
        <div class="w-following-room">${escapeHtml(followingRoom)}</div>
      </div>` : ''}
    `;
  } else if (type === 'landscape') {
    const days = [
      { key: 6, label: 'SAT' },
      { key: 0, label: 'SUN' },
      { key: 1, label: 'MON' },
      { key: 2, label: 'TUE' },
      { key: 3, label: 'WED' }
    ];

    container.className = 'widget-landscape-preview';
    let rowsHtml = '';

    days.forEach(d => {
      const isToday = d.key === todayIdx;
      const dayClasses = getClassesForDay(d.key);
      let cellsHtml = '';

      if (dayClasses.length === 0) {
        cellsHtml = `<div class="w-matrix-cell" style="background:#111827; color:#64748b;">No Class</div>`;
      } else {
        dayClasses.slice(0, 3).forEach(c => {
          cellsHtml += `
            <div class="w-matrix-cell" style="background:${c.type === 'LAB' ? '#701235' : '#1e3a5f'}; color:#fff;">
              <strong style="display:block; font-size:9.5px;">${escapeHtml(c.title)}</strong>
              <span style="font-size:8px; opacity:0.8;">${formatRoom(c.room) || '—'}</span>
            </div>
          `;
        });
      }

      rowsHtml += `
        <div class="w-matrix-row">
          <div class="w-matrix-day ${isToday ? 'today' : ''}">${d.label} ${isToday ? '•' : ''}</div>
          <div class="w-matrix-cards">${cellsHtml}</div>
        </div>
      `;
    });

    container.innerHTML = rowsHtml;
  } else if (type === 'portrait') {
    const days = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed'];
    let tabsHtml = '';
    days.forEach((d, i) => {
      const dayMapIdx = [6, 0, 1, 2, 3][i];
      const isToday = dayMapIdx === todayIdx;
      tabsHtml += `<div class="w-portrait-tab ${isToday ? 'active' : ''}">${d}</div>`;
    });

    let listItemsHtml = '';
    if (classes.length === 0) {
      listItemsHtml = `<div style="text-align:center; padding:12px; color:#64748b; font-size:11px;">No classes scheduled</div>`;
    } else {
      classes.forEach(c => {
        listItemsHtml += `
          <div class="w-portrait-item">
            <div>
              <strong style="font-size:11.5px; color:#f8fafc;">${escapeHtml(c.title)}</strong>
              <div style="font-size:9.5px; color:#94a3b8;">${formatRoom(c.room) || '—'} · ${escapeHtml(c.instructor || '')}</div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:10px; color:#38bdf8; font-weight:700;">${format12h(c.start)}</span>
              <span style="display:block; font-size:8px; color:#64748b;">${c.type || 'THEORY'}</span>
            </div>
          </div>
        `;
      });
    }

    container.className = 'widget-portrait-preview';
    container.innerHTML = `
      <div class="w-portrait-tabs">${tabsHtml}</div>
      <div>${listItemsHtml}</div>
    `;
  }
}

export async function updateNativeWidget() {
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

  try {
    const { WidgetPlugin } = window.Capacitor.Plugins;
    if (!WidgetPlugin) return;

    const todayIdx = new Date().getDay();
    const classes = getClassesForDay(todayIdx);
    const now = getCurrentMinutes();

    let currentLabel = "● ROUTINE";
    let currentTime = "00:00 AM – 00:00 PM";
    let currentTitle = "No Classes Today";
    let currentRoom = "FREE";
    let currentElapsed = "00:00 elapsed";
    let currentProgress = 0;
    let currentRemaining = "No active classes";

    let nextLabel = "FOLLOWING";
    let nextTitle = "None";
    let nextEta = "in 0m";
    let nextInfo = "Room: -- · --:--";
    let showNext = true;

    // Check Holiday Override
    const holidayOverride = getOverrideFor(todayIdx);
    if (holidayOverride && holidayOverride.type === 'holiday') {
      currentLabel = "● HOLIDAY 🎉";
      currentTime = "DAY OFF";
      currentTitle = holidayOverride.announcement ? holidayOverride.announcement.title : "Holiday / Day Off";
      currentRoom = "OFFLINE";
      currentElapsed = "Enjoy your day!";
      currentProgress = 100;
      currentRemaining = "No classes scheduled for today";
      showNext = false;
    } else if (!classes || classes.length === 0) {
      currentLabel = "● FREE DAY";
      currentTime = "NO CLASSES";
      currentTitle = "No Classes Scheduled";
      currentRoom = "OFFLINE";
      currentElapsed = "Free Time";
      currentProgress = 100;
      currentRemaining = "Check back tomorrow!";
      showNext = false;
    } else {
      let activeClass = null;
      let nextClass = null;
      let afterNextClass = null;

      for (let i = 0; i < classes.length; i++) {
        const item = classes[i];
        const startMins = toMinutes(item.start);
        const endMins = toMinutes(item.end);

        if (now >= startMins && now < endMins) {
          activeClass = item;
          if (i + 1 < classes.length) nextClass = classes[i + 1];
          break;
        } else if (now < startMins && !nextClass) {
          nextClass = item;
          if (i + 1 < classes.length) afterNextClass = classes[i + 1];
        }
      }

      if (activeClass) {
        const startMins = toMinutes(activeClass.start);
        const endMins = toMinutes(activeClass.end);
        const elapsedMins = Math.max(0, now - startMins);
        const durationMins = Math.max(1, endMins - startMins);
        const remMins = Math.max(0, endMins - now);
        const pct = Math.min(100, Math.max(0, Math.round((elapsedMins / durationMins) * 100)));

        const override = getOverrideFor(todayIdx, activeClass.title);
        const isCancelled = override && override.type === 'cancellation';
        const isOnline = override && override.type === 'online_class';

        currentLabel = isCancelled ? "● CANCELLED 🚫" : (isOnline ? "● ONLINE 📡" : "● CURRENT");
        currentTime = `${format12h(activeClass.start)} – ${format12h(activeClass.end)}`;
        currentTitle = `${activeClass.title}${activeClass.instructor ? ` (${activeClass.instructor})` : ''}`;
        currentRoom = isOnline ? "ONLINE" : (formatRoom(activeClass.room) || "TBA");
        currentElapsed = `${formatDuration(elapsedMins)} elapsed`;
        currentProgress = pct;
        currentRemaining = `Remaining: ${formatDuration(remMins)}`;

        if (nextClass) {
          const nextStart = toMinutes(nextClass.start);
          const diff = Math.max(0, nextStart - now);
          nextLabel = "NEXT";
          nextTitle = `${nextClass.title}${nextClass.instructor ? ` (${nextClass.instructor})` : ''}`;
          nextEta = `in ${formatDuration(diff)}`;
          nextInfo = `Room: ${formatRoom(nextClass.room) || 'TBA'} · ${format12h(nextClass.start)} – ${format12h(nextClass.end)}`;
          showNext = true;
        } else {
          showNext = false;
        }
      } else if (nextClass) {
        const nextStart = toMinutes(nextClass.start);
        const diff = Math.max(0, nextStart - now);

        currentLabel = diff <= 30 ? "● STARTING SOON ⏰" : "● UP NEXT 📚";
        currentTime = `${format12h(nextClass.start)} – ${format12h(nextClass.end)}`;
        currentTitle = `${nextClass.title}${nextClass.instructor ? ` (${nextClass.instructor})` : ''}`;
        currentRoom = formatRoom(nextClass.room) || "TBA";
        currentElapsed = `Starts in ${formatDuration(diff)}`;
        currentProgress = 0;
        currentRemaining = `First Class at ${format12h(nextClass.start)}`;

        if (afterNextClass) {
          const afterStart = toMinutes(afterNextClass.start);
          const afterDiff = Math.max(0, afterStart - now);
          nextLabel = "FOLLOWING";
          nextTitle = `${afterNextClass.title}${afterNextClass.instructor ? ` (${afterNextClass.instructor})` : ''}`;
          nextEta = `in ${formatDuration(afterDiff)}`;
          nextInfo = `Room: ${formatRoom(afterNextClass.room) || 'TBA'} · ${format12h(afterNextClass.start)} – ${format12h(afterNextClass.end)}`;
          showNext = true;
        } else {
          showNext = false;
        }
      } else {
        const lastClassEnd = Math.max(...classes.map(c => toMinutes(c.end)));
        if (now >= lastClassEnd) {
          currentLabel = "● ALL DONE 🎉";
          currentTime = "DAY COMPLETED";
          currentTitle = "All Classes Done!";
          currentRoom = "FREE";
          currentElapsed = "Completed";
          currentProgress = 100;
          currentRemaining = "Great job today!";
          showNext = false;
        }
      }
    }

    const fullJsonStr = State.schedule ? JSON.stringify(State.schedule) : '';

    await WidgetPlugin.updateWidgetData({
      current_label: currentLabel,
      current_time: currentTime,
      current_title: currentTitle,
      current_room: currentRoom,
      current_elapsed: currentElapsed,
      current_progress: currentProgress,
      current_remaining: currentRemaining,
      next_label: nextLabel,
      next_title: nextTitle,
      next_eta: nextEta,
      next_info: nextInfo,
      show_next: showNext,
      theme_color: document.documentElement.getAttribute('data-color') || 'dark',
      full_schedule_json: fullJsonStr
    });
  } catch (err) {
    console.warn('Widget update skipped:', err);
  }
}

export function initWidgetPinningUI() {
  const pinSection = document.getElementById('widgetPinSection');
  const pinBtn = document.getElementById('pinWidgetBtn');
  const pinBtnText = document.getElementById('pinWidgetBtnText');
  const feedbackBox = document.getElementById('widgetFeedbackBox');
  const segmented = document.getElementById('widgetSizeSegmented');

  if (pinSection) {
    pinSection.style.display = 'block';
  }

  // Handle Tab Switcher
  if (segmented) {
    const buttons = segmented.querySelectorAll('.widget-size-pill');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedWidgetType = btn.getAttribute('data-type') || 'live';

        if (pinBtnText) {
          const names = {
            live: 'Live Class Tracker',
            landscape: 'Landscape Routine (Matrix)',
            portrait: 'Portrait Routine (Timeline)'
          };
          pinBtnText.textContent = `📲 Add ${names[selectedWidgetType] || 'Widget'} to Home Screen`;
        }

        renderWidgetPreview(selectedWidgetType);
      });
    });
  }

  // Initial Preview Render
  renderWidgetPreview(selectedWidgetType);

  if (pinBtn) {
    pinBtn.addEventListener('click', async () => {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          await updateNativeWidget();
          const { WidgetPlugin } = window.Capacitor.Plugins;
          if (WidgetPlugin) {
            if (WidgetPlugin.requestIgnoreBatteryOptimizations) {
              await WidgetPlugin.requestIgnoreBatteryOptimizations();
            }
            if (WidgetPlugin.pinWidget) {
              const res = await WidgetPlugin.pinWidget({ type: selectedWidgetType });
              if (res && res.requested) {
                showToast('Widget prompt opened! Tap "Add automatically".', 'success');
                if (feedbackBox) {
                  feedbackBox.style.display = 'block';
                  feedbackBox.style.background = 'rgba(16, 185, 129, 0.12)';
                  feedbackBox.style.border = '1px solid rgba(16, 185, 129, 0.35)';
                  feedbackBox.style.color = '#34d399';
                  feedbackBox.innerHTML = `
                    <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px;">🎉 Widget Pin Prompt Displayed!</div>
                    <div>Tap <strong>"Add automatically"</strong> in the Android system popup to place the widget on your Home Screen.</div>
                  `;
                }
              } else {
                showToast('Dynamic pinning blocked by launcher. See manual steps below.', 'info');
                if (feedbackBox) {
                  feedbackBox.style.display = 'block';
                  feedbackBox.style.background = 'rgba(251, 191, 36, 0.12)';
                  feedbackBox.style.border = '1px solid rgba(251, 191, 36, 0.35)';
                  feedbackBox.style.color = '#fbbf24';
                  feedbackBox.innerHTML = `
                    <div style="font-weight: 800; font-size: 13px; margin-bottom: 6px;">💡 How to Add Widget Manually:</div>
                    <div style="margin-bottom: 4px;">1. Go to your Android Home Screen</div>
                    <div style="margin-bottom: 4px;">2. Touch & hold empty space → Tap <strong>Widgets</strong></div>
                    <div>3. Scroll to <strong>My Routine</strong> and drag your favorite widget onto your screen!</div>
                  `;
                }
              }
            }
          }
        } catch (e) {
          showToast('Could not pin widget: ' + e.message, 'error');
        }
      } else {
        showToast('Home Screen Widgets are available in the Android Native App!', 'info');
      }
    });
  }
}
