# New Homepage plan (agreed 2026-11-20, built 2026-11-20, released v1.5.26; reshaped the same afternoon — see "Post-build changes" at the bottom, released v1.5.27)

The current Home (clock, greeting, week strip, day timeline) is replaced by a dashboard of cards that
answers, in two seconds: **where do I need to be, what changed, what is due, and where can I sit**.
Delivered as **one release** (user's choice), built in the internal order at the bottom.

## Decisions (from the user, 2026-11-20)

| Topic | Decision |
|---|---|
| Structure | Replace Home completely with a card dashboard. |
| Day timeline | Moves to its own **Day page**, opened by the raised **center dock button** (and by tapping the Today's classes card). Week strip, day swipe, bell sheet and all class cards keep working there. |
| Style | One UI cards, same family as the new Settings / Notifications / Notices pages. |
| Reorder | Full drag-to-reorder. **Long-press a card (or "Edit Home" at the bottom) → edit mode** with drag handles and show/hide switches; normal taps never move anything. |
| Default order | Clock + greeting → Now/Next → What changed → Attendance prompt → Today's classes → Due soon → Exam countdown → Today's teachers → Unread notices → Suggestions to vote → Notes → Quick actions |
| After hours | After the last class / after 6 pm (existing rollover) and on off days, Home focuses on the **next class day**, labelled "Tomorrow" or the day name. |
| Attendance | Phone-only. Prompt on Home after each class + **one evening summary notification** listing the day's classes with Present / Absent. Unanswered = not counted. Minimum **75%** (changeable). |
| Past classes | Start from zero, but each subject can be filled in: the app shows an **estimate of classes held so far** (routine days since the semester start, minus cancellations and holidays, plus extra / rescheduled-in classes) with **every date on a calendar**, so the student can tick the ones they attended. |
| Semester start | One shared date in the remote `config.json` (`semesterStart`), updated each semester by the maintainer; each student can override it in Settings. |
| Notes / to-dos | Private by default, with **"Share with my section"** that turns it into a suggestion for voting. |
| Exams | Class-test notices count automatically, **plus** midterm / final dates the student adds. One countdown list. |
| Today's teachers | Yes: photo, subject, room, time, one-tap email (phone when the faculty data has it). |

## The cards

Every card: rounded One UI card, a round coloured icon, a title row with a "See all" chevron where it
leads somewhere, an empty state that says something useful, and it can be hidden or moved in edit mode.
Cards with nothing to show collapse to a one-line state (or hide) instead of leaving gaps.

1. **Header: clock + greeting.** Big clock, date (tap → calendar), "Good morning, Name", one line summary
   ("3 classes today, first at 9:45" / "Free day" / "Campus closed"). Keeps the bell for the day.
2. **Now / Next (hero).**
   - In class: subject, room, teacher, time left, the live water fill, "Next: X in Room Y at 11:00".
   - Break: "Free for 1h 15m", next class with countdown and room, and "3 rooms free near you" link.
   - Before first class / tomorrow: first class with countdown.
   - Online class: a big **Join** button. Cancelled: greyed, with the reason. Not confirmed: amber cross icon.
   - Tap → class sheet.
3. **What changed** (today + next class day): cancellations, room changes, reschedules, online moves,
   extra classes, holidays, not-confirmed suggestions; newest first, each with its icon; tap → notice.
   Hidden when nothing changed ("No changes to your routine").
4. **Attendance prompt.** Appears after a class ends: "Were you in DS (9:45)?" Present / Absent / Skip.
   Stacks the day's unanswered classes; a compact summary line otherwise ("DS 78% · can miss 1 more").
   Tap the title → Attendance page.
5. **Today's classes** (compact): one row per class (time, subject, room, status: done / now / next /
   cancelled / online / test). Tap a row → class sheet; tap the card → Day page.
6. **Due soon** (7 days): assignments and tests with countdowns ("in 2 days", "tonight 11:59 PM"), Done
   tick for assignments (same as the notification "Done"). Tap → notice.
7. **Exam countdown.** Next exam big ("Midterm: DS in 6 days"), list of upcoming exam days; "+ Add exam".
8. **Today's teachers.** Teachers of today's classes: photo, name, subject + time + room, email button,
   "where is she now" (from teacher finder). Tap → faculty profile.
9. **Unread notices.** Latest 3 unread with count; tap → notice; "See all" → Notices.
10. **Suggestions to vote.** Section suggestions waiting for votes, with up / down on the card and the
    vote progress; confirmed/not-confirmed icons as elsewhere.
11. **Notes.** Open notes / to-dos (linked to a class or general), tick to finish, "+ Note". A class
    with a note shows a small note icon on its class card and in its class sheet.
12. **Quick actions.** Free rooms now, Find a teacher, Weekly routine, Suggest a notice, Notifications,
    Attendance, Add exam, Add note.

Edit mode: long-press → cards shrink slightly (no bounce), a handle and a switch appear on each; drag
follows the finger, others glide out of the way; "Done" saves. Order + hidden set stored in
`localStorage` (`home_layout_v1`), with "Reset layout". Mouse path via `bindMouseDrag` (desktop rule).

## New pages and sheets

- **Day page** (center button): today's current Home timeline moved as-is, with its swipe, week strip,
  bell sheet, Back to today. Must keep the DOM ID contract (`cc`, `cT`, `cR`, `cBar`, `nc`, `nT`, `chG`,
  `prevDayBtn`, `nextDayBtn`…) and the widget feed.
- **Attendance page**: per subject: % ring, attended / held, "can miss N more" or "need N more in a row",
  at-risk in amber/red; per subject detail with a **month calendar** of every held class date
  (present / absent / unknown), tap a date to set it; "Estimated held so far: 14 (from 2 Nov)" with
  how it was counted; manual starting counts; minimum % setting.
- **Add exam / Add note sheets**: bottom sheets, calm motion, swipe to close.

## Data (new, all phone-only except the semester start)

- `src/attendance/attendance-store.js` (DOM-free, tested): `{ [date|classKey]: 'present'|'absent' }`,
  manual base counts per subject, minimum %. Uses `classKey()` from the planner so notification
  buttons, Home and the calendar agree.
- `src/attendance/held-classes.js` (pure, tested): for a subject and date range, every held class date
  from `getEffectiveClassesForDay` (cancelled / holiday / rescheduled-away excluded, extra and
  rescheduled-in included). "Approximate" because notices older than the cached list may be missing.
- `src/notes/notes-store.js` (tested): notes `{ id, text, classKey?, date?, done }`; share → existing
  `Suggestions.suggest()` as a general notice.
- `src/exams/exams-store.js` (tested): own exams `{ subject, kind: midterm|final|other, date, time? }`
  merged with class-test notices.
- `config.json`: `semesterStart` (YYYY-MM-DD); Settings → Your class → "Semester started" override.
- Home layout: `home_layout_v1`.

## Notifications

- The evening attendance summary is a new planner kind (`attendance`), planned **only through
  `src/notifications/planner.js`** (standing rule), on its own channel (`nf_attendance_*`, with a sound
  choice), at a time in Settings → Notifications (default 8:30 PM), only on days with held classes, and
  respecting pause, quiet hours, weekdays and the per-day bell. Buttons: "Open" (Attendance page
  for that day). Android notifications can carry only a few buttons, so per-class marking happens in
  the app, not in the notification.

## Rules this must follow

- Motion rule: every swipe, toggle, drag and state change animates calmly (`--mx-ease`, no overshoot,
  transform / opacity only, `data-motion="off"` honoured).
- Performance rules from the Nov 19 pass (no forced layout in touch handlers, no infinite decorative
  animations, `setHtmlIfChanged` for re-renders, nothing heavy in the 30 s poll).
- SVG icons only, two themes, safe-area padding. Weekly Routine stays plain.
- Every override shown on Home reads through `getEffectiveClassesForDay()`.

## Internal build order (one release at the end)

1. Day page on the center button (move the timeline, keep IDs and widget feed working).
2. Home shell: card framework, layout store, edit mode with drag and show/hide.
3. Cards from existing data: header, Now/Next, What changed, Today's classes, Due soon, Unread notices,
   Suggestions to vote, Quick actions.
4. Attendance: stores, held-classes estimate, Attendance page with calendar, Home prompt, evening
   notification, settings.
5. Notes, Exams, Today's teachers.
6. Settings entries (Home screen: reset layout; Your class: semester start; Attendance: minimum %).
7. Tests for every new pure module; browser checks in both themes; then the release.

## Answered (2026-11-20)

- Evening attendance check: **8:30 PM** (Settings → Notifications → Daily summary → Attendance check), never before the last class ends.
- Labs are their own subject (DSL apart from DS): subjects are course codes.
- `semesterStart` = **2026-11-02** (the last semester, used as if current; update `config.json` when the new one starts).

## What was built (files)

- `src/home/home.js` (cards, edit mode, drag), `home.css`, `layout-store.js`, `home-sheets.js` (note / exam sheets), `home-deadlines.js`.
- `src/attendance/attendance.js` (store + maths), `held-classes.js`, `attendance-data.js`, `attendance-page.js`.
- `src/notes/notes-store.js`, `src/exams/exams-store.js`. Tests: `tests/test_home_stores.js`, planner test "Attendance check".
- Views: `home` = `#homeView` (new), `day` = `#dashboardView` (the old Home, center dock button). Picking a date, a notice's "In routine" and notification taps open `day`.

## Differences from the plan

- Settings entries: the layout reset lives in Home's edit mode, the semester start and minimum % on the Attendance page (not in Settings).
- A note shows as a "Note" tag in Today's classes; the Day page class cards and the class sheet don't show it yet.
- Today's teachers has no "where is the teacher now" line yet.
- "Wi-Fi passwords" (marked "soon" in Apps): out of scope.

## Post-build changes (Nov 20 afternoon, user-directed, released v1.5.27 — not phone-tested)

The user iterated on the shipped dashboard the same day. Current card set (`CARDS` in `src/home/layout-store.js`):
header → **Classes** (`now`) → What changed → Due soon → Exams → Teachers → Notices → Suggestions → Quick actions.

- **Removed cards:** the separate Attendance prompt, Today's classes and Notes cards. The header gained a **Notes button** beside the settings gear; Notes became a full standalone app (`src/notes/notes-page.js`, v2 rebuild — see HANDOFF.md).
- **Classes card** (the old Now/Next + Tomorrow merged): always the same row design — time, class, room, and the subject's **attendance % on the right**. After a class ends, that slot becomes a **Present/Absent checker** until answered or 11:59 PM; one **"Skip all"** appears after the day ends. Unmarked = **absent**. Tapping a % opens that subject's Attendance page. After the evening cut-off the card shows tomorrow's classes.
- **Teachers and Suggestions start hidden** (`DEFAULT_HIDDEN = ['teachers', 'suggestions']`).
- **Due soon:** one card at a time, swipe with a dot count; Done moves the item to the end on the next refresh; heading badge = unchecked count, red when an unchecked item is due today/tomorrow, green tick when all done; urgent cards get a red outline + pill.
- **Exams card redesigned:** big days-left tile (solid orange ≤3 days, "Today" on the day), subject/type/weekday/date/time beside it, next exams as date-tile rows with "in Nd" chips, "+N more", useful empty state.
- **Exam-day flagging:** header "N classes · M exams" (exam part red), red class rows + EXAM tag for exams on a class slot, red banner for exams that aren't slots (own midterm/final or a test with no class that day). Cancelled/moved classes are never flagged.
- **Passed items hidden:** today's exams/tests/changes disappear once they happen (class end, or the evening cut-off; assignments after their due time). Chips say Today/Tomorrow/in Nd, never "in 0d".
- **Manual attendance for uncovered dates:** allowed with a warning popup (the icon-details popup style), once per edit session; the calendar can navigate to months before the semester start.
- **Notices after the cut-off:** Tomorrow group above a folded Today (`notices-view.js`).
- **Design direction:** the user rejected further Samsung/One UI styling for this work ("i dont like samsung UI … design it like the given image" — the image is not recoverable from the transcripts; ask for it). Keep changes minimal.
- **Dark theme:** blue-tinted variant rejected and reverted; neutral charcoal slightly deepened (`#131418` / `#212329`, `src/themes/themes.css`).
- **Ambient:** a six-phase sky rewrite was rejected ("completely hate the design") and fully reverted to the original faint scene. Do not redo it without asking.
