# Next tasks (user request, 2026-11-16, for the next session)

Status (2026-11-17, v1.5.12 released): items 1–16 and 18 are done and released in v1.5.8–v1.5.10 (phone checks: §22 in TESTING_CHECKLIST.md).
- Item 7: the real popup blur it added was **removed again in v1.5.11** for performance; popups use a plain dim.
- Item 13: notifications were then fully rebuilt in v1.5.12 (planner, quick pause, skips, quiet hours, per-type notices; §25).
- Item 18: the Simple/Advanced post mode was removed again in v1.5.9 (user: "broken"); the class quick actions stay.
- **Still open: item 17 (community suggestions / duplicates / pending / voting)**, which needs API and Supabase schema decisions from the user.
User feedback on v1.5.7: "Animations are pretty good so far."
Rule reminders: Home keeps the user's ORIGINAL design (no redesigns without asking). Edit `src/`, never `www/`. Ask before release.

## Home / routine
1. **No jump on date switch.** Switching day re-animates the 2nd half (timeline cascade, `#chG` in `STAGGER` in `src/core/motion-engine.js` + `day-swap` in `src/timeline/timeline.js` / motion.css §4). Only animate when the page refreshes AND content actually changed; day switches should glide (crossfade/slide only, no re-cascade, no layout jump).
2. **Centre dock button** (`#dockCenterFab`, wired in `src/main.js`): on Home, tap = go to today (or refresh if already on today); long-press = open calendar. Elsewhere keep current behaviour.
3. **Ambient background by time/state:** subtle stars at night, sun in the morning, something class-related during class, break visuals in breaks, event visuals (tests/holidays). Light, GPU-only, respects motion tiers (`html[data-motion]`).
4. **Hide Thu/Fri** (university off days) in Home week strip (`renderWeekStrip` in timeline.js) and Rooms day row (`src/rooms/rooms-view.js`) unless that date has a class/event. Setting to change which days are off. Freed space → bigger day cells with room for icons.
5. **Live class card:** replace the bottom progress bar with a sideways "water fill" of the whole card (light, device friendly).
6. **Better clock design** + slight colour shifting animations; "we need more animations".

## Global UI
7. **Popups:** dim/blur the background more so the popup is easy to focus on (no glassmorphism rule → prefer stronger dim + slight scale-down of the page; ask user if real blur is OK).
8. **Remove top-left "Home"/"Apps" back buttons** on pages reachable from the dock (Notices, Apps hub, etc.). Keep back where the dock can't get there.
9. **Fix search bars** in many places (inspect each: Faculty, Rooms, Notices, Settings…).
10. **Fix scrolling on mobile** (Notices, Faculty and others). Likely: nested scroll containers / `overflow` on `.app-page-view` vs inner lists, or motion-engine touch handlers (pull-to-refresh/sheet drag listen on document touchmove passive — check). Test on device-sized headless with touch.
11. **No size jumps** when content count varies (e.g. Faculty profile weekly schedule: 0 classes one day, 5 the next → sheet grows/shrinks). Reserve min-heights / smooth height.
12. **Android hardware/gesture back button does nothing** — wire Capacitor `App.addListener('backButton')`: close top sheet/modal → go back a view → exit on Home.
13. **Notifications:** verify they work; if not, tell the user why (permission off, battery optimisation, no google-services.json / FCM, channel blocked) with a fix button.
14. **Vibrate toggle:** grey it out when the phone's vibration/haptics is disabled (check what Capacitor/Android exposes; may need a small native method).
15. **Idle tips:** occasional "how to use" tips (gestures, long-press, pull to refresh, swipe sheets…) shown on idle, never blocking, dismissible, not repeated too often.

## Community events (big feature)
16. **Tap a class → add event**: exam/test, cancel, reschedule, online, assignment, note — prefilled from the class.
17. **Anyone can suggest** (no password); admins approve. **Duplicate detection**: tell the user someone already suggested the same thing. **Show pending suggestions to everyone** marked "unconfirmed". **Voting** (up/down) to make them trustworthy. Needs API + Supabase table changes (suggestions, votes; rate limits per device/IP; reuse `api/_lib/security.js` patterns). Admin approves → becomes a normal announcement.

### Item 17 design (agreed with the user, 2026-11-18; BUILT 2026-11-18, uncommitted until the user says; needs supabase_suggestions.sql run, API deploy, new APK; checklist §28)
- Scope: notices only (no routine edits). No accounts: a random device ID per phone.
- Separate "Suggestions" section in each section's feed, with votes, duplicate detection (same section + type + subject + date) and a "Not confirmed" label.
- A suggestion with >= 2 net up-votes shows in the live routine flagged "Not confirmed"; otherwise it stays only in Suggestions and changes nothing. Net down-votes >= 5 hides it (admin still sees it); 7 days without approval expires it.
- Auto-approve: >= 60% up-votes AND >= 8 total votes (about 20% of an average 40-student section), labelled "Community confirmed". Department-wide suggestions need >= 15 total votes at 60%, and only the announcement password may approve/reject them early.
- Voting: a section's suggestion is voted on by that section's members; department-wide ones by everyone. One vote per device, changeable.
- Approval/rejection with `ANNOUNCEMENT_PASSWORD` for now (better auth later). Approved suggestion becomes a normal announcement.
- Limits: 5 suggestions/day per device, 3/hour per IP (use `guard()` in `api/_lib/security.js`).
- Push only when approved or community-confirmed, on a new Android channel `suggestions` with its own short chime (generated, in `android-custom/res/raw/`), following the user's notice preferences.
- Needs: Supabase table(s) (suggestions, votes) run by the user, a new API endpoint, a new APK.

## Posting announcements
18. **Easier post flow**: step-by-step sections (one at a time), easier date picker (Today/Tomorrow/day chips), subject picker from the routine, better icons; keep an "Advanced" mode with the full form (`src/announcements/post-form.js`).

## Tools / skills
- User asked for a "ponytail" skill (token saving): not found in their skills/plugins catalog. Suggested plugins: audit-suite, Android Emulator QA. Check ListPlugins next session.

## Temporary test clock (added 2026-11-17) — REMOVE before the app goes public
A "Test time" tab hangs from the top of every page; it opens a day row + 24h slider and the app
follows live. Pieces to delete together:
- the second inline `<script>` in `index.html` `<head>` (replaces `Date`, offset in localStorage `dev_time_offset`)
- `src/settings/test-time.js` and its import/`initTestTime()` in `src/main.js`
- the "TEMPORARY test clock" block at the end of `src/settings/settings.css`
- the `window.__devTimeOffset` guard at the top of `scheduleForToday` in `src/notifications/notifications.js`

## Later: notification sounds
- User asked (2026-11-18) for a notification sound and sound effect for EVERY notification type (class reminders, tests, deadlines, summaries, notices, suggestions), each type distinct, with settings to turn them on or off. Android sets a channel sound only at creation, so each type needs its own channel (and a new channel id if the sound changes).
