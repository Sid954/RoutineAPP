import { State } from '../core/state.js';
import { getClassesForDay } from '../schedule/queries.js';
import { getOverrideFor } from '../announcements/overrides.js';
import { toMinutes, format12h, getCurrentMinutes, formatRoom, pad } from '../core/utils.js';
import { showToast } from '../toast/toast.js';

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

    let nextLabel = "NEXT";
    let nextTitle = "None";
    let nextEta = "in 0m";
    let nextInfo = "Room: -- · --:--";
    let showNext = true;

    // 1. Check Holiday Override
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
      // Find Active Class & Next Class
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
        } else if (now < startMins && (!nextClass || startMins < toMinutes(nextClass.start))) {
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

        const elH = Math.floor(elapsedMins / 60);
        const elM = elapsedMins % 60;

        const override = getOverrideFor(todayIdx, activeClass.title);
        const isCancelled = override && override.type === 'cancellation';
        const isOnline = override && override.type === 'online_class';

        currentLabel = isCancelled ? "● CANCELLED 🚫" : (isOnline ? "● ONLINE 📡" : "● CURRENT");
        currentTime = `${format12h(activeClass.start)} – ${format12h(activeClass.end)}`;
        currentTitle = `${activeClass.title}${activeClass.instructor ? ` (${activeClass.instructor})` : ''}`;
        currentRoom = isOnline ? "ONLINE" : (formatRoom(activeClass.room) || "TBA");
        currentElapsed = `${pad(elH)}:${pad(elM)} elapsed`;
        currentProgress = pct;
        currentRemaining = `Remaining: ${remMins}m`;

        if (nextClass) {
          const nextStart = toMinutes(nextClass.start);
          const diffMins = Math.max(0, nextStart - now);
          nextLabel = "NEXT";
          nextTitle = `${nextClass.title}${nextClass.instructor ? ` (${nextClass.instructor})` : ''}`;
          nextEta = `in ${diffMins}m`;
          nextInfo = `Room: ${formatRoom(nextClass.room) || 'TBA'} · ${format12h(nextClass.start)} – ${format12h(nextClass.end)}`;
          showNext = true;
        } else {
          showNext = false;
        }
      } else if (nextClass) {
        // Break or before first class of the day
        const nextStart = toMinutes(nextClass.start);
        const diffMins = Math.max(0, nextStart - now);

        currentLabel = diffMins <= 30 ? "● STARTING SOON ⏰" : "● UP NEXT 📚";
        currentTime = `${format12h(nextClass.start)} – ${format12h(nextClass.end)}`;
        currentTitle = `${nextClass.title}${nextClass.instructor ? ` (${nextClass.instructor})` : ''}`;
        currentRoom = formatRoom(nextClass.room) || "TBA";
        currentElapsed = `Starts in ${diffMins}m`;
        currentProgress = 0;
        currentRemaining = `First Class at ${format12h(nextClass.start)}`;

        if (afterNextClass) {
          const afterStart = toMinutes(afterNextClass.start);
          const afterDiff = Math.max(0, afterStart - now);
          nextLabel = "FOLLOWING";
          nextTitle = `${afterNextClass.title}${afterNextClass.instructor ? ` (${afterNextClass.instructor})` : ''}`;
          nextEta = `in ${afterDiff}m`;
          nextInfo = `Room: ${formatRoom(afterNextClass.room) || 'TBA'} · ${format12h(afterNextClass.start)} – ${format12h(afterNextClass.end)}`;
          showNext = true;
        } else {
          showNext = false;
        }
      } else {
        // All classes finished for today
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
      theme_color: document.documentElement.getAttribute('data-color') || 'dark'
    });
  } catch (err) {
    console.warn('Widget update skipped:', err);
  }
}

export function initWidgetPinningUI() {
  const pinSection = document.getElementById('widgetPinSection');
  const pinBtn = document.getElementById('pinWidgetBtn');
  const feedbackBox = document.getElementById('widgetFeedbackBox');

  if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    if (pinSection) pinSection.style.display = 'block';
  }

  if (pinBtn) {
    pinBtn.addEventListener('click', async () => {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        try {
          await updateNativeWidget();
          const { WidgetPlugin } = window.Capacitor.Plugins;
          if (WidgetPlugin && WidgetPlugin.pinWidget) {
            const res = await WidgetPlugin.pinWidget();
            if (res && res.requested) {
              showToast('Widget prompt opened! Tap "Add automatically".', 'success');
              if (feedbackBox) {
                feedbackBox.style.display = 'block';
                feedbackBox.style.background = 'rgba(251, 191, 36, 0.12)';
                feedbackBox.style.border = '1px solid rgba(251, 191, 36, 0.35)';
                feedbackBox.style.color = '#fbbf24';
                feedbackBox.innerHTML = `
                  <div style="font-weight: 800; font-size: 13px; margin-bottom: 6px;">💡 How to Add Widget Manually:</div>
                  <div style="margin-bottom: 4px;">1. Go to your Android Home Screen</div>
                  <div style="margin-bottom: 4px;">2. Touch & hold any empty space → Tap <strong>Widgets</strong></div>
                  <div>3. Scroll to <strong>My Routine</strong> and drag it onto your screen!</div>
                `;
              }
              //   feedbackBox.style.display = 'block';
              //   feedbackBox.style.background = 'rgba(16, 185, 129, 0.12)';
              //   feedbackBox.style.border = '1px solid rgba(16, 185, 129, 0.35)';
              //   feedbackBox.style.color = '#34d399';
              //   feedbackBox.innerHTML = `
              //     <div style="font-weight: 800; font-size: 13px; margin-bottom: 4px;">🎉 Widget Pin Prompt Displayed!</div>
              //     <div>Tap <strong>"Add to home screen"</strong> or <strong>Touch and Hold the widget to add</strong> </div>
              //   `;
              // }
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
                  <div style="margin-bottom: 4px;">2. Touch & hold any empty space → Tap <strong>Widgets</strong></div>
                  <div>3. Scroll to <strong>My Routine</strong> and drag it onto your screen!</div>
                `;
              }
            }
          }
        } catch (e) {
          showToast('Could not pin widget: ' + e.message, 'error');
        }
      } else {
        showToast('Home Screen Widget is available in the Android Native App!', 'info');
      }
    });
  }
}
