import { DOM } from '../core/dom.js';
import { State } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { Storage } from '../storage/storage.js';
import { normalizeSchedule } from '../schedule/normalizer.js';
import { forceUpdate } from '../dashboard/update.js';
import { showToast } from '../toast/toast.js';
import { renderEditColumns } from './editor.js';
import { Notifications } from '../notifications/notifications.js';

export function initImportExport() {
  // Export JSON
  document.getElementById('exB').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(State.schedule, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'routine-schedule.json';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Exported schedule JSON', 'success');
  });

  // Import JSON
  document.getElementById('imB').addEventListener('click', () => DOM.importFile.click());
  DOM.importFile.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        const backup = JSON.parse(JSON.stringify(State.schedule));

        for (const key in imported) {
          if (Array.isArray(imported[key])) State.schedule[key] = imported[key];
        }
        for (const dayIdx of CONFIG.activeDays) {
          if (!State.schedule[dayIdx]) State.schedule[dayIdx] = [];
        }

        Storage.saveSchedule(); forceUpdate(); renderEditColumns();
        Notifications.scheduleForToday();

        showToast('Imported schedule successfully!', 'success', () => {
          State.schedule = backup;
          Storage.saveSchedule(); forceUpdate(); renderEditColumns();
          showToast('Undo import', 'success');
        });
      } catch {
        showToast('Invalid JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}
