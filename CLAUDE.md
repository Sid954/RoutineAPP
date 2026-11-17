# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `PROJECT_OVERVIEW.md` first.** It is the full agent briefing: standing rules, architecture, design system, current state, and backlog. This file is a condensed entry point and does not replace it.

## What this is

A university class-schedule app for CSE students. It is a vanilla ES-module web app (no framework, no bundler) that ships three ways: as a PWA, as an Android APK via Capacitor, and with a Vercel serverless API in `api/` backed by Supabase Postgres. Native Android home-screen widgets are written in Java.

## Commands

```bash
npm install
npm run build          # node build.js: compiles src/ + root assets into www/ (what actually ships)
npm run sync           # build + npx cap sync (needed before Android Studio / Gradle)
npm test               # node tests/run.js: runs every tests/test_*.js, 60s timeout each
node tests/test_room_overrides.js   # run a single test file (run it from the repo root)
npx cap open android   # open in Android Studio to build an APK
node scripts/seed-schedule.js --dry-run   # Supabase schedule seeder (needs .env)
node build.js --scrape-faculty            # optional faculty scrape during build (needs .env)
```

- There is no linter or type checker.
- Tests are plain Node scripts using `assert`. They `require()` the ES-module files in `src/` directly and mock `global.window`, so keep `src/` logic modules importable without a DOM.
- `test_direct_fetch.js` needs a real `.env` with Supabase credentials. The other suites only need `npm install`, because most API tests `require('@supabase/supabase-js')`. On-device checks that are still pending are tracked in `TESTING_CHECKLIST.md`.
- Environment variables are listed in `.env.example`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `ADMIN_PASSWORD`, `ANNOUNCEMENT_PASSWORD` and the `FIREBASE_*` variables. Scripts load `.env` through `scripts/_load_env.js` or their own inline loader.

## Build pipeline (`build.js`): edit sources, not outputs

- **Edit `src/`, the root `index.html`, `sw.js` and so on. Never edit `www/`.** The build wipes and regenerates `www/` every time. `www/` is gitignored and untracked (the last stale copies were removed from git on 2026-11-17). Vercel and CI both build it themselves.
- **Android native code lives in `android-custom/`** (Java widgets, `res/`, `AndroidManifest.xml`). The build copies it over `android/app/src/main/`, so edits made directly under `android/app/src/main/` get overwritten.
- `version.json` is the single source of truth for the app version. The build writes `versionCode`/`versionName` into `android/app/build.gradle` and into `appVersionCode`/`appVersionName` in `src/core/config.js`. It also stamps a fresh `CACHE_VERSION` into both `sw.js` files.
- The build regenerates `master_rooms_schedule.json` and `master_teachers_schedule.json` from `src/data/sem-*/<section>/routine.json`. These files are the offline fallbacks.
- CI (`.github/workflows/build-apk.yml`) runs on every push to `main` (Node 22, JDK 21). It builds a release APK signed with the keystore from GitHub secrets and publishes it to the GitHub release `v<versionName>`, reading the version from `version.json`. Without the keystore secrets it builds a debug APK as a workflow artifact only and publishes nothing.
- Vercel serves `www/` as static output plus `api/*.js` as functions, and runs a weekly cron at `/api/cron/sync-faculty`. **A change to `api/` takes effect only after a commit, a push and a Vercel deploy.**

## Architecture (big picture)

- **Entry:** `index.html` → `src/main.js`. The boot sequence is in `src/events/init.js`: render the cached schedule right away, fetch fresh data, apply announcement overrides, then poll announcements every 30s and cascade a refresh to every view. Global state is in `src/core/state.js`, and constants and `defaultRoutine` are in `src/core/config.js`.
- **Schedule data has three tiers, each with an offline fallback:** network (`api/schedule.js?action=...`) → localStorage cache → bundled JSON. This holds for the core routine (`src/data/sem-X/Y/routine.json`, then `CONFIG.defaultRoutine`), for the rooms engine (`master_rooms_schedule.json`) and for teacher finder (`master_teachers_schedule.json`). In Supabase, times are stored as integer minutes from midnight. Day index is the JS convention: 0 = Sunday.
- **Overrides:** announcements are fetched department-wide and change the live routine. All student-facing views must read through `getEffectiveClassesForDay()` in `src/schedule/queries.js`. Room occupancy reads through `getEffectiveRoomClasses()` in `src/rooms/room-overrides.js`. Two rules here must not be reverted:
  - Overrides **flag** classes (`isCancelled` and similar) instead of removing them.
  - Subject matching (`isSubjMatch`) is **exact `===`**, never substring.
- **Widgets:** the Java `AppWidgetProvider`s in `android-custom/java/com/routine/app/` include `RoutineScheduleEngine`. `WidgetPlugin.java` bridges them to the web layer. Web CSS changes do not affect them.
- **API auth and secrets:** every password check goes through `checkPassword()` in `api/_lib/security.js`, which compares in constant time, throttles by IP and fails closed. Never add hardcoded fallback passwords. Photo uploads go through `api/_lib/photo-upload.js`.
- **Push and signing:** FCM tokens live in the `device_tokens` table. `NativePush.init()` checks `WidgetPlugin.isFirebaseConfigured()` before calling `register()`, because builds without `google-services.json` would otherwise crash. Release APKs must always be signed with the same keystore (CI gets it from GitHub secrets, and the local copy sits in the gitignored `secrets/` folder), or Android refuses to install updates.
- **DOM IDs are a contract.** JS and native code look up elements by ID, including `cc`, `cT`, `cR`, `cBar`, `nc`, `nT`, `chG`, `prevDayBtn`, `nextDayBtn`, `vcC` and `ecC` (`clockTrigger`, `findTeacherFab` and `freeRoomsFab` no longer exist). Restyle freely, but never rename these IDs.

## Standing rules (from PROJECT_OVERVIEW.md, enforced by the user)

- Ask before committing or pushing, and ask before running build, screenshot or browser-automation scripts.
- Never say something is "fixed" without real evidence. Acceptable evidence is test or script output against real data, or the user confirming it on their phone. The user tests major changes on a physical device.
- When restoring a drifted component, copy the exact values from the last known-good source (git history or the live file), never from memory. Trust the live file and `git diff` over commit messages.
- Notifications were rebuilt on 2026-11-17 (see "Notifications" in PROJECT_OVERVIEW.md). Plan alerts only through `src/notifications/planner.js`, which is pure and tested. Never add another scheduler, and never restore the old pre-November reminder or briefing code from git.
- UI rules:
  - Use SVG icons only, never emoji.
  - No glassmorphism or glow, and no `backdrop-filter` at all. The popup-backdrop blur was tried and removed again on 2026-11-17 because the app felt laggy on the user's 90 Hz phone. Popups use a plain strong dim.
  - Performance (user, 2026-11-17: "make everything buttery smooth"):
    - Never loop an animation on a property the GPU can't run (`background-position`, `box-shadow`, `width`/`height`, or keyframes containing `var()`), because it repaints on every frame. Animate `transform` and `opacity` only.
    - Decorative loops pause when hidden or covered (motion-plus.css §25).
    - Re-render lists with `setHtmlIfChanged()` (src/core/utils.js), and bind handlers only when it returns true.
    - Don't force layout (`void el.offsetWidth`, scroll right after showing a page). Restart animations with `el.animate()`.
  - Calm motion only (user, 2026-11-17: "remove every jump"). No overshoot or spring easings, and no bounce, pop, rise, tilt or shake. Content appears by fading. Only objects that physically move (bottom sheets, the week-strip morph, the live water fill) travel, and they decelerate without overshoot. Use `--mx-ease` (`cubic-bezier(0.2, 0, 0, 1)`).
  - Exactly two themes, light and dark. Palettes are listed in PROJECT_OVERVIEW.md.
  - Keep the `env(safe-area-inset-*)` padding.
- If you spot a secret in plaintext, flag it.
