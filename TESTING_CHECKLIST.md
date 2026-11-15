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
