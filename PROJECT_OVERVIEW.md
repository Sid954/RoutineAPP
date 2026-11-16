# RoutineAPP — Agent Briefing

> Read this fully before touching any code. Last updated: **Nov 16, 2026** (v1.5.1 work, after commit `cb1b146`).  
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
src/notifications/          notifications.js (skips cancelled classes)
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
- 15/15 suites pass as of Nov 16, 2026 (needs `npm install`; verified passing without `.env`, since every suite mocks the network). CI runs `npm test` before building the APK.
- On-device checks still pending for the v1.5.1 work are tracked in `TESTING_CHECKLIST.md`.

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
- **No glassmorphism / glow / backdrop-filter anywhere** — recurring regression
- **Layout:** one 16px gutter (`--gutter`) set on `.app-page-view`. Never patch a missing gutter per component with `padding-right`. Anything that scrolls under the floating dock needs `--dock-clearance` at the bottom.
- **Primary buttons:** solid accent (`--btn-grad` = `--accent`, text `--btn-text`), no gradient washes, no coloured shadows.
- **Motion** lives in `src/core/motion.css` (imported last). Use its tokens: `--dur-1/2/3/4` (120/200/320/520ms) and `--ease-out` (enter), `--ease-in` (exit), `--ease-in-out` (state change), `--ease-pop` (small icon/badge overshoot). Rules:
  - Animate in response to an action: page change (`switchAppView` → `.view-enter` + `data-dir`), day change (`#chG.day-swap`), sheet open/close (`closeModal` adds `.closing`), press feedback, expand, theme switch (`html.theme-transition`).
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

## Current State (Nov 16, 2026, v1.5.1)

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
- The schedule migration (`9ba2156`) device test is also still outstanding: dashboard, Teacher Finder, Free Rooms, airplane mode.

### Backlog

Done (Nov 16, 2026): #1 holiday end date, #2 multi-override icons, #3 calendar colour priority, #4 past announcements, #5 6pm rollover (greeting text unchanged), #7 full-page Matrix/Settings, #8 APK build verified in CI, #10 Free Rooms polish (tap fix unconfirmed on device).

Still open:
6. Announcement icon overflow (cap ~5, "+N" chip). No such icon row was found besides the week-strip badges, which now cap at 3 with "+N". Confirm with the user which screen was meant.
9. Class-start/pre-class briefing notifications: rebuild from scratch (old scaffolding intentionally removed — do NOT restore from git). Needs product decisions first: lead times, which types, quiet hours.
11. Schedule admin/edit flow: build an admin-facing UI to edit schedule data without a re-seed. Needs an auth design (reuse `checkPassword()` / `ADMIN_PASSWORD`, or Supabase Auth).

Feature ideas (not committed to): `.ics` / Google Calendar export, exam and assignment countdown, attendance tracker, "where's my teacher now", section free-slot compare.

---

## Suggested First Steps for a New Agent

1. Run `git log --oneline -15` and `git status` — confirm actual repo state.
2. Ask the user how far they've got through `TESTING_CHECKLIST.md`. Fix anything that failed on device before starting new work.
3. Then ask which open backlog item to tackle (#6 needs clarification; #9 and #11 need design decisions).
4. Before touching the overrides system, re-read the Architecture section above — it has a history of subtle regressions.
