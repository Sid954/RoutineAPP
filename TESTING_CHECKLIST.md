# On-Device Testing Checklist

Pending hands-on verification of the fixes pushed on 2026-11-16 (commits `ec80b9b`…`b3c9fc8`).
Tick each box only after confirming it on a real phone. Unit and mock tests already pass, but they can't check real-device behaviour.

## 0. Install the signed build
- [ ] Uninstall the old app. This is required once because the signing key changed.
- [ ] Download `app-release.apk` from the GitHub release `v1.5.0` and install it.
- [ ] The app opens without crashing, and the dashboard shows your own semester and section.

## 1. Auto-update no longer overwrites the routine
- [ ] Open the app online and wait at least 10 seconds for the background update check.
- [ ] The routine is still your own section, not a different one.
- [ ] Close and reopen the app in airplane mode. The routine is still correct (served from cache).
- [ ] Faculty photos still show offline after an update.

## 2. Push notifications
- [ ] Allow notifications when asked, or allow them from the banner.
- [ ] In Supabase, open table `device_tokens`. A row exists for your phone with the correct `semester` and `section`.
- [ ] Post a test announcement for your own semester and section. The push arrives with the app closed.
- [ ] Post one for a different section. You do not receive it.
- [ ] Change your section in settings and reopen the app. The `device_tokens` row shows the new section.
- [ ] In the Vercel logs for `/api/announcements`, look for "Section FCM Notifications sent … Successes: N".

## 3. Security changes (Vercel)
- [ ] Posting, editing, pinning and deleting an announcement all work with the correct password.
- [ ] A wrong password shows an error, and after 10 wrong tries you get the "Too many failed password attempts" error.
- [ ] Admin moderation panel: loading pending faculty suggestions works with the admin password.
- [ ] Faculty edit suggestion with a photo upload still works.
- [ ] Vercel: `CRON_SECRET` is set. After the next Friday 03:00 UTC run, the `/api/cron/sync-faculty` logs show success, not 503.

## 4. Release update flow
- [ ] Bump `versionCode` to 11 and `versionName` to `1.5.1` in `version.json`, then push. CI publishes release `v1.5.1`.
- [ ] Open the app on version 1.5.0. The "New Version Available" prompt appears.
- [ ] Tap Install. The APK installs over the existing app without an "App not installed" error, and your data is kept.

## 5. Changes in the follow-up batch (see git log after `b3c9fc8`)
- [ ] Home-screen widget: cancel a class through an announcement, close the app, and wait for the widget to refresh. The class shows as cancelled or is skipped instead of appearing as normal.
- [ ] Slow or no network: the app falls back to the cached or bundled routine within about 8 seconds instead of hanging.
- [ ] Between midnight and 6am, the announcement post form defaults to today's date, not yesterday's.

## 6. Batch 3 (CI tests, section list, limits)
- [ ] GitHub Actions: the "Run Tests" step passes before the APK build.
- [ ] Settings: the semester and section dropdowns list the same sections as the Supabase `sections` table. A newly added section appears without an app update.
- [ ] Settings offline: the dropdowns still load (cached or bundled list).
- [ ] Post form, multi-day holiday: the end date defaults to the day after the start, and changing the start moves the end forward.
- [ ] The announcements feed still shows pinned items first (the API now returns at most 300).

## 7. Batch 4 (past announcements, 6pm rollover)
- [ ] Announcements feed: dated announcements from before today are hidden, and pinned ones stay. "Show N past announcements" at the bottom reveals them, and "Hide" collapses them.
- [ ] The unread badge no longer counts past-dated announcements.
- [ ] After 6pm, once today's classes are done, opening the app shows "Tomorrow's Schedule" and the next-class card shows tomorrow's first class with a "Tomorrow" badge.
- [ ] Before 6pm, or while a late class is still running, it stays on today.
- [ ] After 6pm, swiping to another day isn't overridden when you leave and come back to the app.
- [ ] Holiday day card shows a calendar SVG icon, not an emoji.

## 8. Batch 5 (override indicators)
- [ ] Week strip: a day with 2–3 different override types (e.g. class test + assignment) shows that many small corner icons, overlapping, with the most important on the right.
- [ ] A day with 4 or more types shows 2 icons and a "+N" chip, and the stack doesn't spill outside the pill on a narrow phone.
- [ ] Calendar month view: only class-test (orange) and assignment (purple) days get a tinted background. Class test wins when both fall on the same day. Holidays, cancellations and online classes show only dots and a coloured number.
- [ ] Calendar dots: up to 3 per day, without the glow.
- [ ] Check both light and dark themes.

## 9. Batch 6 (Free Rooms polish)
- [ ] Free Rooms → open a room → tap a class card (not the teacher pill). The class detail sheet opens, not the instructor profile. Try this 5 or more times on cards at different heights. (A guard for an unconfirmed ghost-tap cause; if it still happens, note which card and where you tapped.)
- [ ] Tapping the teacher pill on a card still opens the instructor profile.
- [ ] In the class detail sheet, the Instructor and Room tiles still work when tapped normally (after about half a second).
- [ ] Empty states: a free room reads "No classes scheduled" on both the room card and its schedule sheet, including for a custom future day.
- [ ] Lab rooms: card and sheet headers lead with the number, e.g. "503 (Microprocessor & Multimedia Lab)". This was already in the code; just confirm it.

## 10. Batch 7 (v1.5.1: name, full pages, UI rule sweep)
- [ ] Settings: enter your name in "Your Name" and tap Save. The greeting shows it. With an empty name it shows "Student".
- [ ] First launch (clear app data): the welcome screen has a name field, and the semester/section list matches Supabase.
- [ ] Weekly Routine opens as a full page with a "Back" button and title, covering the screen edge to edge with safe-area padding. The rotate button still rotates to landscape and back.
- [ ] Schedule Settings opens as a full page titled "Schedule Settings"; Back closes it. All settings still save.
- [ ] Emoji are gone from labels and buttons (settings, welcome screen, Android app modal, banners, toasts). Icons render as SVG in both themes.
- [ ] Toasts: success, error, warning and info each show a coloured SVG icon. A plain toast shows no icon box.
- [ ] Welcome and confirm dialogs: dark backdrop, no blur. The notification banner has no glow.
- [ ] Release: after pushing, CI publishes `v1.5.1` and the app on 1.5.0 offers the update (it needs a reinstall once because of the signing-key change).
