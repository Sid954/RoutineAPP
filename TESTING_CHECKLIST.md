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

## 18. Home / Routine rebuild
- [ ] Header: "Good morning/afternoon/evening" with a matching icon, your name, "Nth semester · Section X", the clock and the Settings button.
- [ ] Now card, checked at different times of day:
  - [ ] Before the first class: "First class today", the course, room and teacher, and a countdown ("in 1h 05m").
  - [ ] During a class: "In class now", the course, "2 of 4", time left, a progress bar, and "Then X at …".
  - [ ] In a break: "Free right now", the next class and the countdown.
  - [ ] After classes: "Done for today", time spent in class, and the next class (tomorrow or the next class day).
  - [ ] Thu/Fri: "Off day" with the next class.
  - [ ] Holiday: the holiday name, highlighted in amber.
- [ ] A class test or assignment due today shows as an alert inside the now card. Tapping the card opens class details. Tapping a teacher's name opens their profile.
- [ ] An online class with a link shows "Join class".
- [ ] Heads up: tests, assignments, cancellations, holidays and moves in the next 7 days. Tapping one opens the notice, and "All notices" opens Notices.
- [ ] Week strip (Thu → Wed): counts of held classes, a coloured dot for holiday/test/cancel/assignment, and a ring around today. Tap a day to switch. Swiping the timeline left/right still changes day.
- [ ] The date pill opens the calendar. "Back to today" appears on any other day.
- [ ] Day header: "Today/Tomorrow/<day>" with the class count and time span. Stats chips: time in class, longest break, labs, tests, cancelled.
- [ ] Timeline: time column; Now/Next/done badges; a live progress bar. Breaks of 10 minutes or more appear between classes, and the current break is highlighted ("Free now · 25m left"). Deadlines appear at their due time.
- [ ] Cancelled and moved-away classes stay in the list, dashed and struck through, with the reason. Tapping a moved class jumps to its new date.
- [ ] After 6pm the page opens on tomorrow, but the now card still describes today.
- [ ] The home-screen widget still updates (it reads the schedule, not this page).
- [ ] Check both themes and a small phone (360px).
