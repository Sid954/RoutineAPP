# RoutineAPP — Agent Briefing

> Read this fully before touching any code. Last updated: **Sep 23, 2026** (commit `9ba2156`).  
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
api/announcements.js        Supabase-backed announcement fetch/post
scripts/seed-schedule.js    One-time seeder for schedule tables (has --dry-run flag)
supabase_schedule_schema.sql DDL for all 7 schedule tables + RLS + indexes
build.js                    Compiles /src → /www/ for deployment
```

### Testing

- Test suites live in `tests/` (tracked in git — moved out of the old gitignored `scratch/` on Sep 23, 2026)
- Run all: `npm test` (executes `tests/run.js`, which runs every `tests/test_*.js` with a 60s per-test timeout)
- 8/10 suites pass as of Sep 23, 2026. The two exceptions are environment-dependent, not logic failures:
  - `test_direct_fetch.js` — requires a real local `.env` with Supabase credentials (reads `../.env`; only `.env.example` ships in the repo), so it hangs without them
  - `test_init_schedule_resilience.js` — hits a Node DOM-mock gap (`toast.js:48` `addEventListener` on null) and then hangs on dangling handles; needs a fuller DOM mock

### Critical DOM IDs & UI Constraints

JavaScript modules query specific DOM elements by ID — renaming an ID silently breaks event listeners and update cycles (and anything deep-linking or bridged to native code that depends on exact IDs). Markup structure and CSS classes can be redesigned freely, but **DOM element IDs must be preserved**:

- `clockTrigger`, `cc`, `cT`, `cR`, `cBar`, `nc`, `nT`, `chG`, `prevDayBtn`, `nextDayBtn`, `findTeacherFab`, `freeRoomsFab`

Other hard boundaries:

- **Android Widget Independence:** Android widgets are rendered via native Java XML (`android-custom/res/layout/`). Web CSS changes will not break them as long as `build.js` remains intact.
- **State & Logic Separation:** All logic modules in `src/dashboard/`, `src/timeline/`, `src/rooms/`, and `src/teachers/` read from `State` and output structured HTML templates. The HTML strings they render can be styled to match any new design language.
- **Mobile WebView Safe Areas:** Must always maintain `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` so buttons and headers never get clipped by device camera notches or home gesture bars.

---

## Design System

Do not deviate without explicit user approval.

- **Light theme:** `#F7F4EB` / `#FAF7F0` (intentionally warmed ivory) + Cobalt Ultramarine `#2563EB`
- **Dark theme:** `#18191E` / `#23252C` + Luminescent Sky `#38BDF8`
- **Fonts:** Plus Jakarta Sans (UI), JetBrains Mono (times/metrics)
- **Icon badges:** squircle — 42×42px, `border-radius: 13px` (NOT `clip-path`)
- **No glassmorphism / glow / backdrop-filter anywhere** — recurring regression
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

## Current State (Sep 23, 2026)

### Stable and confirmed
- Core redesign: dashboard, class detail sheet, faculty profile, apps hub nav — all full-page conversions
- Announcements system: 8-type system, all known bugs fixed
- Faculty data in Supabase: 42 CSE + 51 stub rows, RLS configured, approval-queue workflow active
- Free Rooms Stages 1 & 2: full rebuild, announcement override sync working, on-device tested
- Schedule Supabase migration: 518 sessions seeded, 3-tier consumers migrated, offline fallbacks simulation-verified

### Needs on-device verification
The schedule migration (`9ba2156`, Aug 31 2026) was committed and pushed but **has not yet been physically tested on the user's phone**. This is the immediate next action — have the user push (if not done) and test:
- Dashboard loads correct routine from Supabase
- Teacher Finder loads
- Free Rooms loads
- **Airplane mode test:** confirm offline fallback works on a real device

### Backlog

1. Holiday date-range picker: end date should default to day-after start date
2. Week-strip/timeline multi-override icons: show up to 3 + "3+" badge (currently only shows first)
3. Calendar month-view color priority: only `class_test` and `assignment` get background coloring; explicit priority order when multiple types land on same day
4. Past announcements: stop showing once their date has passed
5. 6pm schedule rollover: after 6pm, show tomorrow's schedule; update greeting and day-header accordingly
6. Announcement icon overflow: cap visible icons at ~5, collapse rest behind a "+N" circular button (WhatsApp chip-row pattern)
7. Routine Matrix + Schedule Settings: need same full-page conversion as Faculty/Announcements/Free Rooms
8. Real Android/Gradle APK build: never verified end-to-end
9. Class-start/pre-class briefing notifications: rebuild from scratch (old scaffolding intentionally removed — do NOT restore from git)
10. Free Rooms polish:
    - Lab room header should lead with room number: `"503 (Microprocessor & Multimedia Lab)"`
    - Verify "No Class Scheduled" copy is consistent
    - Class-card tap opens instructor profile instead of class-detail — needs proper fix (prior attempt failed)
11. Schedule admin/edit flow: build an admin-facing UI to edit schedule data without requiring a re-seed

---

## Suggested First Steps for a New Agent

1. Run `git log --oneline -15` and `git status` — confirm actual repo state.
2. Ask the user if the `9ba2156` push + Vercel deployment is done and device-tested. If not, that's the only immediate priority.
3. Once device test is confirmed, ask which backlog item to tackle next.
4. Before touching the overrides system, re-read the Architecture section above — it has a history of subtle regressions.
