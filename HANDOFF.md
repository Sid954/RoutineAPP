# Handoff: continue RoutineAPP in a new session (updated 2026-11-21, v1.5.26)

Paste this into the new session, or tell it: **"Read CLAUDE.md, PROJECT_OVERVIEW.md and HANDOFF.md first, then continue."**
CLAUDE.md and PROJECT_OVERVIEW.md hold the standing rules, the architecture and the release steps. This file only says where things stand right now.

## Where the project lives

- **`D:\sid\STUDY\Coding\RoutineAPP`** — this is the working copy again. On 2026-11-19 the user said the D: disk is fine, moved everything back from `E:\Projects\RoutineAPP` and deleted the E: copy (verified gone). Ignore any older note that says "never work on D:".
- Branch: **`main-2cmtj2-0lzicl`**, in sync with origin and with `main` at `5e8d0f1` (v1.5.26, versionCode 36). Older sessions used `main-2cmtj2`; the current one is `main-2cmtj2-0lzicl`.
- `secrets/` (release keystore `routine-release.jks` + `github-secrets.txt`) is present and gitignored. CI signs from GitHub secrets. **`secrets/github-secrets.txt` is a plaintext copy of the CI secrets — flagged; deleting it is the user's call.** Never paste secrets in chat.

## Get in sync

```bash
git fetch origin && git checkout main-2cmtj2-0lzicl && git pull && npm install
npm test   # 31 suites, all passing as of 2026-11-21 (verified)
```

## Released since the last handoff (v1.5.15 → v1.5.26)

- **v1.5.15–18:** Community Suggestions (rules in `api/_lib/suggestion-rules.js`, client `src/announcements/suggestions.js`; `supabase_suggestions.sql` was run 2026-11-18). Notices redesign: Notices/Suggestions tabs, icon filter chips, folding groups, dock badge, compact vote cards, 4-step composer (suggest or announce). API rate limits (`guard()` in `api/_lib/security.js`) + a Vercel Firewall rule the user set.
- **v1.5.19:** notice detail sheet and class detail sheet redesigns (quiet reading-order style, compact tiles with tap hints).
- **v1.5.20:** grouped Settings with the schema-driven prefs system (`src/settings/pref-schema.js`, `prefs.js`, `prefs.css`; localStorage `routine.prefs.v1`, mirrored to `<html data-p-*>`), redesigned Home/Routine/Apps/Notices, week = **Thursday–Wednesday**, "Back to today" floating button (only in a different week; can be disabled in Settings), swipe runs into next/previous week, holidays keep the routine visible under a banner.
- **v1.5.21:** One UI Notifications page + sub-pages, per-day bell sheet (`src/notifications/day-sheet.js`, swipe between days), **per-type custom sounds** (WAVs from `scripts/gen-notif-sounds.js`, one Android channel per type/sound/vibration/lock choice; `api/_lib/notice-push.js` groups pushes by channel — needs the Vercel deploy, which happened).
- **v1.5.22–23:** faster taps/boot, simpler per-day notifications with swipe; confirmed/not-confirmed icon badges (`src/announcements/confirm-badge.js`) with explanation sheets; greyed cancelled cards; Weekly Routine deliberately plain.
- **v1.5.24:** Rooms calendar/clock buttons, rooms sorted by number, no "Now" on other days, tappable cancelled rows.
- **v1.5.25–26:** **new Home dashboard** (`src/home/`, plan in `HOMEPAGE_PLAN.md`), the old timeline moved to the **Day page** on the center dock button, **Attendance** (`src/attendance/`), **Notes v1** and **Exams** (`src/exams/`). See the Nov 20 afternoon changes below — they reshape Home further and ship in v1.5.27.

## Nov 20 afternoon batch (committed Nov 21; user said "release" → shipping as v1.5.27, versionCode 37)

~22 modified files + 5 new ones (+1189/−289), plus the Nov 21 ambient star tweak. All of it was built and checked in the phone-size browser preview; **31/31 tests pass** (re-verified 2026-11-21). **Not phone-tested** — the user chose to release anyway; phone checks are §30 in TESTING_CHECKLIST.md.

1. **Notes app v2 — full rebuild** (new `src/notes/notes-page.js`, `notes.css`, rewritten `notes-store.js`, `tests/test_notes_v2.js`). Notes + checklists, quick capture, pin/archive/8 colours, class label + free tags, filter chips, search/sort, grid/list, optional date+time, full-screen autosaving editor, Trash (30 days) + Undo, share/copy/duplicate/convert, export/import backup. Old v1 to-dos auto-migrate to one-item checklists; backup kept at `notes_v1_backup`. Opens from the Home header Notes button and the Apps hub (`window.__openNotes`). Ten QA bugs fixed (focus rings, squeezed fields, light-theme white boxes, grid balance, pin overlap, stale filters…). **Not verified:** export/import on a real phone; reminder notifications deliberately NOT added (must go through `planner.js` — separate task).
2. **Password guard** (new `src/announcements/pw-guard.js` + `tests/test_pw_guard.js`, wired into `post-form.js` + `index.html`). After 1 wrong password: amber "Suggest it instead" box (sends the notice as a section suggestion, no password). Local locks: 3rd wrong = 5 min, 6th = 15 min, 9th+ = 60 min, countdown shown; correct password or a clean day resets. Server "too many attempts" also locks 15 min. Hidden when editing. **Not verified:** the suggestion actually sending end-to-end (the mock server had no suggestions API).
3. **Home fixes** (`src/home/home.js`, `home.css`, `home-deadlines.js`, `layout-store.js`, `attendance/*`):
   - The card set is now: header (clock/greeting + Notes & settings buttons), **Classes** (today, or tomorrow after the evening cut-off; every class row shows the subject's attendance % on the right; after a class ends the slot becomes a Present/Absent checker until answered or 11:59 PM; one "Skip all" after the day ends; unmarked counts as **absent**), What changed, Due soon, Exams, Teachers, Notices, Suggestions, Quick actions. The separate Attendance prompt / Today's classes / Notes cards were removed. **Teachers and Suggestions start hidden** (`DEFAULT_HIDDEN`).
   - Due soon: one card at a time, swipe between them with dot count; Done moves the item to the end on next refresh (not instantly); heading badge = unchecked count, red when an unchecked item is due today/tomorrow; green tick when all done.
   - Exams card redesigned: big days-left tile (solid orange ≤3 days, "Today" on the day), next 3 exams as rows, "+N more"; empty state explains adding midterm/final dates.
   - An exam on the shown day flags red: header "5 classes · 1 exam", red class rows with EXAM tag, red banner for exams that aren't class slots.
   - Passed items disappear (exams/tests/changes after they happen; assignments after their due time); chips say Today/Tomorrow/in Nd, never "in 0d".
   - Manual present/absent for dates the estimate doesn't cover: allowed with a one-time-per-edit-session warning popup (icon-details popup style); month navigation can go back before the semester start.
4. **Notices after the evening cut-off** (`notices-view.js`): Tomorrow group moves above Today, Today starts folded.
5. **Dark theme** (`src/themes/themes.css`, `src/core/theme.js`): the blue-tinted rewrite was rejected ("AI slop") and reverted to neutral charcoal, then slightly deepened: page `#131418`, cards `#212329`, faint top lift + card edge kept. Light theme unchanged. Only Home was re-checked after the deepen.
6. **Ambient time-of-day rewrite: REVERTED.** The user hated the big six-phase sky rewrite; the original faint four-phase scene was restored exactly (`git checkout` of `ambient.js`/`motion-plus.css`, new `ambient.css` deleted). Do not redo it. **Nov 21:** the user answered "yes" to the tiny-tweak offer — night stars slightly stronger, two values only in `motion-plus.css` (`.amb-star` opacity 0.5→0.65 dark, 0.18→0.25 light). Nothing else changed.

## Where we left off (exact)

Session of Nov 20 ended ~18:12 local after the ambient revert. On Nov 21 the user approved the tiny star tweak and said "release new version"; the whole batch is committed and released as v1.5.27. The user's last design direction (Nov 20): **minimal changes**, no Samsung/One UI styling for the new Home work — follow "the given image" (an attached reference image that is NOT recoverable from the transcripts; ask the user to re-share it before further Home/design work).

## Waiting on the user

1. **The reference image** for the post-One UI design direction.
2. **Phone checks** in `TESTING_CHECKLIST.md` — how far they got, and anything broken on device (fix failures before new work). Most important unticked: §2 push end-to-end (never confirmed), §19 in-app update, §20 widgets, §25–28, and §29–30 (v1.5.27 batch).
3. Backlog #6 "icon overflow": which screen was meant? #11 admin schedule editor: needs an auth design.

## Still open (code tasks)

- Notes reminder notifications (planner-only rule; new planner kind + channel + settings).
- Verify "Suggest it instead" sends for real (needs the live API or a mock with `/api/suggestions`).
- Light-theme + 320 px checks for the exams card, Notes v2 and the deepened dark theme on pages other than Home.
- Note tag on Day-page class cards and in the class sheet (Home shows it; Day doesn't yet).
- "Where is my teacher now" line on the Teachers card.
- Better auth than the shared announcement password (user: "we will make it better later").

## Before the app goes public

- **Remove the temporary "Test time" clock** — only when the user says testing is done. Removal list in NEXT_TASKS.md (head script in `index.html`, `src/settings/test-time.js` + init in `main.js`, CSS block at the end of `settings.css`, `__devTimeOffset` guard in `notifications.js`).
- **Posting password is currently `test123`** (user set both `ANNOUNCEMENT_PASSWORD` and `ADMIN_PASSWORD` to it on Vercel, verified working 2026-11-20). Weak — change before public.
- Test data still in Supabase: fake announcements/suggestions across the month (user said "keep it for now", Nov 19) and two `devtest-*` suggestions marked rejected.
- The repo is **public**. Before making it private: add a fine-grained GitHub token (this repo only, Contents read-only) as `GITHUB_TOKEN` on Vercel and redeploy, or in-app updates break.

## Disk history (context, resolved)

D: (Samsung HD502HJ) threw error 51 on Nov 17–18 and zeroed ~20 files + git objects; repaired from a fresh clone; project moved to E: on Nov 18, moved back to D: on Nov 19 at the user's request ("D drive is working fine now"). If 0-byte files or "packfile too short" ever reappear: `find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -size 0 -print`, restore from git, `npm ci`.

## Working rules (short — full list in CLAUDE.md / PROJECT_OVERVIEW.md)

- Ask before committing, pushing, releasing, or running build/screenshot/browser-automation scripts. Release only when the user says "release" (4-file release commit; never mention "Samsung UI" in release notes).
- Never claim "fixed" without evidence (test/script output, measurement, or the user's phone confirmation). The user tests major changes on their Redmi (adb works; first launch after install is unresponsive ~10 s).
- Edit `src/` and root files, never `www/`. Native Android code in `android-custom/`. DOM IDs are a contract.
- SVG icons only, two themes, no glassmorphism/glow/`backdrop-filter`, keep safe-area padding.
- Calm motion + the Nov 20 motion rule: every swipe/toggle/state change animates (150–250 ms, `--mx-ease`, no overshoot, transform/opacity only, honour `data-motion`, mouse path via `bindMouseDrag`).
- Performance rules: `setHtmlIfChanged`, no forced layout, no infinite decorative loops, no layout reads in global touch handlers, nothing heavy in the 30 s poll.
- Overrides flag classes (never remove); exact `===` subject match; Weekly Routine stays plain; alerts only via `planner.js`; don't resurrect removed code; restore from last-known-good sources, never memory.
- Week = Thursday–Wednesday. Minimal design changes; the user rejects "AI slop" (blueish dark theme, big ambient rewrite, over-decorated cards).