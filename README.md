# 📚 My Routine — Smart Timetable Dashboard

**My Routine** is a university timetable dashboard PWA and hybrid Android app featuring live class progress tracking, a weekly agenda matrix, and a real-time announcement system powered by push notifications.

---

## ✨ Features

* **Live Class Dashboard:** Shows the current class, remaining time/progress bar, and the next upcoming class.
* **Interactive Weekly Matrix:** Dynamic timetable grid view for desktop and card slider for mobile.
* **Announcement Board:** Anyone can post announcements with a shared authentication password.
* **FCM Push Notifications:** Triggers native push notifications on Android when a new announcement is posted.
* **Capacitor Integration:** Ready to compile as a native Android app.
* **Decoupled Settings:** Dynamic Active Days, intervals, subjects, and colors loaded from a simple configuration file.

---

## 🛠️ Tech Stack

* **Frontend:** Vanilla HTML5, CSS3 (variables, animations), ES6 JavaScript
* **Mobile Runtime:** [Capacitor JS](https://capacitorjs.com/) (Native Android bridge)
* **Database:** [Supabase](https://supabase.com/) (Hosted PostgreSQL)
* **Backend API:** [Vercel Serverless Functions](https://vercel.com/) (Node.js API)
* **Push Notifications:** [Firebase Cloud Messaging (FCM)](https://firebase.google.com/)

---

## 📂 Configuration Files

The app relies on two main files to configure the schedule dynamically without modifying JavaScript code:

1. **`config.json`**:
   * `apiBase`: URL of the deployed Vercel backend (e.g. `https://your-app.vercel.app`).
   * `activeDays`: Day index array (e.g., `[6, 0, 1, 2, 3]` for Sat–Wed).
   * `matrixIntervals`: Daily class time slots.
   * `fullCourseNames`: Key-value map expanding abbreviation codes to full names.
   * `subjectPalettes`: Linear gradient custom colors for cards.

2. **`schedule.json`**:
   * The list of scheduled classes categorized by day of the week.

---

## 🚀 Developer Setup Guide

To run this project locally or configure it for your own university schedule, follow these steps:

### 1. Prerequisite Installations
Ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v18+)
* [Android Studio](https://developer.android.com/studio) (for Android compilation)

### 2. Install Project Dependencies
Clone the repository and install dependencies:
```bash
npm install
```

### 3. Database Configuration (Supabase)
1. Register a free project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** tab in Supabase, copy the schema commands from `supabase_schema.sql` in the project root, and click **Run**. This will create the required `announcements` and `device_tokens` tables.
3. Under **Project Settings ➔ API**, note down your **Project URL** and **`service_role` Secret API Key**.

### 4. Push Server Setup (Firebase FCM)
1. Open the [Firebase Console](https://console.firebase.google.com) and click **Add Project**.
2. Register an Android Application with the package name: `com.routine.app`.
3. Download the **`google-services.json`** file and place it inside:
   ```path
   android/app/google-services.json
   ```
4. In Firebase project settings, navigate to **Service Accounts**, click **Generate New Private Key**, and download the JSON credentials.

### 5. Serverless Backend Configuration (Vercel)
1. Deploy your repository to [Vercel](https://vercel.com) (free account).
2. In the Vercel dashboard, add the following **Environment Variables**:
   * `SUPABASE_URL` = (Your Supabase Project URL)
   * `SUPABASE_SERVICE_ROLE_KEY` = (Your Supabase Service Role Key)
   * `FIREBASE_PROJECT_ID` = (From Firebase service account credentials JSON)
   * `FIREBASE_CLIENT_EMAIL` = (From Firebase service account credentials JSON)
   * `FIREBASE_PRIVATE_KEY` = (From Firebase service account credentials JSON, keeping the private key multiline formatting)
   * `ANNOUNCEMENT_PASSWORD` = `test123` (or your custom password)
3. Deploy the project. Note down the Vercel deployment URL (e.g. `https://routine-app-backend.vercel.app`).
4. Update `apiBase` in `config.json` with your backend URL.

---

## 📱 Compiling the Android App

Once the configuration and `google-services.json` are ready:

1. Build web assets and sync Capacitor:
   ```bash
   npm run sync
   ```
2. Open the project in Android Studio:
   ```bash
   npx cap open android
   ```
3. Wait for Gradle sync to complete in Android Studio.
4. Go to **Build ➔ Build Bundle(s) / APK(s) ➔ Build APK(s)** to compile your test `.apk` file!
