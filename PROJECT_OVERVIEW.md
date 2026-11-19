# RoutineAPP — Agent Briefing

> Read this fully before touching any code. Last updated: **Nov 18, 2026** (v1.5.14, versionCode 24, commit `0f9771a`; `main` and `main-2cmtj2` are identical). Quick status for a new session: `HANDOFF.md`.  
> If significant time has passed since that date, treat this doc as background context and verify current state with `git log --oneline -20` + `git status`.

---

## What This App Is

**RoutineAPP** — a class-schedule and campus companion app for CSE university students.

- **Stack:** Vanilla ES6+ modules, modular CSS, Capacitor (Android APK + PWA), Supabase (Postgres + RLS), Vercel serverless API
- **Live URL:** `https://routine-app-iota-one.vercel.app`
- **GitHub pages mirror:** `https://sid954.github.io/RoutineAPP`
- **Build output:** `node build.js` → compiles everything into `/www/` — this is what actually ships.

---

## Standing Rules (Non-Negotiable)

Read these before doing anything. Violations have happened repeatedly.

1. **Ask before committing or pushing.** No auto-commit, ever. Not even "small" fixes.
2. **Ask before running build/screenshot/browser automation scripts.**
3. **Never claim "fixed" or "working" without real evidence.** Acceptable: screenshot from device, actual script output against real data, user's hands-on confirmation. "The code looks right" is not evidence. There is a history of false-completion claims in this project.
4. **User tests all major changes on their physical phone.** Unit/simulation tests catch logic bugs — not real-device rendering, PWA caching, or Capacitor WebView behavior.
5. **When fixing a drifted component, copy exact values from the last-known-good source.** Never recreate from memory. "Recreating from memory" is the #1 recurring root cause of regressions here.
6. **Any change to `api/*.js` requires a real commit + push + Vercel deploy to take effect.** Local builds don't touch the live endpoint. A production 500 error was shipped once precisely because a fix was never actually pushed.
7. **Never trust a commit message or prior summary over the live file.** Multiple AI sessions have worked on this codebase with zero cross-session visibility. When real behavior matters, always verify against `git diff` and actual file contents.
8. **If you spot an API key or secret in plaintext anywhere**, flag it immediately and do not silently use it. A Supabase service role key was accidentally exposed once and had to be rotated. Use env vars only.
9. **Do not resurrect deliberately-removed code.** Class-start/pre-class notification scaffolding was intentionally removed — it needs a ground-up rebuild, not a restore from git history.
10. **Zero emoji as UI icons. SVG only.** This is a recurring regression. Always double-check after implementing any new UI component.

---

## Architecture

### Data Flow (Current State — Post Supabase Migration)

```
Supabase Postgres
    └── api/schedule.js       (Vercel Serverless, public read)
    └── api/teachers.js       (faculty profiles, RLS-gated writes)
    └── api/announcements.js  (per-section + department-wide reads)
    └── api/faculty.js        (faculty directory)

Client Boot Sequence (src/events/init.js):
  1. Load cached schedule from localStorage instantly → render dashboard immediately
  2. Fetch fresh schedule from /api/schedule (Supabase) → fallback to bundled ./src/data/sem-X/Y/routine.json if API fails
  3. Apply announcement overrides from getEffectiveClassesForDay()
  4. Poll announcements every 30s → re-resolve overrides → cascade refresh all views
```

### Schedule Data (Supabase — migrated Aug 31, 2026)

Tables: `academic_terms`, `semesters`, `sections`, `rooms`, `courses`, `class_sessions`, `schedule_edit_suggestions`

Seeded data:
- 1 academic term: `spring_2026` (current)
- 8 semesters, 41 sections, 33 rooms, 70 courses, 518 class sessions
- Times stored as **integer minutes from midnight** (`start_mins`, `end_mins`). Example: `585 = 09:45`, `660 = 11:00`
- Day indices: `0=Sunday, 1=Monday, ..., 6=Saturday` (JS convention)
- Room `03` is remapped to `503` for Sem 4-C Saturday MML session

API endpoints in `api/schedule.js`:
- `?action=rooms_master` — all 33 rooms with full metadata
- `?action=teachers_master` — all 84 teacher codes + schedule cross-reference
- `?action=section&semester=X&section=Y` — routine JSON for a section (normalizeSchedule-compatible)
- `?action=courses` — course code → full name lookup
- `?action=semesters_sections` — semester/section directory

### 3-Tier Consumer Architecture

| Tier | File | Cache Key | Network Fallback | Offline Fallback |
|------|------|-----------|-----------------|-----------------|
| 1 — Teacher Finder | `src/teachers/teacher-finder.js` | `routine_master_teachers_v2` | `api/schedule?action=teachers_master` | `master_teachers_schedule.json` |
| 2 — Room Engine | `src/rooms/room-engine.js` | `routine_master_rooms_v5` | `api/schedule?action=rooms_master` | `master_rooms_schedule.json` |
| 3 — Core Routine | `src/events/init.js` via `fetchSectionSchedule()` | `genz_routine_data` (Storage) | `api/schedule?action=section&...` | `./src/data/sem-X/Y/routine.json` |

**Brand-new user / offline cold launch:** `CONFIG.defaultRoutine` (hardcoded in `src/core/config.js`) is the absolute last-resort fallback for the core routine. The app never shows a blank dashboard.

### Announcements & Overrides System

Announcements stored in Supabase, fetched **department-wide** (not just the user's section), and can override the live routine.

Override types: `cancellation`, `holiday`, `class_test`, `online_class`, `general`, `rescheduled`, `assignment`

**Critical design decisions — do not revert:**

- **Overrides FLAG classes, they do not remove them.** Cancelled/rescheduled classes get `isCancelled: true` etc. — rendered with badge + strikethrough/dashed style. Previously filtered out entirely (caused schedule to look wrong). Deliberately fixed.
- **Subject matching is EXACT (`===`), not substring (`.includes()`).** Past bug: `"DS"` matched `"DSL"`. The fix lives in `isSubjMatch()` in both `src/rooms/room-overrides.js` and `src/announcements/overrides.js`. Do not reintroduce fuzzy matching.

Central resolvers:
- **Student schedule:** `getEffectiveClassesForDay(dayIdx, dateVal)` in `src/schedule/queries.js` — single source of truth after all overrides applied. All dashboard/timeline/notification code reads through this.
- **Room occupancy:** `getEffectiveRoomClasses(roomId, dayName, dateStr, baseClasses)` in `src/rooms/room-overrides.js` — for Free Rooms.

### Faculty Data

- `faculty_members` table in Supabase: 42 CSE faculty (web-scraped + cleaned)
- 51 non-CSE stubs (Math, Physics, English, Economics, etc.): `name = teacher_code`, `designation = null`, `department = null`, `source = 'unverified_routine_code'`
- These stubs render cleanly in `teacher-names.js` — null-designation fallback shows raw code (e.g. `AIR`) with no crash
- **Do not add a NOT NULL constraint on `designation` or `department`** — the null values are intentional and correct

### Key Files

```
src/core/config.js          CONFIG, FULL_COURSE_NAMES, SUBJECT_PALETTES, DAY_MAP, defaultRoutine
src/core/state.js           Global State object
src/storage/storage.js      localStorage wrappers
src/events/init.js          App boot, fetchSectionSchedule(), 30s polling, refresh cascade
src/schedule/normalizer.js  normalizeSchedule() — raw JSON → { dayIdx: [{start, end, title, room, instructor, type}] }
src/schedule/queries.js     getEffectiveClassesForDay(), getActiveClass(), getNextClass()
src/announcements/          announcements.js (fetch/cache/post), overrides.js (subject/date matching)
src/rooms/                  room-engine.js, room-overrides.js, rooms-view.js, rooms.css
src/teachers/               teacher-finder.js, teacher-names.js
src/dashboard/              current-class.js, next-class.js (override-aware)
src/timeline/timeline.js    Week strip + daily timeline (override-aware)
src/notifications/          planner.js (pure: what to send, when), notifications.js (schedules via LocalNotifications,
                            public API), notif-store.js (prefs/skips/pause), notif-center.js (+.css) Notifications
                            page, health.js (delivery check), native-push.js (FCM)
api/register-token.js       FCM token + notice prefs (device_tokens.prefs)
api/_lib/notif-prefs.js     sanitizePrefs / pushDecision / pushTitle for notice pushes
api/schedule.js             Unified Vercel serverless for all routine data
api/teachers.js             Faculty directory and edit suggestion workflow
api/announcements.js        Supabase-backed announcement fetch/post + FCM push (device_tokens)
api/_lib/security.js        checkPassword() (constant-time, per-IP throttle, fail-closed), safeEqual, rate limiter
api/_lib/cors.js            applyCors(): shared CORS for every function
api/_lib/photo-upload.js    Shared faculty photo upload (whitelist, magic bytes, size cap, rate limit)
src/notifications/native-push.js  FCM registration (guarded by WidgetPlugin.isFirebaseConfigured())
src/widget/widget.js        Native widget sync; buildWidgetScheduleJson() sends override-aware 7-day schedule
scripts/seed-schedule.js    One-time seeder for schedule tables (has --dry-run flag)
supabase_schedule_schema.sql DDL for all 7 schedule tables + RLS + indexes
build.js                    Compiles /src → /www/ for deployment
```

### Testing

- Test suites live in `tests/` (tracked in git — moved out of the old gitignored `scratch/` on Sep 23, 2026)
- Run all: `npm test` (executes `tests/run.js`, which runs every `tests/test_*.js` with a 60s per-test timeout)
- 23/23 suites pass as of Nov 17, 2026 (v1.5.12; needs `npm install`; passes without `.env`, since every suite mocks the network or tolerates it being down). CI runs `npm test` before building the APK.
- On-device checks still pending are tracked in `TESTING_CHECKLIST.md` (latest: §22 v1.5.8–v1.5.10, §23 v1.5.11 performance, §25 v1.5.12 notifications).

### Critical DOM IDs & UI Constraints

JavaScript modules query specific DOM elements by ID — renaming an ID silently breaks event listeners and update cycles (and anything deep-linking or bridged to native code that depends on exact IDs). Markup structure and CSS classes can be redesigned freely, but **DOM element IDs must be preserved**:

- `cc`, `cT`, `cR`, `cBar`, `nc`, `nT`, `chG`, `prevDayBtn`, `nextDayBtn`, `vcC`, `ecC`, `viewModal`, `editModal`
- (`clockTrigger`, `findTeacherFab`, `freeRoomsFab` were removed in an earlier redesign; nothing references them)

Other hard boundaries:

- **Android Widget Independence:** Android widgets are rendered via native Java XML (`android-custom/res/layout/`). Web CSS changes will not break them as long as `build.js` remains intact.
- **State & Logic Separation:** All logic modules in `src/dashboard/`, `src/timeline/`, `src/rooms/`, and `src/teachers/` read from `State` and output structured HTML templates. The HTML strings they render can be styled to match any new design language.
- **Mobile WebView Safe Areas:** Must always maintain `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` so buttons and headers never get clipped by device camera notches or home gesture bars.

---

## Design System

Do not deviate without explicit user approval.

- **Light theme ("Printed Timetable", redesigned Nov 2026 at the user's request; replaced warm ivory whose cards barely separated from the page):** page `#EEF1F6` (cool paper), surfaces `#FFFFFF`, inset fields and chips `#F5F7FA` (`--surface-inset`), hairline borders `#DCE2EB`, text `#0E1726` / `#3B4659` / muted `#556173`, accent Cobalt `#2563EB` (hover `#1D4ED8`). Separation comes from tone and hairlines, with no card drop shadows. Text on any light tint uses the 700 shade of its hue. All main screens pass WCAG AA (automated check, 548 text elements).
- **Dark theme:** `#18191E` / `#23252C` + Luminescent Sky `#38BDF8`
- **Fonts:** Plus Jakarta Sans (UI), JetBrains Mono (times/metrics)
- **Icon badges:** squircle — 42×42px, `border-radius: 13px` (NOT `clip-path`)
- **No glassmorphism / glow / `backdrop-filter`.** A light popup-backdrop blur was allowed for one day (2026-11-17) and then removed in the performance pass, because it made the app laggy on the user's 90 Hz phone. Popups use a plain strong dim (`motion-plus.css` §21).
- **Performance rules (Nov 17, 2026 pass, `motion-plus.css` §25):**
  - Loop only `transform`/`opacity`. Endless `background-position`, `box-shadow` or `var()`-in-keyframes animations repaint every frame, as the greeting tint, the old clock line and the hidden loading spinner did.
  - Decorative loops pause when Home is hidden or covered, and closed sheets get `visibility: hidden`.
  - List re-renders go through `setHtmlIfChanged()`.
  - List fades animate the container once with `el.animate()`, not every child.
  - Long lists use `content-visibility: auto`.
  - No forced layout on page switches.
  - Measured A/B with headless Chrome over CDP (4× CPU slowdown, 390×844 @ 2.75×):
    - Home idle: 724 → 0 repaints in 3 s.
    - With a sheet open: 475 → 0.
    - Opening Faculty: style work 481 → 104 ms.
- **Calm motion only** (user, 2026-11-17: "remove every jump ... not junk AI slop"). No overshoot/spring curves, bounce, pop, rise-in, tilt, shake, confetti, bobbing icons, rolling digits or sheen sweeps. Content fades in; pages cross-fade; only bottom sheets, the week-strip morph and the live water fill move, decelerating with `--mx-ease` (`cubic-bezier(0.2, 0, 0, 1)`). The ambient Home background, pull-to-refresh, the dock hold ring and a soft touch ripple remain.
- **Layout:** one 16px gutter (`--gutter`) set on `.app-page-view`. Never patch a missing gutter per component with `padding-right`. Anything that scrolls under the floating dock needs `--dock-clearance` at the bottom.
- **Primary buttons:** solid accent (`--btn-grad` = `--accent`, text `--btn-text`), no gradient washes, no coloured shadows.
- **Motion** lives in `src/core/motion.css` and `src/core/motion-plus.css` (motion-plus is imported LAST in `src/main.css`). Tokens: `--dur-1/2/3/4` (120/200/320/520ms), `--ease-out` (enter), `--ease-in` (exit), `--ease-in-out` (state change), and `--mx-ease` (`cubic-bezier(0.2, 0, 0, 1)`) for anything that moves. `--ease-pop`, `--mx-spring` and `--mx-soft` are kept only as aliases of that no-overshoot curve, so don't treat them as overshoot curves. Rules:
  - Animate in response to an action: page change (`switchAppView` → `.view-enter` + `data-dir`, a cross-fade), sheet open/close (`closeModal` adds `.closing`), press feedback, expand, theme switch (`html.theme-transition`).
  - Day switch on Home: only the week-strip morph (`morphStripWidths` in `src/timeline/timeline.js`, 460ms). The timeline (`#chG`) and strip do not re-animate on a day switch, only on first load or after pull-to-refresh (`staggerReplay` in `src/core/motion-engine.js`). The old `#chG.day-swap` animation is gone.
  - The only animation that isn't triggered by an action is the dashboard entrance on app launch (`body.boot-enter`).
  - Don't animate things that re-render every minute (e.g. the live progress bar).
  - `prefers-reduced-motion` collapses everything to near-instant changes. Keep it working.
- **Light theme colours:** every pastel used on dark surfaces needs a light-mode pair (see the tag and Weekly Routine ink rules in `motion.css`). Never hard-code white text on palette backgrounds.
- **No emoji as UI icons — SVG only** — recurring regression
- **Two themes only** (light/dark) — all other palettes deleted, do not reintroduce

Announcement type color identity:

| Type | Color |
|------|-------|
| `cancellation` | Rose / Red |
| `holiday` | Amber / Gold |
| `class_test` | Orange |
| `online_class` | Emerald / Green |
| `general` | Sky Blue |
| `rescheduled` | Slate / Steel-Blue |
| `assignment` | Purple / Magenta |

---

## Current State (Nov 18, 2026, v1.5.14)

### Stable and confirmed
- Core redesign: dashboard, class detail sheet, faculty profile, apps hub nav — all full-page conversions
- Announcements system: 8-type system, all known bugs fixed
- Faculty data in Supabase: 42 CSE + 51 stub rows, RLS configured, approval-queue workflow active
- Free Rooms Stages 1 & 2: full rebuild, announcement override sync working, on-device tested (superseded by the Nov 17 Rooms redesign below)
- Schedule Supabase migration: 518 sessions seeded, 3-tier consumers migrated, offline fallbacks simulation-verified
- CI builds a **signed release APK** (Node 22, JDK 21, tests gate the build) and publishes `v<versionName>` from `version.json`. The first run succeeded on Nov 16, 2026, so backlog #8 is done.

### Done in code, needs on-device verification (see `TESTING_CHECKLIST.md`)
Nothing below has been physically tested on the user's phone yet. Do not call these "fixed" until the checklist is ticked.
- Critical: OTA updater no longer overwrites the user's routine with the legacy `schedule.json`. FCM push is wired end to end (`device_tokens`, awaited sends, dead-token pruning). Release signing uses a stable keystore (secrets in GitHub; local backup in the gitignored `secrets/` folder).
- Security: `checkPassword()` everywhere, no `secret123` fallback, hardened photo uploads, cron fails closed, shared CORS without credentials.
- Offline/perf: stable SW cache keys, 8s fetch timeouts, hidden-tab polling paused, 300-row announcements cap, 120-entry image cache.
- Features: widget respects overrides; past announcements hidden behind a toggle; 6pm rollover to tomorrow; multi-override badges plus calendar tint priority; holiday end date defaults to the next day; section list loaded from the API (settings + onboarding); per-user greeting name (was hardcoded); Weekly Routine and Schedule Settings shown as full pages (`.mo-page`); Free Rooms ghost-tap guard and copy fixes; emoji icons → SVG and `backdrop-filter` removed app-wide, including OS notification text, permission status badge, close buttons and LAB badges (shared `LAB_LABEL_HTML` in `src/core/utils.js`). Native widgets still use plain text glyphs `★`/`✓` because `RemoteViews` text cannot hold SVG.
- **Rooms redesign (Nov 17, 2026):** the Free Rooms page and its three sheets (day/time picker, floor picker, room schedule) were replaced by one Rooms page: a day row, a time scrubber (`#rmTimeRange`, 8:00 AM–4:30 PM, live "Now" mode re-ticks every 30s), Free/Soon/All status filter with counts, search and a Rooms/Labs filter, rooms grouped by floor with a per-room day strip, and a single room sheet (`#roomScheduleSheet`, status, day chips, strip, timeline with tappable classes and teachers). All UI is in `src/rooms/rooms-view.js` + `rooms.css` (`rm-` prefix); the engine (`room-engine.js`, `room-overrides.js`) is unchanged. Entry points kept: `window.__renderFreeRooms`, `openRoomInFreeRooms(roomId, dayIdx, returnView)`, `refreshFreeRoomsIfVisible()`; view id is still `freeRoomsAppView` / `free_rooms`. Checklist §13.
- **Settings rebuild (Nov 2026):** `#editModal` page with inline name save, a "Switch" bar for semester/section (only that reloads), light/dark picker, a day-by-day class editor with Undo, and "Restore official routine" that re-downloads the user's own section. Logic: `src/settings/settings-page.js`, `src/edit-schedule/editor.js`. Checklist §15.
- **Faculty directory rebuild (Nov 2026):** directory page (`faculty-directory.js`: search, All/My teachers/In class/Today filters, A–Z rows with live status), profile sheet (`faculty-profile.js`: now card, contact actions, day/week schedule, courses taught) and pure helpers (`faculty-data.js`). Teacher classes go through `getEffectiveRoomClasses('', …)` so announcement overrides flag them (cancelled classes never count as "in class"). Suggest/admin modals keep their logic in `teacher-modal.js`, restyled and raised above the sheet. Styles in `src/teachers/faculty.css` (`fd-` prefix); `teachers.css` keeps only the badge and modal pieces. Tests: `tests/test_faculty_directory.js`. Checklist §16.
- **Notices rebuild (Nov 2026):** feed (`notices-view.js`): My section / Department scope, "Coming up" countdown strip, search, type filters with counts, unread bar + mark all read, feed grouped by event date, detail sheet with facts, join link, calendar (.ics / Google Calendar on Android), share, "In routine", admin pin/edit/delete. Post form (`post-form.js`): type tiles, audience (my section / other sections / whole semester / everyone; class-tied types go to one section and use that section's routine), live preview, remembered author name. Pure model in `notice-model.js`; API layer in `announcements.js` (same public surface). Fix: edits keep the notice's own semester/section. No API change: empty semester/section were already stored as NULL (= wider audience). Styles: `notices.css`; `announcements.css` keeps only the timeline/Join pieces. Tests: `tests/test_notices.js`. Checklist §17.
- **Home polish (Nov 2026):** the v1.5.4 Home redesign was reverted at the user's request (they prefer their own design; do not redesign Home without asking). Added inside the original design (`src/timeline/timeline.js`, CSS at the end of `timeline.css`): "in Xm" badge on the next class, current break highlighted ("Free now"), "Up next" line on the live card, end-of-day strip with the next class, next-class link on empty/holiday days, cancel reason on cancelled cards, tappable deadline banners (open the notice), "Today" pill. Fix: live/past states only on the real date (same weekday next week no longer looked live). Checklist §18.
- **In-app updates (Nov 2026):** `api/app-update.js` (Vercel) reads the latest GitHub release (metadata + `version.json` at that tag + the APK's SHA-256 digest) and, with `?download=1`, 302-redirects to GitHub's short-lived signed asset URL (APK bytes never pass through Vercel). Native `AppUpdaterPlugin.java` downloads into `cache/updates/` with progress events, verifies SHA-256, and opens the installer through FileProvider (`REQUEST_INSTALL_PACKAGES`). JS flow and sheet: `src/updater/app-update.js` + `updater.css`, wired into `apk-updater.js` (Settings card) and `init.js` (launch check, "What's new" after an update, resume re-check every 6h). App files (`sw.js`, `version.json`) are now read from Vercel, not GitHub Pages. **Before making the repo private:** create a fine-grained GitHub token (this repo only, Contents: Read-only), add it on Vercel as `GITHUB_TOKEN` (Production), redeploy. The app is not public yet (only the developer's phone), so the only requirement is that this phone has 1.5.6+ installed once; older versions only know GitHub Pages / browser downloads. Tests: `tests/test_app_update.js`. Checklist §19.
- **Widgets rebuilt (Nov 2026):** the native side now computes everything itself. `WidgetNow.java` (pure: live/break/before/done/off/holiday + next refresh time, JVM-tested by `tests/test_widget_native.js`), `WidgetData.java` (reads the dated `schedule_v2` the app sends: 14 dates with announcements applied and flagged, plus the weekly routine as fallback; still reads the old weekday JSON), `WidgetUpdater.java` (renders all three widgets, arms ONE alarm: every 2 min in class / the hour before a class, otherwise the next class boundary, 1h before the first class or midnight, max 3h; exact when allowed), `WidgetUpdateReceiver.java` (alarm, refresh buttons, boot, app update, time/timezone/locale). Fixed: the live widget only ever showed text the app wrote while open (the old engine wrote to a different prefs file); stale weekday-keyed overrides repeated every week; no boot/time-change receivers (and no RECEIVE_BOOT_COMPLETED), so widgets froze after a restart; three 60s alarms; the week list never reloaded; the day-list selection never reset. `RoutineScheduleEngine.java` removed. JS: `buildWidgetScheduleV2()` in `src/widget/widget.js`, pushed only when it changes. Checklist §20.
- **Motion v2 (Nov 2026):** `src/core/motion-engine.js` + `src/core/motion-plus.css` (imported LAST, after motion.css). Tiers on `html[data-motion]` = full | lite | off: Auto picks from hardware (cores, memory, data saver), a 1.2s frame probe after launch, and a long-task watcher that steps full → lite; prefers-reduced-motion → off; Settings → Animations overrides (`motion_pref`). Engine: soft ripple and press feedback on all tappables, haptics (`@capacitor/haptics`, web vibrate fallback, `haptics_pref`), a cross-fade when a list re-renders (signature ignores digits, throttled, so minute ticks and slider drags don't replay; since the calm-motion pass it fades without rise or stagger), drag-to-dismiss for bottom sheets (dispatches a backdrop click), pull-to-refresh on Home/Notices/Faculty/Rooms (soft refresh). The confetti `window.__celebrate` was removed in the calm-motion pass (`5aad21c`). Transform/opacity only. Replaced `events/pull-to-refresh.js`, which reloaded the app on any downward swipe because it checked window.scrollY (always 0 here). Checked headless at 1× and 6× CPU throttle: p95 16.8 ms frames. Checklist §21.
- **Feedback batches 1–3 (v1.5.8–v1.5.10, Nov 17, 2026; items in `NEXT_TASKS.md`):**
  - Fixes: scrolling, plus the Android back button (`src/events/back-button.js`).
  - Notifications: a health check (`src/notifications/health.js`), and the vibration toggle greys out when the phone's vibration is off.
  - Off days (`src/core/off-days.js`).
  - Centre dock button: tap goes to today or refreshes, hold opens the calendar.
  - Home: ambient background (`src/core/ambient.js`; light theme has stronger variants), live class "water fill", idle tips (`src/core/tips.js`).
  - Class-sheet quick actions open a prefilled post form.
  - Pages clear the dock (`motion-plus.css` §24).
  - Week-strip FLIP morph (`morphStripWidths`).
  - Calm motion pass (`5aad21c`).
  - User rejections:
    - Simple post mode was added and then removed; the full form is the only mode.
    - The sky/cloud sun was rejected; the original v1.5.8 sun stays, moved under the settings gear.
    - The live card's "Up next / Last class today" line was removed.

  Checklist §22. Still open: `NEXT_TASKS.md` item 17 (community suggestions, duplicates, pending, voting), which needs the user's API and Supabase decisions.
- **Temporary test clock (remove before the app goes public, only when the user says testing is done):** a "Test time" tab at the top of every page. The removal list is in `NEXT_TASKS.md`:
  - the head script in `index.html`
  - `src/settings/test-time.js` and its init in `src/main.js`
  - the CSS block at the end of `src/settings/settings.css`
  - the guard in `scheduleForToday` in `src/notifications/notifications.js`
- **Performance pass (v1.5.11, Nov 17, 2026, checklist §23):**
  - The popup blur was removed, and the idle repaint loops stopped: the greeting tint, the clock line, the hidden spinner, and ambient/live loops while Home is hidden or covered.
  - `setHtmlIfChanged` list re-renders, container fades, `content-visibility`, and no forced layout on page switches.
  - The rules are under "Performance rules" in the Design System above.
- **Settings → Notifications row, and www/ untracked (Nov 17, 2026):** stale `www/` copies were removed from git (Vercel and CI build it).
- **Mouse acts like a finger, and a Coming up swipe fix (v1.5.14, released Nov 18, 2026, checklist §27):** The Notices "Coming up" row was being rebuilt mid-swipe by feed refreshes, on phones too; it now keeps its DOM and scroll position. drag-scroll with fling on every page, list, sheet and row, with the same edge hand-off as touch (`bindDragScroll` in `src/core/desktop-input.js`). Verified with real mouse input through CDP: Notices, Faculty, Rooms, Settings, Home, sheets, the Rooms slider, pull to refresh, and no stray clicks or text selection.
- **Desktop / mouse support (v1.5.13, released Nov 18, 2026, checklist §26):** `src/core/desktop-input.js` (see CLAUDE.md). Verified with real mouse, wheel and keyboard input through CDP at 1280×800 and 390×800. Touch behaviour is identical to before (A/B with touch emulation).
- **Notifications rebuild (v1.5.12, released Nov 17, 2026, checklist §25):**
  - **Planning:** `src/notifications/planner.js` (pure, `tests/test_notification_planner.js`) plans 7 days of local alerts from the routine and announcements:
    - class reminders: lead 5–30 min, its own lab lead, every class or the first only, optional "starting now"
    - test reminders: a test lead time, plus a heads-up the evening before
    - morning summary and tomorrow preview, at times the user picks
    - assignment deadlines: N hours before, and the evening before
  - **Controls:**
    - weekday switches
    - quiet hours
    - skips: per class/date, per day, per alert, deadline "Done"
    - pause: 1 h / 3 h / rest of today / until resumed
  - **Scheduling:** `notifications.js` keeps the old public API. It collects planner input (`collectDays`), cancels and reschedules everything with Capacitor LocalNotifications, and uses Android channels `class_reminders`, `daily_digest`, `deadlines`, `announcements_channel` and `notices_quiet`. Action buttons are Skip this class / Mute today / Done, and a tap opens the right date or Notices. It re-plans on boot, resume, routine or notice changes, settings changes, and after midnight. The test-clock guard stays at the top of `scheduleForToday`.
  - **Storage:** `notif-store.js` keeps prefs, skips and pause in localStorage.
  - **Redesign (Nov 19, 2026, not yet phone-tested):** the Notifications page is a One UI hub plus sub pages (`notif-center.js`: Class reminders, Daily summary, Tests, Deadlines, Notices, Sound and vibration, Days and quiet hours). The bell beside the day title on Home opens `day-sheet.js`, which edits one date through per-date overrides (`notif-store.js` `notif_dates_v1`, planner input `dates`: lead and classes only; summaries are never per-day) plus the per-alert switches (shared rows in `upcoming.js`). Swipe sideways or use the arrows to step through days (today to +60). The bell shows the viewed day: plain, cross (day off) or sliders (customized). New prefs: `sounds`, `vibrate` per type (class, digest, test, deadline, notice), `privacy.hideOnLock`, `classes.online`. Sounds are WAVs made by `scripts/gen-notif-sounds.js` (`android-custom/res/raw/nf_*.wav`, previews in `src/notifications/sounds/`). Android fixes a channel's sound once created, so `channelSpec()` in `notifications.js` makes one channel per type, sound, vibration and lock-screen choice (`nf_<type>_<sound>_<vib><hide>`) and prunes old ones. The notice channel id travels in the server prefs (`noticeChannel`), and `api/_lib/notice-push.js` groups pushes by it, so it needs a Vercel deploy.
  - **UI:**
    - the Notifications page `#notifModal` (`notif-center.js` + `notif-center.css`), opened from Settings → Notifications: status + health check, quick pause, a "Coming up" list (today and tomorrow, each alert and day switchable), the types with their options, notice type chips, weekdays and quiet hours
    - a "Reminder" switch in the class sheet (`class-detail.js` updateRemindRow)
  - **Notices:**
    - in-app alerts follow the type switches, pause and quiet hours (`noticeAllowed`)
    - the app sends its prefs with the FCM token (`api/register-token.js`), and `api/announcements.js` skips devices that turned that type off or are paused, and uses the silent `notices_quiet` channel during their quiet hours (`api/_lib/notif-prefs.js`, `tests/test_notif_prefs_api.js`)
    - push titles no longer contain emoji
  - `supabase_notification_prefs.sql` (adds `device_tokens.prefs`) **was run by the user on Nov 17, 2026**, and the API is live on Vercel. Notice filtering takes effect once a phone on v1.5.12 re-registers its token.
  - Not confirmed on a phone yet.
- The schedule migration (`9ba2156`) device test is also still outstanding: dashboard, Teacher Finder, Free Rooms, airplane mode.

### Backlog

Done (Nov 16, 2026): #1 holiday end date, #2 multi-override icons, #3 calendar colour priority, #4 past announcements, #5 6pm rollover (greeting text unchanged), #7 full-page Matrix/Settings, #8 APK build verified in CI, #10 Free Rooms polish (tap fix unconfirmed on device).

Still open:
6. Announcement icon overflow (cap ~5, "+N" chip). No such icon row was found besides the week-strip badges, which now cap at 3 with "+N". Confirm with the user which screen was meant.
9. ~~Class-start/pre-class notifications~~: **done Nov 17, 2026**; see "Notifications rebuild" under Current State.
11. Schedule admin/edit flow: build an admin-facing UI to edit schedule data without a re-seed. Needs an auth design (reuse `checkPassword()` / `ADMIN_PASSWORD`, or Supabase Auth).

Feature ideas (not committed to): `.ics` / Google Calendar export, exam and assignment countdown, attendance tracker, "where's my teacher now", section free-slot compare.

---

## Suggested First Steps for a New Agent

1. Run `git log --oneline -15` and `git status` — confirm actual repo state.
2. Ask the user how far they've got through `TESTING_CHECKLIST.md`. Fix anything that failed on device before starting new work.
3. Then ask which open item to tackle: #6 needs clarification, #11 needs an auth design, and `NEXT_TASKS.md` item 17 needs API/Supabase decisions. (#9 notifications is done.)
4. Before touching the overrides system, re-read the Architecture section above — it has a history of subtle regressions.
