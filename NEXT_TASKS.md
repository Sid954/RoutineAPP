# Next tasks (user request, 2026-11-16, for the next session)

Status (2026-11-17): items 1–16 and 18 done on branch `main-2cmtj2` (not released yet; checklist §22 in TESTING_CHECKLIST.md).
Item 7 uses a real blur: user approved `backdrop-filter` on popup backdrops, full motion tier only.
Item 18's Simple/Advanced post mode was removed again in v1.5.9 (user: "broken"); the class quick actions stay.
**Still open: item 17 (community suggestions / duplicates / pending / voting)** — needs API + Supabase schema decisions from the user.
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

## Posting announcements
18. **Easier post flow**: step-by-step sections (one at a time), easier date picker (Today/Tomorrow/day chips), subject picker from the routine, better icons; keep an "Advanced" mode with the full form (`src/announcements/post-form.js`).

## Tools / skills
- User asked for a "ponytail" skill (token saving): not found in their skills/plugins catalog. Suggested plugins: audit-suite, Android Emulator QA. Check ListPlugins next session.
