/**
 * Confirmed / not confirmed marks for community suggestions, drawn as icons (replacing the words
 * "Confirmed by votes", "Unconfirmed", "(NOT CONFIRMED)"):
 *   verified    green circle with a check: classmates voted a suggestion in, it is an official notice
 *   unverified  amber circle with a cross: a suggestion the section is still voting on
 * Tapping one opens a sheet that says what it means and why, with a button to go to that notice or
 * suggestion. Used on the routine's class cards, the class sheet, the Notices list and the notice sheet.
 */
import { State } from '../core/state.js';
import { DOM } from '../core/dom.js';
import { escapeHtml } from '../core/utils.js';
import { openModal, closeModal } from '../modals/modal.js';
import { Suggestions, RULES } from './suggestions.js';

const ICON = {
  verified: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6.5 12.5 10.5 16.5 17.5 8.5"/></svg>',
  unverified: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>'
};
const LABEL = { verified: 'Confirmed by classmates. Tap to see what this means', unverified: 'Not confirmed yet. Tap to see what this means' };

/** The icon button. ref: notice id (verified) or suggestion id such as "s12" or "12" (unverified). */
export function confirmBadgeHtml(kind, ref = '', extraClass = '') {
  const k = kind === 'verified' ? 'verified' : 'unverified';
  return `<button type="button" class="cf-badge is-${k}${extraClass ? ` ${extraClass}` : ''}" data-cf="${k}" data-cf-ref="${escapeHtml(String(ref))}" aria-label="${LABEL[k]}" title="${k === 'verified' ? 'Confirmed' : 'Not confirmed'}">${ICON[k]}</button>`;
}

const sugId = ref => String(ref || '').replace(/^s/, '');
const findSuggestion = ref => (Suggestions.list || []).find(s => String(s.id) === sugId(ref)) || null;

function copyFor(kind, ref, inNoticeSheet) {
  if (kind === 'verified') {
    return {
      title: 'Confirmed by classmates',
      lead: 'This notice started as a classmate’s suggestion. Enough of your section voted that it is right, so it is now an official notice.',
      points: [
        ['What it means', `At least ${RULES.AUTO_MIN_SECTION} classmates voted and ${Math.round(RULES.AUTO_RATIO * 100)}% or more agreed. It is still worth a quick check with your teacher if it matters a lot.`],
        ['Why you see this mark', 'So you can tell a notice confirmed by votes from one posted directly by a class representative.']
      ],
      action: inNoticeSheet ? '' : 'Open the notice'
    };
  }
  const s = findSuggestion(ref);
  const p = s ? Suggestions.progress(s) : null;
  const status = p ? `${p.total} of ${p.goal} votes so far, ${p.up} agree and ${p.down} disagree.${p.daysLeft ? ` It stays open for ${p.daysLeft} more day${p.daysLeft === 1 ? '' : 's'}.` : ''}` : `It needs ${RULES.AUTO_MIN_SECTION} votes from your section, mostly agreeing.`;
  return {
    title: 'Not confirmed yet',
    lead: 'A classmate suggested this change. Nobody official has confirmed it, so it may turn out to be wrong.',
    points: [
      ['Why you see it', `Your section voted it up (at least ${RULES.APPLY_NET} more agrees than disagrees), so it already shows in your routine, marked with this cross.`],
      ['What happens next', status + ' At the vote goal, with most agreeing, it becomes an official notice. If it does not get there it is removed.']
    ],
    action: 'View the suggestion'
  };
}

let _el = null;
function ensure() {
  if (_el) return _el;
  _el = document.createElement('div');
  _el.className = 'class-sheet-modal-overlay cf-overlay';
  _el.style.zIndex = '100070';
  _el.innerHTML = `<div class="nt-sheet cf-sheet" role="dialog" aria-modal="true" aria-labelledby="cfTitle">
      <div class="nt-grip"></div>
      <button type="button" class="nt-sheet-close" data-cf-close aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
      <div class="nt-sheet-body" id="cfBody"></div>
    </div>`;
  document.body.appendChild(_el);
  _el.addEventListener('click', e => {
    if (e.target === _el || e.target.closest('[data-cf-close]')) { closeModal(_el); return; }
    const go = e.target.closest('[data-cf-go]');
    if (go) { const { kind, ref } = go.dataset; closeModal(_el); goTo(kind, ref); }
  });
  return _el;
}

export function openConfirmInfo(kind, ref = '', inNoticeSheet = false) {
  const k = kind === 'verified' ? 'verified' : 'unverified';
  const c = copyFor(k, ref, inNoticeSheet);
  ensure();
  document.getElementById('cfBody').innerHTML = `
    <div class="cf-head"><span class="cf-big is-${k}">${ICON[k]}</span><h2 id="cfTitle">${escapeHtml(c.title)}</h2></div>
    <p class="cf-lead">${escapeHtml(c.lead)}</p>
    ${c.points.map(([h, t]) => `<div class="cf-point"><strong>${escapeHtml(h)}</strong><p>${escapeHtml(t)}</p></div>`).join('')}
    <div class="cf-actions">
      ${c.action ? `<button type="button" class="cf-go is-${k}" data-cf-go data-kind="${k}" data-ref="${escapeHtml(String(ref))}">${escapeHtml(c.action)}</button>` : ''}
      <button type="button" class="cf-ok" data-cf-close>Got it</button>
    </div>`;
  openModal(_el);
}

/** Take the reader to that notice (verified) or suggestion (unverified). */
function goTo(kind, ref) {
  // Leave whatever is open on top of the Notices page (the class sheet, a notice sheet)
  if (DOM.classDetailModal) closeModal(DOM.classDetailModal);
  if (kind === 'verified') {
    const sheet = document.getElementById('ntSheet');
    if (sheet && sheet.classList.contains('open')) closeModal(sheet);
    if (window.switchAppView && window.__currentAppViewId !== 'announcements') window.switchAppView('announcements');
    if (window.__openNotice) window.__openNotice(ref);
  } else if (window.__openSuggestion) {
    window.__openSuggestion(sugId(ref));
  }
}

let _bound = false;
/** One listener for every badge, in the capture phase so a badge never also opens the card under it. */
export function initConfirmBadges() {
  if (_bound) return;
  _bound = true;
  const onTap = e => {
    const b = e.target.closest && e.target.closest('.cf-badge');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openConfirmInfo(b.dataset.cf, b.dataset.cfRef, !!b.closest('#ntSheet'));
  };
  document.addEventListener('click', onTap, true);
  document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('cf-badge')) onTap(e); }, true);
}
