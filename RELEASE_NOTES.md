# My Routine v1.5.1 Release Notes

> **One-time reinstall needed:** this is the first build signed with the permanent release key. If you have v1.5.0 or older, uninstall it once, then install this APK. Future updates will install normally on top.

### Fixes
- **Your routine stays yours:** the background updater no longer replaces your semester/section routine with a different section's routine.
- **Push notifications work:** announcement pushes are now delivered, targeted to your semester and section, and follow you when you change section.
- **Home-screen widget respects announcements:** cancelled classes, holidays and moved classes no longer show as normal on the widget.
- **Offline is faster and lighter:** network requests time out after 8 seconds and fall back to cached data. The offline cache no longer grows on every launch.
- **Correct dates after midnight:** the post form and the streak no longer count the previous day between 12am and 6am.
- **Free Rooms:** tapping a class card opens its details instead of the instructor profile, and the empty-state wording is consistent.

### New
- **After 6pm the app shows tomorrow:** once today's classes are done, the schedule and next-class card switch to tomorrow.
- **Past announcements are tucked away:** expired notices are hidden behind a "Show past announcements" toggle and no longer count as unread.
- **More than one override per day:** the week strip shows up to 3 icons (plus "+N"). In the calendar, only class tests and assignments tint the day.
- **Your name in the greeting:** set it in Settings or on first launch.
- **Section list stays current:** new sections appear automatically from the server.
- **Holiday ranges:** the end date defaults to the day after the start.
- **Weekly Routine and Schedule Settings** now open as full pages.

### Security
- Admin and announcement passwords are checked more safely, with lockout after repeated wrong attempts and no default password.
- Photo uploads are validated and rate-limited.
- The weekly faculty sync only runs with its secret configured.

### Design
- All emoji icons replaced with SVG icons. Blur and glow effects removed for a cleaner, faster UI.
