# Handoff: continue RoutineAPP in a new session (written 2026-11-17)

Paste this into the new session, or tell it: **"Read CLAUDE.md, PROJECT_OVERVIEW.md and HANDOFF.md first, then continue."**
CLAUDE.md and PROJECT_OVERVIEW.md hold the standing rules. This file only says where things stand right now.

## Get in sync
- Branch: `main-2cmtj2`. It is identical to `main` at `e89384f` (v1.5.11, versionCode 21).
  ```bash
  git fetch origin && git checkout main-2cmtj2 && git pull && npm install
  ```
- Release v1.5.11 is **published**. GitHub Actions "Build & Release Android APK" succeeded, and release `v1.5.11` has `app-release.apk`. CI signs releases with the keystore from GitHub secrets.
- To build signed APKs locally, copy the gitignored `secrets/` folder from the old PC yourself. Never paste secrets in chat.

## What changed in v1.5.11 (performance pass, user: "laggy on my 90 Hz phone")
- **Popup backdrop blur removed for good.** Popups use a plain strong dim. CLAUDE.md now says "no `backdrop-filter` at all".
- **Nothing repaints at idle any more.** Headless Chrome A/B over CDP, CPU slowed 4×, 390×844 @ 2.75×:

  | Measurement | Before | After |
  |---|---|---|
  | Home idle, repaints in 3 s | 724 | 0 |
  | Sheet open, repaints | 475 | 0 |
  | Opening Faculty, style work | 481 ms | 104 ms |

- **Main fixes:**
  - The greeting tint is static now; it was an endless `background-position` animation.
  - The clock minute line runs through the Web Animations API. It used `var()` inside keyframes, which can't run on the GPU.
  - The hidden loading spinner was turning forever; it's stopped.
  - Decorative loops pause when Home is hidden or covered (`motion-plus.css` §25).
  - Closed sheets get `visibility: hidden`.
  - `setHtmlIfChanged()` in `src/core/utils.js` is used by Faculty, Rooms, Notices and the Weekly Routine. Bind handlers only when it returns true.
  - List fades animate the container once with `el.animate()`.
  - `content-visibility: auto` on long lists.
  - No forced layout on page switches.
  - Press and ripple only fire on real taps (70 ms or 8 px).
- **The rules for not breaking this again** are in CLAUDE.md ("Performance") and PROJECT_OVERVIEW.md ("Performance rules").

## Waiting on the user
- **Phone checks:** `TESTING_CHECKLIST.md` §22 (v1.5.8–v1.5.10) and §23 (v1.5.11 smoothness). Nothing from v1.5.8 on is confirmed on the phone yet. Don't call anything "fixed" without the user's confirmation or real measurements.
- **NEXT_TASKS.md item 17** (community suggestions without a password, duplicate detection, pending posts, voting) needs the user's API and Supabase design decisions. Ask before starting.
- **Temporary test clock** (the "Test time" tab on every page) must be removed before the app goes public, but **only when the user says testing is done**. The removal list is in NEXT_TASKS.md:
  - the head script in `index.html`
  - `src/settings/test-time.js` and its init in `src/main.js`
  - the CSS block at the end of `src/settings/settings.css`
  - the `window.__devTimeOffset` guard in `scheduleForToday` (`notifications.js`)
- **GitHub token for the private repo:** a fine-grained token, Contents read-only, goes ONLY into the Vercel env var `GITHUB_TOKEN`.
- `secrets/github-secrets.txt` is a plaintext copy of the CI secrets on the old PC (gitignored). Deleting it is the user's call.

## Incident on 2026-11-17 (old PC only, nothing lost)
- **What happened:** on the user's Windows PC, about 20 project files, git's main pack file, 7 git objects and parts of `node_modules` were found wiped to 0 bytes. The likely cause is an unclean shutdown or crash before writes were flushed. The user may want to run `chkdsk` on drive D:.
- **The repair:**
  - git objects restored from a fresh GitHub clone; `git fsck --full` is clean
  - files restored from the last commit
  - `npm ci`
- **If something odd shows up on that PC** (empty files, git "packfile too short"), check for 0-byte files first:
  ```bash
  find . -path ./node_modules -prune -o -path ./.git -prune -o -type f -size 0 -print
  ```

## Release recipe (only when the user says "release")
1. Commit the feature work. Run `npm test` first (21 suites must pass).
2. Bump `version.json`: `versionCode` +1, `versionName`, `releaseNotes`.
3. Run `npm run build`, which stamps `android/app/build.gradle` and `src/core/config.js`.
4. Write `RELEASE_NOTES.md` in plain user language.
5. Revert everything else the build touched (tracked files only):
   - `sw.js`, `master_*.json`
   - the Android files except `build.gradle`
   - `www/` is untracked since 2026-11-17, so it needs nothing.
6. Delete the untracked Java files copied from `android-custom/`: `AppUpdaterPlugin`, `WidgetData`, `WidgetNow`, `WidgetUpdateReceiver`, `WidgetUpdater`.
7. Commit `chore(release): vX.Y.Z (versionCode N)`. It contains only `RELEASE_NOTES.md`, `build.gradle`, `config.js` and `version.json`.
8. Push `main-2cmtj2`, then fast-forward `main`:
   ```bash
   git push origin HEAD:main
   ```
   Pushing to `main` starts the signed release build.

## Working rules (short)
- Edit `src/` and root files, never `www/`. Native Android code goes in `android-custom/`.
- Ask before committing, pushing or releasing.
- Keep the user's ORIGINAL Home design. No redesigns without asking.
- SVG icons only, two themes, keep the safe-area padding, and DOM IDs are a contract.
- Calm motion: only `--mx-ease`, no bounce or pop, content fades.
