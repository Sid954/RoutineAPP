# On-Device Testing Checklist

Pending hands-on verification of the fixes pushed on 2026-11-16 (commits `ec80b9b`…`b3c9fc8`).
Tick each box only after confirming it on a real phone. Unit and mock tests already pass, but they can't check real-device behaviour.

## 0. Install the signed build
> Device test run 2026-11-16 found: (1) settings save stuck on "Step 2/2" (fixed), (2) **production API returning 500 "TypeError: fetch failed" because Vercel cannot reach Supabase** (needs the Supabase project checked; the API now fails fast instead of hanging 7–14s), (3) unstyled name inputs and clipped long toasts (fixed).
- [x] Uninstall the old app. This is required once because the signing key changed. *(2026-11-16, Redmi 23030RAC7Y / Android 16: installing over 1.5.0 was refused with INSTALL_FAILED_UPDATE_INCOMPATIBLE, as expected. v1.5.0 data was backed up first.)*
- [x] Download `app-release.apk` from the GitHub release and install it. *(v1.5.1 / code 11; signer SHA-256 4d6fb81a…bfb042 matches the release keystore.)*
- [x] The app opens without crashing *(no FATAL in logcat; welcome screen showed the SVG icon and name field)*. The dashboard showed 2nd Semester – Section C from the bundled fallback, because the API was down at the time.

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

---

## PC browser run (2026-11-16): web layer verified without the phone
Ran the app in the desktop built-in browser at phone size (375×812), against a local mock server: the real app files plus a fake API with fixture announcements, and a clock shift for the 6pm test. These checks **passed**:
- Welcome screen: SVG icon, styled name field, "1."/"2." labels. Saving puts the name in the greeting ("Sid").
- **Stuck-save fix:** with every API call hanging (simulated outage), saving still finished in about 9s, reloaded, applied Section B from the bundled routine, and kept the name. No "Step 2/2" hang.
- Week strip badges: Fri past cancellation; Mon cancellation; Tue `class_test`, `rescheduled`, `+2`; Wed `holiday`, `rescheduled`.
- Calendar: only the class-test day tinted; holiday shows dots and an amber number without a tint; at most 3 dots per day.
- Notices: past-dated cancellation hidden behind "Show 1 past announcement"; toggle shows and hides it; pinned item stays.
- 6pm rollover at 7:00 PM: "Tomorrow's Schedule", Tuesday selected, next-class card "DMNT · Tomorrow · 408".
- Strip and header counts agree (fixed in this run: the header used to count the raw routine, e.g. "2 SESSIONS" vs "1 CLASS").
- Weekly Routine and Schedule Settings open as full pages with Back; Settings name field is pre-filled.
- Long warning toast wraps within the screen, with an amber SVG icon.
- Android web prompt: no longer stacks on the welcome screen, and stays dismissed for the session after "Continue on Web" (fixed in this run).
- Free Rooms: a class-card tap opens class details (ICMP); a simulated ghost tap on the Instructor tile within 450ms is ignored; a deliberate tap opens the profile.
- Light theme: dashboard, badges and teacher sheet render correctly.

**Still needs the phone:** push notifications (and the live Supabase), the home-screen widget, the APK update prompt and install, the real-touch ghost-tap behaviour, and the rotate button on the routine page.

## 11. Design pass (motion + layout): check on the phone
Verified in the PC browser at 375×812 in both themes. Still check on a real device:
- [ ] Equal left/right margins on every page. The week strip shows all 7 days with badges uncut.
- [ ] Page changes slide (deeper = from the right, back = from the left), and dock tabs rise in. Nothing feels laggy on the phone.
- [ ] Weekly Routine / Settings slide in and out. While Weekly Routine is open, the dock highlights "Routine".
- [ ] Tapping another day in the week strip: the tapped day expands into the big card while the previous one collapses into a pill, and the schedule below cross-fades. Swiping still works as before.
- [ ] Live class card shows a thin progress bar along its bottom edge.
- [ ] Notices: no PINNED/NEW chips; unread = accent dot before the title; dates read "Today / Tomorrow / Wed 18 Nov".
- [ ] Free Rooms: lab names on a second line (no overlap with status); filter pills not cut off.
- [ ] Light mode: cancelled badge, exam/online tags and Weekly Routine cards are all readable.
- [ ] Switching theme in Settings cross-fades instead of flashing.
- [ ] With Android "Remove animations" turned on, the app still works with no motion.
- [ ] Home spacing: clear gaps between clock, greeting, week strip and "Today's Schedule". The live class card is full height (not a thin sliver), and at least 3 class cards fit on screen. Tags like "CT-2" never break across lines.

## Device run 2026-11-17 (in progress)
- [x] Live API back: `semesters_sections` and `announcements` return 200 in 2–3s. The deployed CORS uses the shared helper (`*` origin, no credentials header).
- [x] Live data: 16 announcements for Semester 2, Section C, all dated before today. Notices should show "Show 16 past announcements" with nothing current.
- Found: the installed app rotates into landscape, where no class cards are visible. **Fixed in code:** MainActivity is locked to portrait (needs the next APK).
- Found: "Good night" showed a sun icon. **Fixed:** the icon follows the time of day (sun, sunset, moon).
- [x] New design in the phone's Chrome (adb reverse to the mock server; frame timing measured through Chrome remote debugging, 90 Hz display):
  - Day expand/collapse, page transitions and the Routine page all hold an 11.1 ms median frame. 1–6 dropped frames at the start of each, during the content re-render; Notices is the heaviest (it re-renders the feed on open).
  - Home spacing, gutters, live progress bar and light-mode Weekly Routine look right on the real screen.
- [x] **Free Rooms real-touch:** 4/4 finger taps on class cards (subject, time, duration, empty area) opened class details; 0 opened the profile. Tapping the teacher pill opens the profile.
- [x] Installed v1.5.1 with live data: Notices shows "Show 16 past announcements" and no unread dot.
- Found and **fixed:** in the native app the notification banner never showed (isSupported() checked only the web Notification API, and maybeShowBanner() was never called; the settings button for the toggle doesn't exist in the HTML). So the APK never asked for notification permission, and push could not register. Needs the next APK, then: allow notifications, check a `device_tokens` row, and post a test announcement.
- Found and **fixed:** the install banner covered the dock; it now sits above it.
- Found and **fixed:** up to three prompts appeared at once (notifications, Android app, install). They now show one at a time.
- Changed: the notification banner's Enable button no longer switches on class-start reminders (backlog #9); it only enables announcement push. The banner text now says that.

## 12. Light mode redesign ("Printed Timetable")
- [ ] Light mode: cool grey-white page, white cards with thin borders, dark navy text. The selected day and the live class stand out in cobalt.
- [ ] Readable outdoors in sunlight: muted text, tags, Free Rooms status, Faculty codes. (All passed an automated WCAG AA check on PC.)
- [ ] Post Announcement: every field has the same grey-inset look and turns white with a blue ring when tapped.
- [ ] Switching between light and dark in Settings cross-fades smoothly. Dark mode is unchanged, apart from class end times, which are now slightly brighter.

## 13. Rooms redesign (replaces Free Rooms)
- [ ] Apps → Rooms opens on today in live mode ("Now · time", green dot). The subtitle reads "X of 33 free right now", and the list shows free rooms grouped by floor.
- [ ] Each room card shows its status on the right (Free all day / Free until X / Free in Xm / Busy until X) and a day strip below it: grey = class, green = the free window from the chosen time, blue tick = the chosen time.
- [ ] Dragging the time slider moves through the class day (8 AM to 4:30 PM). The readout, counts and list update as you drag, and "Now" brings it back to live time.
- [ ] Free / Soon / All buttons filter the list and their counts are correct. Search ("40", "lab", a room name) and Rooms/Labs narrow it further; the "×" clears the search.
- [ ] Day chips: Thu/Fri are dimmed (off days) and show every room free. Another weekday keeps the chosen time.
- [ ] Tapping a room opens its sheet: status box, day chips, a large strip, then a timeline of classes and free gaps. Cancelled, moved-online and rescheduled classes appear struck through with a reason tag.
- [ ] In the sheet, tapping a class opens class details and tapping the teacher opens their profile. The sheet closes on × and by tapping the backdrop. (The Android back button is not wired anywhere in the app yet, so it will not close the sheet.)
- [ ] In class details, tapping the room tile opens Rooms on that day with that room's sheet open. Back reads "Home" if you came from Home and "Apps" otherwise, and goes there.
- [ ] Check both themes. Light mode was checked on PC at 390×844, and the search field has no white box inside it.

## 14. Dock closes open pages
- [ ] Open Schedule Settings, then tap each dock button (Home, Routine, centre, Notices, Apps). Settings closes and you land on that tab; Routine opens the Weekly Routine instead.
- [ ] Same with the Weekly Routine (Matrix) open: Home, Notices, Apps and the centre button all close it, and the right dock tab is highlighted afterwards.
- [ ] With Settings open on Home, the centre button closes Settings and does not pop up the calendar.
- [ ] In the Weekly Routine, open a class, then tap its room. Rooms opens with that room's sheet, and the Weekly Routine is no longer underneath.

## 15. Settings rebuild
- [ ] Typing a name saves after a short pause ("Saved" under the field) and the Home greeting updates. No reload happens.
- [ ] Changing semester or section shows the "Switch to Semester X · Section Y" bar. Undo puts the selects back; Switch downloads that routine and reloads.
- [ ] Appearance: the Light and Dark cards switch the theme at once.
- [ ] Edit classes: day chips show per-day counts. Remove a class and its toast Undo brings it back. Add a class; it lands on the chosen day in time order.
- [ ] "Clear [day]" and "Restore official routine" both offer Undo. Restore loads YOUR section's routine (not the bundled default).
- [ ] App: Check for updates works; Offline data shows the cache date and Online/Offline.

## 16. Faculty directory rebuild
- [ ] Apps → Faculty: the subtitle reads "N people · M in class now" on a class day. Rows are grouped A–Z, and code-only teachers sit under "Other instructors" at the end.
- [ ] Each row shows a live status line: green "In class · Room X · until …", "Next at … · Room X", "Done for today" or "No classes today". Thu/Fri show no status lines.
- [ ] Filter chips: All / My teachers (your routine's teachers) / In class / Today. Counts match the list. "In class" and "Today" are hidden on Thu/Fri.
- [ ] Search finds by name, code, course code or title ("data structure"), and room ("905"). The × clears it.
- [ ] Tap a teacher to open the profile sheet: photo or initials, name, code, designation, and the "now" card (In class with progress bar / Free now, next … / Done / Off today, next class …).
- [ ] Email / Call / Profile open mail, the dialer and the browser. Missing ones are faded with "Not added", plus a "Suggest it" link.
- [ ] Schedule: day chips with counts (today has a dot) plus Week. Rows show time, course, LAB tag, room, section. A class cancelled today by an announcement is struck through with a "Cancelled" tag and the now card does not count it.
- [ ] Tapping a schedule row opens class details on top. Its teacher tile goes back to the profile.
- [ ] The pencil (top of sheet) opens "Suggest an edit" ON TOP of the profile, with the teacher locked in. Inputs are readable in light mode.
- [ ] The shield button → admin password → pending edits list still approves and rejects.
- [ ] Teacher names tapped anywhere else (Home cards, Weekly Routine, Rooms sheet) still open the new profile.
- [ ] Check both themes.

## 17. Notices rebuild
- [ ] Notices opens with "My section" selected. The subtitle reads "Semester X · Section Y". Department shows every section's notices, each tagged with who it is for (e.g. "3-A", "Sem 2 · all", "Everyone").
- [ ] "Coming up" shows dated items for the next two weeks as cards with a countdown ("Today", "Tomorrow", "in 3 days"). A multi-day holiday appears once. Tapping a card opens the notice.
- [ ] Search finds by course, title, author, room or link ("meet"). Filter chips show counts and only types that exist. Coming up hides while searching or filtering.
- [ ] Feed sections: Pinned, Today, Tomorrow, This week, Later, Notices (undated), then "Show N past".
- [ ] New notices show a dot. "N new notices · Mark all read" clears them, and so does scrolling past a card for about a second. The dock dot updates.
- [ ] Tapping a notice opens the sheet: type, audience, title, date with countdown, a facts grid, text, a green "Join class" button for links, and Posted by.
- [ ] Sheet actions: Calendar (APK: opens Google Calendar with the event filled in; browser: downloads an .ics), In routine (jumps Home to that date), Share (share sheet, or copies text).
- [ ] Manage: enter the password, then a banner shows. In a notice: Pin/Unpin, Edit and Delete work. Done exits.
- [ ] Post: the 7 type tiles switch the fields. The live preview matches the feed card, and errors show under the preview.
- [ ] Audience: My section / Other sections (several chips) / Whole semester / Everyone. Class-tied types (cancel, class, test, reschedule, assignment) allow only one section and load THAT section's course list.
- [ ] Posting to 3 sections says "Publish to 3 sections", and each section sees it. A multi-day holiday to several sections posts every day for every section.
- [ ] Online/extra class: the end time and teacher are saved. Picking a course fills its usual start time, end time and teacher.
- [ ] Editing a department-wide or another section's notice keeps its audience (it used to switch to your own section). The audience shows as locked when editing.
- [ ] Your name is remembered for the next post. The password is pre-filled after the first successful post or unlock.
- [ ] Check both themes.

## 18. Home: original design restored + polish
- [ ] Home looks exactly as before v1.5.4 (clock, greeting, focal week strip, timeline cards).
- [ ] The next class today shows an "in 40m" badge on its card.
- [ ] During a break, the break strip turns blue and reads "Free now · 25m left".
- [ ] The live class card has an "Up next: X · time (Nm break)" line, or "Last class today".
- [ ] After the last class, a strip at the bottom reads "All done for today · Next: X · Tomorrow 9:45 AM". Tapping it jumps to that day.
- [ ] Holiday and no-class days show a "Next class: X · <day>, time" button that jumps there.
- [ ] A cancelled class shows its reason (from the notice) under the card.
- [ ] Tapping an assignment deadline banner opens that notice.
- [ ] On any day other than today, a "Today" pill appears next to the session count and jumps back.
- [ ] Picking the same weekday next week in the calendar no longer shows today's live progress or "done" badges.

## 19. In-app updates (from v1.5.6)
Updating from 1.5.5 to 1.5.6 still goes through the browser one last time, because 1.5.5 has no in-app installer. The first real in-app update is 1.5.6 → 1.5.7.
- [ ] On launch with a newer version out, a sheet slides up: "Update available", "vX · size · you have vY", the release notes, Update now / Later / Skip this version.
- [ ] Update now: a progress bar with "x of y MB" and %. Hide keeps it downloading. When the download finishes, the sheet comes back with "Downloaded and verified" and Install.
- [ ] First install: Android asks to allow installs from this app. "Open settings" goes to that toggle. After turning it on and coming back, the installer opens by itself.
- [ ] The Android installer shows "Update" (not "Install"). After it finishes the app restarts on the new version, and the routine, name, theme and notices are all still there.
- [ ] On first launch after updating, "Updated to vX · Here's what's new" shows once.
- [ ] Skip this version: no popup on later launches. Settings → Check for updates still offers it.
- [ ] Later: asked again on the next launch, or when coming back to the app after 6+ hours.
- [ ] Cancel during a download works. Airplane mode mid-download shows "Download failed" with Try again.
- [ ] Settings → Check for updates shows "New version vX … Update now", which opens the same sheet.
- [ ] Setting minRequiredVersionCode in version.json above your version shows "Update required" with no Later/Skip/close.

## 20. Widgets rebuilt (v1.5.6)
Add the widgets again after updating (long-press the home screen → Widgets → My Routine), or use the ones already there.
- [ ] Live widget, through the day, without opening the app:
  - [ ] Before the first class: "● FIRST CLASS" with the course, room and "in 1h".
  - [ ] 15 minutes or less before a class: "● STARTS IN 10M" in amber.
  - [ ] In class: "● IN CLASS · 2 OF 4", a progress bar, "35m in / 40m left", and NEXT or TOMORROW below.
  - [ ] In a break: "● FREE NOW · NEXT".
  - [ ] After classes: "● DONE FOR TODAY", with the next day's first class.
  - [ ] Thu/Fri: "● OFF DAY" with SATURDAY's first class.
  - [ ] Holiday: "● HOLIDAY" with its name.
- [ ] It changes on its own at class start and end, and the countdown stays within ~2 minutes. Leave the phone untouched for an hour during classes, then check.
- [ ] After restarting the phone, the widgets keep updating without opening the app.
- [ ] Changing the phone's time or timezone updates the widgets.
- [ ] A class cancelled by a notice: the live widget skips it. The day list shows it greyed with CANCELLED and the reason. Next week the same class is back to normal.
- [ ] Day list widget: the tabs show dates ("Sat 21"). It opens on today (Saturday on Thu/Fri) and resets to today the next morning. Rows show "● NOW · 20m left", "in 15m" (amber), and done ticks.
- [ ] Week widget: rows Sat–Wed with dates, today highlighted, live and done states. It reloads (the old version could stay stale).
- [ ] The refresh buttons update instantly. Tapping a title opens the app.
- [ ] Battery: no noticeable drain overnight. The widgets refresh at midnight, and otherwise at most every 3 hours outside class time.

## 21. Motion v2 (animations, haptics, gestures)
- [ ] Every button, card, chip and tab sinks under your finger, springs back, and shows a ripple from where you touched. Hub cards tilt their icon and nudge the arrow.
- [ ] Light vibration on taps, a "tick" on tabs/chips/day picks, and a stronger pattern on success/error toasts. Settings → Appearance → "Vibrate on tap" turns it off.
- [ ] Lists cascade in when they change (timeline on a day change, notices, faculty, rooms, matrix, calendar days). They do NOT replay every minute or while dragging the Rooms slider.
- [ ] Pages slide in with depth. Sheets (class details, notice, faculty profile, room, update) glide up, and can be dragged down from the top to close.
- [ ] Pull down at the top of Home, Notices, Faculty or Rooms: a spinner follows your finger, ticks when armed, and refreshes WITHOUT reloading the app. Pulling down while scrolled inside a list does nothing (the old version reloaded the whole app).
- [ ] Small details: the clock colon ticks, the greeting sun turns slowly (moon bobs at night), live dots pulse a ring, the "in 40m" badge breathes, the current break's coffee steams, progress bars fill in with a sheen, done ticks draw themselves, error toasts shake, and empty-state icons float.
- [ ] "All done for today" gives a small burst once per day.
- [ ] Settings → Animations: Auto shows what it picked ("Auto · using Full"). Lite = quick fades only. Off = no movement. The phone's "Remove animations" accessibility setting forces Off in Auto.
- [ ] Nothing feels laggy on your phone. If it does, note where, and whether Lite fixes it.

## 22. Feedback batches 1–3 (v1.5.8, on device)
- [ ] Scrolling works on Notices, Faculty and the post form (finger swipe, not just the wheel).
- [ ] Phone back button: closes the top popup/sheet first, then steps back a page, and exits from Home.
- [ ] Search bars (Faculty, Notices, Rooms) show one clean box when focused, no inner box.
- [ ] Switching days on Home does not re-cascade the list; pull to refresh still does.
- [ ] (v1.5.9) Switching days: no fade or rise at all on the schedule or the week strip pills; only the selected day widens.
- [ ] (v1.5.10) Sun → Sat: Sunday slowly narrows (SUNDAY fades out, 15 slides to centre and shrinks, SUN fades in above); Saturday widens (SAT floats up and fades, 14 slides left and grows, SATURDAY slides in on the right); colours blend. Nothing pops in or vanishes. Rapid taps don't leave stray labels.
- [ ] No top-left Home/Apps back buttons on Notices, Apps, Faculty and Free Rooms (dock covers them).
- [ ] Faculty profile weekly schedule keeps its height when switching days.
- [ ] Notifications off / battery optimised / exact alarms off: Notices shows a warning with a working Fix button; "Send a test" arrives.
- [ ] With the phone's vibration or touch feedback off, Settings → "Vibrate on tap" is greyed out with the reason.
- [ ] Centre dock button on Home: tap jumps to today; tap again on today spins and refreshes; hold opens the calendar (with a buzz). From other pages, tap goes Home.
- [ ] Thu/Fri are hidden in the Home strip and Rooms days unless something is on (or it's today/selected). Settings → Your class → off days and "Hide off days" change it immediately.
- [ ] Live class card fills sideways like water with a wavy edge; no bottom bar.
- [ ] Home background: stars + moon at night, sun in the morning, warm tint in the evening, faint lines in class, bubbles in breaks, dots on test/holiday days. Gone on other pages.
- [ ] Popups (class details, room, calendar, notice) dim the page more (the blur was removed again in §23). No lag when opening.
- [ ] Clock: digits roll when they change, a thin line fills across each minute, AM/PM pill, greeting name tint shifts with the time of day.
- [ ] Idle on Home/Apps ~8s: a small tip slides up above the dock (at most once per launch / 6 hours). "Got it" retires it.
- [ ] Tap a class → "Add an update for this class" → Test / Cancel / Move / Online / Task opens the post form prefilled (type, date of that class, course, time/teacher for Online; another section's class targets that section).
- [ ] (v1.5.9) Simple post mode removed (user: broken); the full form is the only mode.
- [ ] (v1.5.9) Apps, Notices, post form, Faculty and Rooms: scrolled to the bottom, the last card / Publish button sits above the dock.
- [ ] (v1.5.10) Live class card: no "Up next …" / "Last class today" line.
- [ ] (v1.5.10) Morning sun: the original design (soft glow + slowly turning rays), now centred just below the settings gear; visible in light mode too. Evening: the original warm tint.
- [ ] (v1.5.10) Light theme: sun, night stars + moon, evening tint and the live class water fill are clearly visible.
- [ ] (v1.5.10) Calm motion: switching pages only fades; popups fade in; sheets slide up with no bounce; lists don't rise in; no icon pops (dock, toast, dots), no shake, no confetti, no rolling clock digits, no sheen across the day card. Taps give a small, even press.

## 23. Performance pass (90 Hz smoothness, v1.5.11)
- [ ] Overall: opening and closing class details, the room sheet, notice details, the faculty profile, Settings and the Weekly Routine feels smooth at 90 Hz (no stutter at the start of the slide or fade).
- [ ] Popups now only dim the page (no blur at all, on any animation setting).
- [ ] Scrolling Faculty, Notices and Rooms is smooth, including the first scroll after opening the page. Rows don't flash or shrink when a scroll starts on top of them.
- [ ] Tap feedback: a quick tap still shows the small press and ripple; starting a scroll on a card no longer does.
- [ ] Faculty: the second visit opens instantly (the list is kept, not rebuilt). Filters and search still work; tapping a row opens the profile.
- [ ] Rooms and the Weekly Routine: after leaving and coming back, rooms, day tabs and course titles still respond to taps.
- [ ] Pages still open scrolled to the top (scroll Notices down, go Home, come back).
- [ ] Home clock: the thin line still fills across each minute.
- [ ] Greeting name keeps its time-of-day colour, but no longer drifts (that drift repainted the screen every frame).
- [ ] Faculty list: in-class dots are still, not breathing (the profile's single "now" dot still breathes).
- [ ] Battery: leaving the app on Home for a few minutes should drain less than before (nothing repaints at idle any more).
