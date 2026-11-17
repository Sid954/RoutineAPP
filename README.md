# My Routine — class schedule app for CSE students

**My Routine** (RoutineAPP) is a university timetable app: a PWA, an Android app (Capacitor) with native home-screen widgets, and a Vercel API backed by Supabase. Current version: **1.5.12** (see `version.json`).

Working on the code? Read `CLAUDE.md` and `PROJECT_OVERVIEW.md` first. Phone checks live in `TESTING_CHECKLIST.md`, and `HANDOFF.md` says where things stand right now.

## Features

- **Home:**
  - the live class card fills sideways as the class runs
  - a week strip, the day's timeline with breaks, and a "next class" countdown
  - cancellations, tests, online and moved classes flagged in place
- **Weekly Routine:** the full week as a grid (wide screens) or day tabs (phones).
- **Rooms:** which classrooms and labs are free now or at any time this week, plus each room's day and timeline.
- **Faculty:** the department directory with live "in class / free" status, profiles, schedules and contact details.
- **Notices:** posts for one section, a semester or everyone (cancellations, holidays, tests, online classes, moved classes, assignments). They change the routine automatically, and come with calendar export and sharing.
- **Notifications:**
  - class reminders, test and deadline alerts
  - morning summary and tomorrow preview
  - quick pause, skip a class, weekdays, quiet hours, and per-type notice alerts
  - all planned a week ahead, so they arrive with the app closed
- **Widgets:** live class, week and day widgets. They update on their own, without opening the app.
- **Settings:** your class, name, light/dark theme, animations, off days, your own class edits, and in-app updates (the APK is downloaded, checksum-verified and installed in the app).

## Tech stack

- **App:** vanilla ES modules, HTML and CSS (no framework, no bundler). `build.js` compiles `src/` into `www/`.
- **Android:** Capacitor 8; Java widgets and plugins in `android-custom/` (copied into `android/` at build time).
- **API:** Vercel serverless functions in `api/`.
- **Data:** Supabase Postgres (schedule, announcements, faculty, device tokens).
- **Push:** Firebase Cloud Messaging.

## Commands

```bash
npm install
npm run build          # src/ + root assets -> www/ (what ships)
npm run sync           # build + npx cap sync (before Android Studio / Gradle)
npm test               # every tests/test_*.js (23 suites)
npx cap open android   # open in Android Studio
```

## Releases

Releases are built and signed by GitHub Actions on every push to `main` (`.github/workflows/build-apk.yml`). The version comes from `version.json`, and the APK is published to the GitHub release `v<versionName>`. The app finds updates through `/api/app-update`.

The full release steps are in `CLAUDE.md` ("Releasing"). Always sign with the same keystore (CI uses GitHub secrets), or Android refuses to install the update.

## Database

The SQL lives in the repo root:
- `supabase_schema.sql`: announcements, device tokens and teacher names
- `supabase_schedule_schema.sql`: the schedule tables
- `supabase_faculty_members.sql`: the faculty table
- `supabase_notification_prefs.sql`: per-device notice preferences

Environment variables are listed in `.env.example`. Never commit secrets.
