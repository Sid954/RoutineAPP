# 📋 RoutineAPP (My Routine) — Complete Technical Overview & Redesign Blueprint

> **Document Purpose**: This document serves as the single source of truth for the architecture, data models, build targets, UI systems, and feature sets of the RoutineAPP project. It is intended to guide a comprehensive visual redesign while guaranteeing 100% preservation of all existing functionality.

---

## 1. 🏗️ Project Overview

### 1.1 What is this app/site for?
**"My Routine"** is an academic companion, real-time schedule tracker, campus room vacancy finder, faculty directory, and announcement dashboard built specifically for university students (Department of Computer Science & Engineering at Premier University Chittagong, Bangladesh).

It provides instant answers to:
- *"What class do I have right now, in which room, and with which professor?"*
- *"When is my next class and how many minutes do I have left?"*
- *"Which campus rooms are free right now to study or hang out?"*
- *"Where is Professor X teaching right now and how can I contact them?"*
- *"Are any of today's classes cancelled, moved online, or suspended for a holiday?"*

---

### 1.2 Tech Stack
| Layer | Technology |
| :--- | :--- |
| **Frontend Framework** | **Vanilla ES6+ JavaScript** (Native ES Modules — zero React/Vue/Angular overhead for instantaneous cold start and tiny bundle size) |
| **Styling & Design System** | **Modular Pure CSS3** with CSS Custom Properties (Design Tokens), glassmorphism, responsive grid/flexbox, and theme hooks |
| **State Management** | Centralized mutable singleton state store in `src/core/state.js` |
| **Native Wrapper** | **Capacitor 8.4** (`@capacitor/android`, `@capacitor/core`, `@capacitor/local-notifications`, `@capacitor/push-notifications`, `@capacitor/app`) |
| **Android Widgets** | **Native Java / Android RemoteViews** with `AlarmManager` background updates |
| **Backend & Database** | **Vercel Serverless Functions + Supabase PostgreSQL** (`https://routine-app-iota-one.vercel.app`) |
| **Build & Tooling** | Custom Node.js pipeline (`build.js`) aggregating multi-semester routines, scraping official university faculty rosters, and syncing assets |
| **Hosting & Deployment**| **GitHub Pages** (Web/PWA) + **GitHub Releases** (Direct APK updates) + **Vercel** (API) |

---

### 1.3 Repository Structure
```
RA/
├── index.html                   # Master single-page app markup & modal skeletons
├── build.js                     # Master Node build script (compiles data, updates SW, syncs Capacitor)
├── manifest.json                # PWA web app manifest
├── sw.js                        # Progressive Web App Service Worker with cache busting
├── capacitor.config.json        # Capacitor native Android configuration
├── config.json                  # Dynamic app runtime configuration & default schedule
├── schedule.json                # Default active semester timetable schedule
├── master_rooms_schedule.json   # Auto-compiled schedule of all 33 campus rooms across 8 semesters
├── master_teachers_schedule.json# Auto-compiled weekly schedule of 84+ faculty members
├── faculty_info.json            # Scraped & enriched faculty database (130+ profiles)
├── android-custom/              # Android native source files (injected into android/ during build)
│   ├── java/com/routine/app/    # Widget providers, RemoteViews factories, and Capacitor plugins
│   ├── res/layout/              # XML layouts for Android Home Screen widgets
│   ├── res/drawable/            # Widget vectors, previews, and progress bars
│   └── AndroidManifest.xml      # Native Android manifest with permissions & widget declarations
├── android/                     # Generated Android Studio Gradle project (synced via npx cap sync)
├── src/                         # Modular Frontend ES Modules
│   ├── main.js                  # App bootstrap entry point
│   ├── main.css                 # Master CSS importer
│   ├── features.js              # Feature flags registry
│   ├── core/                    # Config, State, DOM cache, and utilities
│   ├── dashboard/               # Clock, Greeting, Live Current Class, Next Class ETA
│   ├── timeline/                # Daily class list, Day switcher, Course title expander
│   ├── rooms/                   # Campus Free Room Finder & room schedule modal
│   ├── teachers/                # Faculty Directory, Search, Profile modal & routine
│   ├── weekly-matrix/           # Full-week 5-day timetable grid modal
│   ├── announcements/           # Live feed, Post form, Holiday/Cancellation overrides
│   ├── notifications/           # Native push, Local alerts, Lead-time scheduler, Log modal
│   ├── edit-schedule/           # Custom routine editor & JSON Import/Export
│   ├── exams/                   # Semester exam schedule & countdowns
│   ├── themes/                  # Multi-palette theme engine (Midnight, AMOLED, Cyber, etc.)
│   ├── updater/                 # In-app APK auto-updater (GitHub Releases API)
│   ├── storage/                 # LocalStorage persistence layer
│   ├── streak/                  # Daily usage streak tracker
│   ├── particles/               # Interactive HTML5 Canvas particle background
│   ├── modals/                  # Universal modal open/close controller
│   └── toast/                   # Toast notification system with Undo action
```

---

## 2. 📱 Platforms & Build Targets

1. **Web Application**: Static Single-Page App hosted on GitHub Pages (`https://sid954.github.io/RoutineAPP`).
2. **Progressive Web App (PWA)**:
   - Installable on Chrome, Safari (iOS), Edge, and Desktop.
   - Offline-capable via `sw.js` Cache-First strategy.
   - Dynamic cache versioning (`routine-cache-<timestamp>`) injected during `npm run build`.
3. **Android Native App (APK)**:
   - Native container powered by **Capacitor 8.4**.
   - Package ID: `com.routine.app` | Version: `1.5.0` (VersionCode: `10`).
   - In-app auto-updater checks GitHub Releases (`/releases/latest/download/app-release.apk`).
4. **Android Home Screen Widgets** *(Fully Implemented & Active)*:
   - **Widget 1: Live Class & Countdown Widget** (`RoutineWidgetProvider.java`): Shows ongoing class progress bar, room, remaining time, and next class.
   - **Widget 2: Landscape Timetable Card** (`RoutineRotatedWidgetProvider.java`): Compact wide view of today's schedule.
   - **Widget 3: Full Scrollable List Widget** (`RoutineListWidgetProvider.java`): Interactive scrollable RemoteViews list of all classes today.
   - Synced via background `AlarmManager` and native Capacitor plugin (`WidgetPlugin.java`).
5. **App Store Presence**: Currently distributed directly via GitHub Releases APK and Web/PWA.

---

## 3. 🎯 Features — Complete Catalog

| Feature | Description | Key Data Dependencies | Critical Logic / Behaviors |
| :--- | :--- | :--- | :--- |
| **Digital Header & Clock** | 12h/24h digital clock with AM/PM indicator, active day, date badge. | System clock (`new Date()`) | Updates every second; tap toggles 12h/24h display format. |
| **Smart Greeting & Daily Streak** | Greets the user based on time-of-day and tracks daily visit streaks with fire emoji (`🔥 Streak: 5 days`). | `localStorage` (`streak_data`) | Increments if visited on consecutive days; resets if a day is skipped. |
| **Live Current Class Card** | Shows ongoing class with real-time animated progress bar, elapsed time, remaining countdown, room badge, and professor code. | `State.schedule`, `announcementsList`, `getCurrentMinutes()` | Calculates minute delta (`currentMins - startM`); detects **Free Time**, **Holiday**, **Class Cancellation**, or **Online Class**. |
| **Next Class ETA Card** | Shows upcoming class details with countdown chip (`in 25m`, `in 1h 15m`). | `State.schedule`, `getCurrentMinutes()` | Finds next chronological class; displays "No upcoming classes 🎉" or "Enjoy your break" when done. |
| **Daily Class Timeline** | Vertically stacked class cards showing start/end time, subject code, room badge, Theory/Lab badge, and teacher code. | `State.schedule`, `State.currentViewDayIdx` | Highlights active class in glowing cyan/emerald; greys out finished classes; inserts Break cards between gaps; swipe gestures support. |
| **Day Switcher** | Segmented day navigation (`Sat`, `Sun`, `Mon`, `Tue`, `Wed`) with previous/next controls. | `CONFIG.activeDays` | Switches rendered day smoothly without reloading; automatically selects tomorrow's routine in the evening (after 5 PM). |
| **Campus Free Room Finder** | Lists all 33 university campus rooms with real-time status: 🟢 Free now (with "free for next X hrs") vs 🔴 Occupied. | `master_rooms_schedule.json` (33 rooms across 8 semesters) | Time-travel slider allows students to check room vacancy at any specific future hour today. |
| **Faculty Directory & Profiles** | Searchable directory of 130+ faculty members with contact info, photo, designation, live status (🟢 In Class vs 🌴 Free), and full weekly routine. | `faculty_info.json`, `master_teachers_schedule.json` | Instant search by name, short code, designation, subject taught, or room; interactive day tabs for routine. |
| **Faculty Info Suggestion & Admin Review** | Allows students to suggest missing faculty phone numbers, emails, or names; admin approval panel with passkey. | Supabase API (`/api/teachers`) | Submissions saved to remote DB; approved overrides broadcast to all users. |
| **Weekly Timetable Matrix** | Full-screen interactive 5-day timetable grid mapped against standard departmental time intervals. | `State.schedule`, `CONFIG.matrixIntervals` | Matrix modal displaying entire week at a glance with theory/lab color coding. |
| **Announcements & Override System** | Live feed of notices (Class Cancellations, Holidays, Online Classes, General News) posted by class representatives. | Supabase API (`/api/announcements`) | Overrides dynamically alter the main dashboard (e.g. crossing out a cancelled class or inserting Zoom link). |
| **Smart Notification Engine** | Background/local notifications 5, 10, 15, or 30 minutes before every class; cancellation alerts. | Capacitor `LocalNotifications` / Web Notification API | Schedules daily notification alarms; logs history to in-app Notification Log modal. |
| **Custom Routine Editor & Import/Export** | Allows students to customize their routine (add/edit/delete classes), export as JSON backup, or import a friend's routine. | `localStorage` (`genz_routine_data`) | Full normalizer validates start/end times and formats; instant rollback / default reset option. |
| **Semester Exam Timetable** | Modal displaying upcoming midterm/final exam dates, course codes, rooms, and live countdown timers. | `src/exams/exam-schedule.js` | Calculates days/hours remaining until each exam. |
| **Themes Engine** | Multi-theme switcher: Midnight Navy, AMOLED Pitch Black, Cyberpunk, Emerald, Sunset, Light mode. | CSS Custom Properties & `localStorage` (`puc_app_theme`) | Applies `data-theme` attribute to `<html>` for instant, non-flickering palette changes. |
| **In-App APK Auto-Updater** | Checks GitHub Releases for new APK versions, displays changelog, and offers one-click download. | GitHub API (`/repos/sid954/RoutineAPP/releases/latest`) | Compares `CONFIG.appVersionCode` against remote release tag. |

---

## 4. 🧠 Data Model & Logic

### 4.1 Core Data Entities
```typescript
// 1. Class Item
interface ClassItem {
  time?: string;          // "09:45 AM - 11:00 AM"
  start: string;          // "09:45 AM"
  end: string;            // "11:00 AM"
  startM: number;         // 585 (Minutes since midnight)
  endM: number;           // 660
  subject: string;        // "ICMP"
  title?: string;         // "Introduction to Classical & Modern Physics"
  room: string;           // "404"
  instructor: string;     // "NME"
  type: "Theory" | "Lab"; // Theory or Lab
  semSec?: string;        // "Sem 2-B"
}

// 2. Weekly Schedule
type Schedule = Record<number | string, ClassItem[]>; // Keyed by Day Index (6=Sat, 0=Sun, 1=Mon, 2=Tue, 3=Wed)

// 3. Faculty Member Info
interface FacultyInfo {
  code: string;           // "NME"
  name: string;           // "Nur Mohammad Eman"
  designation: string;    // "Faculty Member · Department of CSE"
  photo?: string;         // Remote URL
  status: "Active" | "Study Leave";
  emails: string[];
  phone: string;
  profileUrl: string;
}

// 4. Announcement / Override
interface Announcement {
  id: string;
  title: string;
  announcement: string;
  type: "general" | "holiday" | "cancellation" | "online_class";
  targetDate?: string;    // "2026-08-19"
  targetSubject?: string; // "ICMP"
  targetDayIdx?: number;  // 1
  createdAt: string;
  expiresAt: string;
}
```

### 4.2 Scheduling & Time Calculation Logic
- **Minutes-Since-Midnight System**: All string times (`09:45 AM`, `1:30 PM`, `14:30`) are converted via `toMinutes()` into an integer (0..1439).
- **Active Class Detection**: `currentMins >= class.startM && currentMins < class.endM`.
- **Academic Week Cycle**:
  - Active Days: `Saturday (6)`, `Sunday (0)`, `Monday (1)`, `Tuesday (2)`, `Wednesday (3)`.
  - Weekend / Off Days: `Thursday (4)`, `Friday (5)`.
- **Auto-Switch Evening Logic**: After 5:00 PM (`17:00`), the dashboard automatically pre-selects the next academic day's timetable.

### 4.3 Authentication & Access Control
- **Zero-Friction Access**: No user registration or login required to view schedules, rooms, or faculty profiles.
- **Admin Password Gate**: Password verification required only for publishing announcements or approving faculty data submissions.

---

## 5. 🎨 Current UI & Design System Architecture

### 5.1 Design Tokens (`src/core/core.css` & `src/themes/themes.css`)
- **Backgrounds**: `--bg: #06080d;`, `--bg2: #0f121a;`, `--card: #141824;`, `--card2: #1b2030;`
- **Text Hierarchy**: `--text: #f3f5f9;` (Headings/Primary), `--dim: #848c9e;` (Muted/Captions)
- **Accents**: `--accent: #38bdf8;` (Sky Cyan), `--accent2: #7dd3fc;`, `--pink: #f43f5e;` (Rose/Alert), `--lime: #10b981;` (Success/Live)
- **Typography**: 
  - Main Body: `'Plus Jakarta Sans', system-ui, sans-serif`
  - Numbers & Time Badges: `'JetBrains Mono', monospace`
- **Border Radius**: `--r: 24px;` (Main cards), `--rs: 18px;` (Inner containers), `--rx: 10px;` (Pills/Buttons)

### 5.2 Modal & Overlay Architecture
- Universal modal controller in `src/modals/modal.js` controlling backdrop blur (`.mo.open`) and dialog container (`.md`).
- All sub-modals (Faculty Profile, Room Finder, Weekly Matrix, Routine Editor, Announcements, Notification Settings, Exams) share this common modal structure.

---

## 6. 🔌 Integrations & Native APIs

1. **Supabase REST API / Vercel Proxy**:
   - `GET/POST /api/announcements`: Real-time class notices and cancellation overrides.
   - `GET/POST /api/teachers`: Crowd-sourced faculty updates.
2. **PUC Official CSE Portal**:
   - `build.js` scrapes `https://cse.puc.ac.bd/Home/FacultyMembers` to populate teacher designations, profile pictures, and profile URLs.
3. **Capacitor Device APIs**:
   - `LocalNotifications`: Scheduled alarms prior to class start.
   - `PushNotifications`: Remote broadcast alerts.
   - `App`: App state / lifecycle listener.
4. **Android Native Bridge (`WidgetPlugin.java`)**:
   - Transmits live schedule data from web layer into Android `SharedPreferences` to render Home Screen AppWidgets.

---

## 7. ⚠️ Critical Rules for the Redesign (Do Not Break)

When overhauling the visual interface, keep these critical technical boundaries in mind:

1. **Keep HTML IDs Intact**:
   - JavaScript modules query specific DOM elements by ID (e.g. `clockTrigger`, `cc`, `cT`, `cR`, `cBar`, `nc`, `nT`, `chG`, `prevDayBtn`, `nextDayBtn`, `findTeacherFab`, `freeRoomsFab`).
   - The markup structure and CSS classes can be redesigned, but **DOM element IDs should be preserved** so event listeners and update cycles don't break.
2. **Android Widget Independence**:
   - Android widgets are rendered via native Java XML (`android-custom/res/layout/`). Any web CSS changes will not break Android widgets as long as `build.js` remains intact.
3. **State & Logic Separation**:
   - All logic modules in `src/dashboard/`, `src/timeline/`, `src/rooms/`, and `src/teachers/` read from `State` and output structured HTML templates. The HTML strings they render can be styled to match any new design language.
4. **Mobile WebView Safe Areas**:
   - Must always maintain `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` so buttons and headers never get clipped by device camera notches or home gesture bars.
