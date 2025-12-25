# Firebase Setup Guide

Follow these steps to enable automatic cloud syncing between devices.

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: `our-love-story` (or any name you like)
4. **Disable Google Analytics** (optional, not needed for this app)
5. Click "Create project"

## Step 2: Enable Realtime Database

1. In your Firebase project, click **"Realtime Database"** in the left menu
2. Click **"Create Database"**
3. Choose location (pick closest to you, e.g., `us-central1`)
4. **Important**: Choose **"Start in test mode"** (we'll secure it later)
5. Click "Enable"

## Step 3: Enable Anonymous Authentication

1. In Firebase Console, go to **"Authentication"** in the left menu
2. Click **"Get started"**
3. Go to **"Sign-in method"** tab
4. Click on **"Anonymous"**
5. **Enable** it and click "Save"

## Step 4: Get Your Firebase Config

1. In Firebase Console, click the **gear icon** ⚙️ next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **Web icon** `</>` to add a web app
5. Register app name: `Our Love Story`
6. **Don't check** "Also set up Firebase Hosting" (we're using Vercel)
7. Click "Register app"
8. **Copy the `firebaseConfig` object** - it looks like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## Step 5: Add Config to Your Project

1. In your project folder, create a file called `.env.local`
2. Add your Firebase config values:

```bash
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com/
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Replace the values** with your actual Firebase config values.

## Step 6: Secure Your Database (Important!)

1. Go to **Realtime Database** → **Rules** tab
2. Replace the rules with this (allows authenticated users to read/write shared data):

```json
{
  "rules": {
    "shared": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

**Note:** This allows any authenticated user (anonymous or otherwise) to read/write to the shared path. Since this is a personal app for you and your girlfriend, this is fine. The data is still private to your Firebase project.

3. Click **"Publish"**

## Step 7: Install Dependencies & Test

1. Run: `npm install`
2. Run: `npm run dev`
3. Open the app - you should see **"云端同步已开启"** (Cloud sync enabled) at the top
4. Add a memory or todo on one device
5. Check another device - it should sync automatically! 🎉

## Step 8: Deploy to Vercel with Environment Variables

1. Go to your Vercel project dashboard
2. Go to **Settings** → **Environment Variables**
3. Add each Firebase config variable:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
4. **Redeploy** your app on Vercel

## Troubleshooting

- **"云端同步已开启" not showing?** Check that `.env.local` exists and has correct values
- **Data not syncing?** Check browser console for errors
- **Firebase errors?** Make sure Realtime Database and Anonymous Auth are enabled

## How It Works

- **Local First**: Data is saved to IndexedDB immediately (works offline)
- **Cloud Sync**: Data is also synced to Firebase (for cross-device sync)
- **Real-time**: Changes on one device appear on other devices automatically
- **Fallback**: If Firebase is unavailable, app works with local data only

