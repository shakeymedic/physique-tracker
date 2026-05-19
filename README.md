# Physique Tracker

A personal fitness, nutrition and routine-health tracking PWA. Installable on Android via Chrome → "Add to Home Screen".

**Stack:** React + Vite, Tailwind CSS, Firebase (Auth + Firestore + Storage), Recharts, vite-plugin-pwa, deployed on Netlify.

## What's tracked

- **Body** — weight (with 7-day rolling avg), tape measurements, body fat %
- **Training** — structured exercise log with sets/reps/RPE, Epley e1RM, session tonnage, rest timer, workout templates, per-exercise history charts
- **Nutrition** — Katch-McArdle macro calculator, daily calorie/macro log, meal templates, Spoonacular meal planner (BYO API key)
- **Routine bloods** — BP, lipids, LFTs, FBC, HbA1c, fasting glucose, eGFR — each value flagged against UK adult reference ranges
- **Medications** — prescribed medications log (name/dose/frequency/time), with "mark taken today"
- **Progress photos** — front/side/back uploads, side-by-side comparison
- **Planner** — recurring or one-off tasks/habits that feed today's checklist
- **AI coach** — chat with Gemini for training/nutrition guidance (BYO API key)

> **This is not a medical device.** Reference ranges and any AI guidance are general information only — interpret with your doctor.

## Local setup

### 1. Install
```bash
git clone https://github.com/<you>/physique-tracker.git
cd physique-tracker
npm install
```

### 2. Create a Firebase project

1. Go to https://console.firebase.google.com and **Add project**. Region close to UK (`europe-west2` for Firestore is fine).
2. In **Build → Authentication**, enable the **Google** provider.
3. In **Build → Firestore Database**, create a database in production mode (Europe region).
4. In **Build → Storage**, create a bucket (Europe region).
5. In **Project settings → Your apps**, register a new **Web** app. Copy the `firebaseConfig` values.

### 3. Configure environment

Copy the example and fill in your values:
```bash
cp .env.example .env.local
```
Edit `.env.local` so each `VITE_FIREBASE_*` variable matches your Firebase config.

### 4. Deploy security rules

In the Firebase console, paste the contents of `firestore.rules` into **Firestore → Rules** and publish, and `storage.rules` into **Storage → Rules** and publish. These restrict reads/writes to the authenticated owner.

### 5. Run

```bash
npm run dev
```

Open the local URL, sign in with Google, start logging.

## Deploy to Netlify

This repo connects directly:
1. Push to GitHub
2. In Netlify, **Add new site → Import an existing project → GitHub**
3. Build command: `npm run build`, publish directory: `dist`
4. Add the `VITE_FIREBASE_*` env vars in **Site settings → Environment variables**
5. In Firebase console → Authentication → Settings → Authorized domains, add your Netlify domain

## Install on Android

Open the deployed site in Chrome → menu → **Add to Home screen**. Launches as a standalone app and works offline once cached.

## Export your data

Settings → **Export data as CSV** dumps every collection. Useful for backups or sharing with your GP.

## Tech notes

- All Firestore data is namespaced under `users/{uid}/...` and protected by the rules in `firestore.rules`. No-one but you can read or write your data.
- API keys for Spoonacular and Gemini are stored in your private Firestore settings doc — they never leave your project.
- Photos are uploaded to Firebase Storage under `users/{uid}/photos/...`.
