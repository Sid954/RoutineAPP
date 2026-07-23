# 📚 My Routine — Smart Timetable Dashboard & Native Hybrid Android App

**My Routine** (RoutineAPP) is a university timetable dashboard PWA and hybrid Android app featuring live class progress tracking, native Android Home Screen Widgets, dynamic schedule updates, and a real-time announcement system powered by FCM push notifications.

---

## ✨ Key Features

* **📱 Native Android Home Screen Widget:**
  * Displays real-time class progress, countdown ETA progress bar, room pill, next class preview, and a manual reload button directly on your phone's home screen.
  * Native layout preview support in the Android Widget Picker.

* **🔄 Smart In-App Automatic Updater:**
  * **Zero-Friction OTA Updates:** Schedule changes, timing edits, theme updates, and announcements automatically sync in the background on app startup without interrupting the user.
  * **Priority Native APK Releases:** New Android APK builds (`version.json`) automatically take priority, prompting with a clean glassmorphic permission dialog (**New Version Available!**) and 1-tap `.apk` downloads.
  * **Single-Source-of-Truth Versioning:** Updating `version.json` automatically syncs `versionCode` and `versionName` across `android/app/build.gradle` and `src/core/config.js` via `npm run sync`.
  * **Session Memory & Self-Healing:** Remembers dismissal choice per session and self-heals version state across web cache & local storage.

* **⏳ Live Class Dashboard:**
  * Real-time countdown timers, progress bars, room indicators, and upcoming class previews.

* **📅 Interactive Timetable & Weekly Matrix:**
  * Dynamic day switcher, schedule normalizer, and responsive full-week timetable grid.

* **📢 Real-Time Announcement Board & Overrides:**
  * Post announcements with shared authentication to create live schedule overrides (online classes, room changes, holiday cancellations).

* **🔔 FCM Push Notifications:**
  * Triggers native Android push notifications and local alarms for upcoming classes and new announcements.

* **⚡ Ultra-Smooth Performance & GPU Compositing:**
  * Optimized background particle canvas with touch auto-pause and O(N²) line frame-skipping.
  * 60fps CSS GPU acceleration (`contain: content`, `will-change`, `backface-visibility: hidden`).

---

## 🛠️ Tech Stack

* **Frontend Core:** Vanilla HTML5, CSS3 (variables, animations, glassmorphism), ES Modules (JavaScript)
* **Mobile Runtime:** [Capacitor JS](https://capacitorjs.com/) (Native Android bridge)
* **Native Android:** Java `AppWidgetProvider`, RemoteViews, Capacitor Android Plugins
* **Database:** [Supabase](https://supabase.com/) (Hosted PostgreSQL)
* **Backend API:** [Vercel Serverless Functions](https://vercel.com/) (Node.js API)
* **Push Notifications:** [Firebase Cloud Messaging (FCM)](https://firebase.google.com/)

---

## 📂 Configuration & Version Files

1. **`version.json`** *(Single Source of Truth for App Releases)*:
   ```json
   {
     "versionCode": 5,
     "versionName": "1.1.3",
     "apkUrl": "https://github.com/sid954/RoutineAPP/releases/latest/download/app-release.apk",
     "downloadUrl": "https://github.com/sid954/RoutineAPP/releases",
     "releaseNotes": "Official v1.1.3 Release",
     "minRequiredVersionCode": 1
   }
   ```

2. **`config.json`**:
   * `apiBase`: Vercel backend API URL (`https://your-app.vercel.app`).
   * `remoteAppUrl`: Hosted GitHub Pages URL (`https://sid954.github.io/RoutineAPP`).
   * `activeDays`: Day index array (`[6, 0, 1, 2, 3]` for Sat–Wed).
   * `matrixIntervals`: Daily class time slots.
   * `fullCourseNames`: Key-value map expanding abbreviation codes to full names.
   * `subjectPalettes`: Linear gradient custom color themes.

3. **`schedule.json`**:
   * Weekly scheduled classes categorized by day of the week.

---

## 🚀 Developer Setup & Workflow Commands

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Build Web Assets & Sync Native Android
Run the master sync command:
```bash
npm run sync
```
*This command executes `node build.js` (which copies web assets to `www/`, injects dynamic cache timestamps, and syncs `versionCode` & `versionName` to `android/app/build.gradle` and `src/core/config.js`), then runs `npx cap sync`.*

### 3. Open Android Studio & Compile APK
```bash
npx cap open android
```
In Android Studio:
1. Wait for Gradle sync to finish.
2. Select **Build ➔ Build Bundle(s) / APK(s) ➔ Build APK(s)** to compile your test `.apk` file!

---

## 📱 Release & Update Workflow

### How to Release a New APK Version (e.g. v1.1.4):

1. **Update `version.json`**:
   Increase `versionCode` (e.g., `6`) and `versionName` (e.g., `"1.1.4"`).
2. **Build and Sync**:
   ```bash
   npm run sync
   ```
   *This automatically updates `build.gradle` and `config.js` to version `1.1.4` (Code `6`).*
3. **Commit & Push to GitHub**:
   ```bash
   git add .
   git commit -m "Release v1.1.4"
   git push
   ```
4. **Compile APK**:
   Build the `.apk` in Android Studio and upload/attach it to your GitHub Releases link.

---

## 🔧 Database Schema (Supabase)

Create the required tables in Supabase SQL Editor using `supabase_schema.sql`:
```sql
CREATE TABLE announcements (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  target_day_idx INT,
  subject_code TEXT,
  room TEXT,
  holiday_range_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE device_tokens (
  id BIGSERIAL PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  platform TEXT DEFAULT 'android',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```
