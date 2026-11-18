# Handoff: continue RoutineAPP in a new session (updated 2026-11-18, v1.5.17)

Paste this into the new session, or tell it: **"Read CLAUDE.md, PROJECT_OVERVIEW.md and HANDOFF.md first, then continue."**
CLAUDE.md and PROJECT_OVERVIEW.md hold the standing rules, the architecture and the release steps. This file only says where things stand right now.

## Update 2026-11-18 (late)
- **The project now lives at `E:\Projects\RoutineAPP`** (fresh clone). The old copy on D: (`D:\sid\STUDY\Coding\RoutineAPP`) sits on a failing Samsung HD502HJ hard disk: Windows logs disk error 51 and several files, including `.git/packed-refs` and `secrets/`, can no longer be read. Do not work on D:.
- `secrets/` (release keystore + `github-secrets.txt`) could not be copied off D:. CI still signs with the keystore stored in GitHub secrets. Keep another offline copy of the keystore somewhere safe.
- **Released: v1.5.15-v1.5.17**: Community Suggestions (NEXT_TASKS item 17; rules in `api/_lib/suggestion-rules.js`, client `src/announcements/suggestions.js`). Supabase tables were created 2026-11-18 (`supabase_suggestions.sql`). Verified on the phone: list, voting, flagged "NOT CONFIRMED" class in the routine. Not verified: the auto-confirm push and chime, admin approve/reject.
- **Not released yet (uncommitted until the user says)**: the Notices redesign:
  - Notices | Suggestions tabs, your section only.
  - Icon filter chips.
  - Cards say each thing once (`cardLines()` in `notice-model.js`), tinted by type.
  - Folding groups: Today, Tomorrow and unread open.
  - Number badge on the dock.
  - Hideable notification warning plus a settings button.
  - Compact up/down suggestion cards.
  - A 4-step composer (suggest or announce, type, details, check).
- API rate limits are live: `guard()` in `api/_lib/security.js`, plus a Vercel Firewall rule the user set. Announcement/suggestion GETs are CDN-cached 10s (+30s stale); the app bypasses that right after the user's own vote or suggestion.
- Two test suggestions (device ids `devtest-*`) remain in Supabase, marked rejected.
- Phone testing over adb works (Redmi 23030RAC7Y). The first launch after an install is unresponsive for about 10 s.
- Lesson: v1.5.15 shipped a render crash in `notices-view.js`; `tests/test_suggestions_client.js` now renders the Suggestions list. Test new render paths before releasing.
- Still open:
  - Phone checks in TESTING_CHECKLIST (§25-28).
  - A sound for every notification type (NEXT_TASKS "Later").
  - The "Test time" tab.

## Get in sync
- Branch: `main-2cmtj2`. It is identical to `main` at `425e3fb` (v1.5.17, versionCode 27), plus any later commits.
  ```bash
  git fetch origin && git checkout main-2cmtj2 && git pull && npm install
  ```
- **v1.5.14 is published.**
  - The signed CI build succeeded, and GitHub release `v1.5.14` has `app-release.apk`.
  - `/api/app-update` reports 1.5.14.
  - The Vercel production deploy succeeded.
- To build signed APKs locally, copy the gitignored `secrets/` folder from the old PC yourself. Never paste secrets in chat.
- The repo is still **public**. Before making it private, add a fine-grained GitHub token (this repo only, Contents read-only) as `GITHUB_TOKEN` on Vercel and redeploy, or in-app updates break.

## Recent releases
- **v1.5.11, performance** (user: "laggy on my 90 Hz phone"):
  - The popup blur is removed for good.
  - Nothing repaints at idle any more; decorative loops pause when Home is hidden or covered.
  - Lists keep their DOM when nothing changed (`setHtmlIfChanged`), and page switches no longer force layout.
  - Measured (headless Chrome A/B): Home idle went from 724 to 0 repaints in 3 s, and opening Faculty from 481 to 104 ms of style work.
  - The rules are in CLAUDE.md ("Performance").
- **v1.5.12, notifications rebuilt:**
  - `src/notifications/planner.js` (pure, tested) plans 7 days of alerts: class reminders, tests, morning summary, tomorrow preview and assignment deadlines.
  - Controls: pause, skip a class / day / single alert, weekdays, quiet hours, per-type notice switches.
  - The Notifications page opens from Settings → Notifications, and the class sheet has a Reminder switch.
  - The server filters notice pushes per device (`device_tokens.prefs`). **The user ran `supabase_notification_prefs.sql` on 2026-11-17.**
  - Push titles have no emoji.
- **v1.5.14:** the mouse works like a finger site-wide (drag-scroll with fling, edge hand-off to the other gestures), and the Notices "Coming up" row no longer resets mid-swipe (phones too).
- **v1.5.13, desktop:** the website works with a mouse and trackpad (`src/core/desktop-input.js`): drag to switch days or close sheets, pull to refresh, sideways rows scroll with the wheel, arrow keys. Touch is unchanged.
- **Settings → Notifications row** opens that page. `www/` is no longer tracked in git (Vercel and CI build it).

## Waiting on the user
- **Phone checks** in `TESTING_CHECKLIST.md`. Nothing from v1.5.8 on is confirmed on the phone yet. Most important:
  - §27: v1.5.14 mouse-as-finger and the Coming up swipe
  - §26: v1.5.13 desktop/mouse, plus the phone check that left swipes on the Home schedule switch days
  - §25: v1.5.12 notifications, including the notice-filter check
  - §23: v1.5.11 smoothness
  - §22: v1.5.8–v1.5.10
  - §2: push, never confirmed end to end
  - §19: in-app update
  - §20: widgets

  Don't call anything "fixed" without the user's confirmation or real measurements.
- **NEXT_TASKS.md item 17** (community suggestions without a password, duplicate detection, pending posts, voting) needs the user's API and Supabase design decisions. Ask before starting.
- **Backlog #6** "icon overflow": the screen is unknown; ask. **Backlog #11** admin schedule editor: needs an auth design.
- **Temporary test clock** (the "Test time" tab on every page) must be removed before the app goes public, but **only when the user says testing is done**. The removal list is in NEXT_TASKS.md:
  - the head script in `index.html`
  - `src/settings/test-time.js` and its init in `src/main.js`
  - the CSS block at the end of `src/settings/settings.css`
  - the `window.__devTimeOffset` guard at the top of `scheduleForToday` in `src/notifications/notifications.js`
- `secrets/github-secrets.txt` is a plaintext copy of the CI secrets on the old PC (gitignored). Deleting it is the user's call.

## Incident on 2026-11-17 (old PC only, nothing lost)
- **What happened:** on the user's Windows PC, about 20 project files, git's main pack file, 7 git objects and parts of `node_modules` were wiped to 0 bytes. The likely cause is an unclean shutdown or crash. The user may want to run `chkdsk` on drive D:.
- **The repair:**
  - git objects restored from a fresh GitHub clone; `git fsck --full` is clean
  - files restored from the last commit
  - `npm ci`
- **If it happens again** (empty files, git "packfile too short"):
  1. Find the 0-byte files:
     ```bash
     find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -size 0 -print
     ```
  2. Restore those files from git.
  3. Run `npm ci`.

## Working rules (short)
- Edit `src/` and root files, never `www/`. Native Android code goes in `android-custom/`.
- Ask before committing, pushing or releasing. Release only when the user says "release" (steps in CLAUDE.md).
- Keep the user's ORIGINAL Home design. No redesigns without asking.
- SVG icons only, two themes, keep the safe-area padding, and DOM IDs are a contract.
- Calm motion (`--mx-ease`, no bounce or pop, content fades) and the performance rules: loop only transform/opacity, and pause decorative loops when hidden.
- Alerts are planned only by `planner.js`.
