# Physique Tracker v2 — Improvement Spec

This document specifies improvements to apply on top of the existing app at /home/user/workspace/physique-tracker. Read the existing code thoroughly before changing anything. Maintain the existing patterns (Tailwind, lucide-react, recharts, react-router-dom HashRouter, Firebase via src/data.js helpers).

## Conventions
- All Firestore writes go through `src/data.js` helpers
- All Tailwind classes already configured. Existing component classes: `card`, `card-title`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `input`, `label`, `chip-ok`/`chip-warn`/`chip-bad`
- Theme colours: `bg`, `surface`, `surfaceAlt`, `border`, `text`, `muted`, `accent`, `success`, `warn`, `danger`
- Date format: `YYYY-MM-DD`. Use date-fns.
- Charts: recharts. Stroke `#22d3ee`, grid `#334155`, axis text `#94a3b8`.
- Icons: lucide-react

---

## 1. TODAY HOME TAB (new — replaces Dashboard as the default route)

Replace the existing Dashboard with a more focused "Today" view. Create new `src/pages/Today.jsx` and update routing in App.jsx so `/` → Today and `/dashboard` → Dashboard (renamed to "Insights").

**Today layout (single column on mobile, 2-col on md+):**
- **Greeting card**: "Good morning/afternoon/evening, {firstName}." + today's date + the daily motivational quote (Item 6).
- **Quick weight log**: small inline form — date defaults to today, weight kg input, optional bf%, Save button. After save, the value appears below as today's logged weight.
- **Macros so far today**: 4 mini progress bars (kcal, P, C, F vs targets) + "Log meal" button → routes to /nutrition.
- **Today's checklist**: pulls from `planner` (filtered to today by repeat-days or matching specific date) AND from `medications` (any daily meds + any weekly meds whose `dueToday` returns true — see item 3). Each item has a toggle. Toggling writes to `checklistCompletions/{date}_{itemId}`.
- **Weekly meds badge**: any weekly med due today shows with a coloured chip. Mounjaro etc.
- **PRs today** (item 12): if any new e1RM PR was achieved in today's training session, show a "🏆 New PR" card.

Update App.jsx tab nav: add "Today" as first tab, change "Dashboard" to "Insights".

## 2. DASHBOARD GOAL PANEL

In the renamed Insights page (formerly Dashboard.jsx), add a new top card "Goal Tracker":
- Reads `settings.goal` ({ type, rateKgPerWeek, targetWeight })
- Shows: current weight (latest from `weights`), starting weight (oldest in last 90d or settings.startWeight), target weight, projected ETA (based on rateKgPerWeek)
- Visual: weight trend line chart (last 90d) with two overlay lines:
  - 7-day rolling average (already exists)
  - **Target trajectory** (new): straight line from start weight to target weight at the rateKgPerWeek rate, drawn from start date to ETA
- Below the chart: a panel showing actual vs target weekly rate:
  - "Last 7 days: lost 0.8 kg · Target: 0.5 kg · Status: ✅ On track" (or ⚠ behind / 📈 ahead)
  - Compute actual rate from last 14 days of weight data (linear regression slope * 7)

## 3. WEEKLY MEDS "DUE TODAY" LOGIC

In `src/data.js` or a new `src/clinical/meds.js`, add:
```js
export function isMedDueToday(med, today, lastTaken) {
  // med.frequency: 'daily' | 'weekly' | 'asNeeded'
  // If daily: due if not already taken today (check medicationLog for today)
  // If weekly: due if !lastTaken OR (today - lastTaken) >= 7 days
  // If asNeeded: never auto-due
}
```
Use this in Today tab to highlight weekly meds that are due. Also surface on Medications page.

## 4. BARCODE SCANNER + OPEN FOOD FACTS

Add a "Scan Barcode" button on Nutrition → Today tab and Meals tab.

Use the already-installed `html5-qrcode` package.

Flow:
1. Click scan → camera modal opens
2. Scan barcode (EAN-13/UPC-A)
3. Lookup at `https://world.openfoodfacts.org/api/v2/product/{barcode}.json`
4. Parse `nutriments` (energy-kcal_100g, proteins_100g, carbohydrates_100g, fat_100g)
5. Prompt user for portion size in grams (default 100g)
6. Pre-fill the meal log form with name + scaled macros
7. User confirms → save

Create new file `src/components/BarcodeScanner.jsx` exporting a component:
```jsx
<BarcodeScanner open={open} onClose={...} onResult={({name, kcal, protein, carbs, fat, barcode}) => ...} />
```

Permission handling: if camera permission denied, show clear error and a "Enter barcode manually" fallback input.

Also add: ability to save the scanned product as a meal template for future quick-logging.

## 5. DARK/LIGHT THEME TOGGLE

Create `src/theme.jsx` ThemeProvider:
- Reads from `localStorage.theme` (default 'dark')
- Toggles `dark` class on `<html>`
- Provides `useTheme()` hook with `{ theme, setTheme }`

Update tailwind.config.js:
- Add `darkMode: 'class'`
- Refactor existing colours into CSS variables OR add a `light:` variant set

Simpler approach: keep existing dark theme as default, add a `:root.light { ... }` block in index.css overriding the CSS-variable equivalents of the named colours. Update `tailwind.config.js` to map theme.colors to those CSS variables.

Actually simplest pragmatic approach (do this):
- Keep dark theme as Tailwind config
- For light mode, add a CSS rule set in index.css: `html.light body { background: #f8fafc; color: #0f172a; } html.light .bg-bg { background: #f8fafc; } html.light .bg-surface { background: #ffffff; } etc.` — override all the relevant bg/text utilities

Add a sun/moon toggle button in the header next to the sign-out button.

## 6. DAILY MOTIVATIONAL QUOTE

Create `src/lib/quotes.js`:
```js
export const QUOTES = [
  'Action precedes motivation.',
  'Consistency beats intensity.',
  'The hard days build you.',
  'Small steps. Every day.',
  'Track it. Improve it.',
  'Do the work.',
  'Show up. Then show out.',
  // 20+ quotes
];
export function quoteOfTheDay() {
  return QUOTES[new Date().getDate() % QUOTES.length];
}
```

Display on Today tab greeting card. Italic, muted colour.

## 7. VOICE DICTATION (Web Speech API)

Add a microphone button next to text inputs on:
- Training Log → exercise notes
- Nutrition Today → meal name

Use Web Speech API:
```js
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const rec = new SR();
rec.lang = 'en-GB';
rec.continuous = false;
rec.interimResults = false;
rec.onresult = (e) => setNotes(e.results[0][0].transcript);
```

Create `src/components/MicButton.jsx` exporting `<MicButton onTranscript={text => ...} />` — handles unsupported browsers (button hidden) and listening state (pulse animation).

## 8. MUSCLE GROUP HEATMAP

Build a structured exercise → muscle mapping. Create `src/clinical/exercises.js` (rename to `src/training/exercises.js`):

```js
export const EXERCISES = [
  { name: 'Bench Press', primary: ['Chest'], secondary: ['Triceps', 'Shoulders'] },
  { name: 'Squat', primary: ['Quads', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
  { name: 'Deadlift', primary: ['Hamstrings', 'Glutes', 'Back'], secondary: ['Forearms', 'Core'] },
  // ... cover the existing seeded list (Bench/Squat/Deadlift/OHP/BBR/Pulls/RDL/Front Sq/Incline/DB Bench/Lat PD/Bicep/Tricep/Leg Press/Leg Curl/Leg Ext/Calf/Lateral Raise/Face Pull/Hip Thrust/Dip/Push-Up)
];
```

Add a "Recovery" sub-tab to Training. Show a body-region grid:
- 9 regions: Chest, Back, Shoulders, Biceps, Triceps, Forearms, Quads, Hamstrings, Glutes, Calves, Core
- For each, compute days since last trained (from `lifts` collection, mapping exercise → muscles)
- Colour scale: red (trained today, 0 days = fatigued), orange (1d), yellow (2d), green (3-5d, recovered), grey (6+ days, undertrained)

Layout: a stylised SVG body diagram with the regions clickable, OR a simple 11-tile grid with labels. Pick the simpler tile grid — easier to maintain.

Also surface on Today tab: "Recovered & ready: Chest, Back. Still fatigued: Quads."

## 9. WEIGHT-LOSS PROJECTION CHART

(Covered in item 2 — same chart with target trajectory overlay.)

Make sure the chart in Today (compact) and Insights (detailed) both share this trajectory rendering. Extract into `src/components/WeightChart.jsx`.

## 10. REFEED DAY / DIET BREAK

In Nutrition → Today tab, add a small panel "Diet adherence":
- Button: "Today is a refeed day" → temporarily overrides targets to maintenance (TDEE) for today only
- Writes to `dietBreaks/{date}` with type 'refeed'
- Macros target on dashboard for that date shows maintenance kcal and a chip "Refeed day"

Also: "Diet break (1 week)" button → sets dietBreaks for next 7 days

Today's macro calculations should check for an active diet break and use maintenance kcal instead of the deficit.

## 11. UK MEAL TEMPLATES SEEDER

In Settings, add a button "Seed UK meal templates" that creates these meal templates (only if not already present):

```js
const SEED_MEALS = [
  { name: 'Porridge with banana', kcal: 380, protein: 14, carbs: 60, fat: 8 },
  { name: 'Greek yoghurt with berries', kcal: 220, protein: 22, carbs: 18, fat: 6 },
  { name: 'Eggs on toast (2 eggs, 2 slices)', kcal: 380, protein: 22, carbs: 32, fat: 18 },
  { name: 'Chicken & rice bowl', kcal: 550, protein: 45, carbs: 60, fat: 12 },
  { name: 'Tuna jacket potato', kcal: 480, protein: 30, carbs: 65, fat: 8 },
  { name: 'Salmon, sweet potato, broccoli', kcal: 560, protein: 38, carbs: 45, fat: 22 },
  { name: 'Chicken pasta', kcal: 600, protein: 42, carbs: 75, fat: 12 },
  { name: 'Beef stir fry & noodles', kcal: 620, protein: 38, carbs: 70, fat: 18 },
  { name: 'Protein shake (whey + milk)', kcal: 250, protein: 32, carbs: 14, fat: 6 },
  { name: 'Peanut butter on toast', kcal: 320, protein: 12, carbs: 30, fat: 18 },
  { name: 'Apple + almonds (30g)', kcal: 260, protein: 7, carbs: 22, fat: 16 },
  { name: 'Chicken Caesar salad', kcal: 420, protein: 38, carbs: 12, fat: 24 },
];
```

## 12. PR BADGES

When saving a training session in Training.jsx, compare each exercise's max e1RM in the new session vs. all-time best from history. If new > old, mark the session entry with `prs: ['Bench Press', ...]`.

- Show 🏆 badge on session history cards
- Show "🏆 PR — Bench Press 102.5 kg" on Today tab on the day a PR happened
- Add a "Personal Records" card on Insights showing all-time best e1RM per exercise

## 13. PHOTO TIMELINE WITH WEIGHT OVERLAY

Update Photos.jsx to add a "Timeline" view (sub-tab alongside Gallery and Compare):
- Photos sorted chronologically
- For each photo's date, lookup the closest weight reading from `weights` collection
- Display as horizontally-scrolling strip: small thumbnails with date + weight label below
- Click a thumbnail to enlarge

## 14. GOOGLE DRIVE BACKUP

Add a "Backup to Google Drive" button on Settings.

Implementation: use the user's existing google_drive connector. But the connector is server-side; the app is client-side. So instead:

**Use Google Identity Services + Drive API directly:**
- Already authenticated via Firebase Google sign-in → request additional scope `https://www.googleapis.com/auth/drive.file` on demand
- Use `gapi.client.drive` to create/update a single JSON file `physique-tracker-backup.json` in the user's Drive

Add `src/lib/drive.js`:
```js
export async function backupToDrive(allData) {
  // 1. Get OAuth token with drive.file scope (incremental auth via Google Identity Services)
  // 2. POST to https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
  // 3. Or update existing file if backup metadata stored in settings.driveBackupFileId
}
```

Settings tab:
- Button: "Back up now" → exports all collections as one JSON file → uploads to Drive
- Show last backup timestamp from `settings.lastDriveBackup`
- Optional: "Auto-backup weekly" toggle (sets a flag; actual scheduling depends on if user opens the app weekly, since web app can't background-run)

This is complex; if it proves too fiddly, fall back to **CSV download as zip** button instead and note in code that proper Drive sync requires future native wrapper.

## 15. PUSH NOTIFICATIONS (Firebase Cloud Messaging)

Wire FCM:

1. In Firebase console, generate Web Push certificate (VAPID key) — user has to do this manually; document in README
2. Create `src/lib/messaging.js`:
   ```js
   import { getMessaging, getToken, onMessage } from 'firebase/messaging';
   export async function requestNotificationPermission(vapidKey) {
     const messaging = getMessaging(app);
     const perm = await Notification.requestPermission();
     if (perm !== 'granted') return null;
     const token = await getToken(messaging, { vapidKey });
     await saveSettings(uid, { fcmToken: token });
     return token;
   }
   ```
3. Add `firebase-messaging-sw.js` in `/public/` — minimal SW with `firebase.messaging` setup
4. Settings: "Enable push notifications" toggle. On enable, calls requestNotificationPermission with VAPID key from env (`VITE_FIREBASE_VAPID_KEY`)
5. In-app: when toggle on, show note "Test push" button

NOTE: actually SENDING the notifications requires a server (Cloud Functions). Without that, this is just a "ready to receive" setup. Document this limitation in the Settings UI: "Push notifications are set up but require a backend to send reminders. Daily reminders coming in v3 — for now, the in-app checklist serves as your reminder."

Add an environment variable `VITE_FIREBASE_VAPID_KEY` to `.env.example` and document in README.

If the VAPID key isn't configured, the toggle is disabled with a tooltip "Configure VITE_FIREBASE_VAPID_KEY".

## 16. MULTI-DEVICE SYNC + UPDATE TOAST

Already works via Firestore real-time. Add:

1. **"New version available" toast** when the service worker has a new version:
   - In `main.jsx`, register a custom service worker update handler via vite-plugin-pwa's `registerType: 'autoUpdate'` (already set) but add the `onNeedRefresh` callback
   - Create `src/components/UpdateToast.jsx` that shows a bottom toast: "A new version is available. [Refresh]"
   - When user clicks Refresh: skipWaiting + reload

2. Add a small "Synced" indicator on the header (cloud icon, accent colour when Firestore is connected, danger when offline)
   - Use Firestore's `onSnapshot` connection state OR navigator.onLine

---

## Header layout update

Header now needs to fit:
- App logo + name
- Theme toggle (sun/moon)
- Sync indicator (cloud icon)
- Sign-out button

Tab strip needs to scroll horizontally on narrow screens but show all tabs on desktop. Order:
**Today → Insights → Body → Training → Nutrition → Bloods → Meds → Photos → Planner → Coach → Settings**

That's 11 tabs. Use icons-only on screens < md, icon+label on md+. Or make the tab bar scrollable as it is, just ensure first tab "Today" is sticky-left.

---

## Files to create
- src/pages/Today.jsx
- src/components/BarcodeScanner.jsx
- src/components/MicButton.jsx
- src/components/WeightChart.jsx
- src/components/UpdateToast.jsx
- src/theme.jsx
- src/lib/quotes.js
- src/lib/openfoodfacts.js
- src/lib/messaging.js
- src/lib/drive.js
- src/clinical/meds.js (med due logic)
- src/training/exercises.js (exercise→muscle mapping)
- public/firebase-messaging-sw.js

## Files to modify
- src/App.jsx (add Today route, header changes, theme toggle, update toast, sync indicator)
- src/main.jsx (ThemeProvider wrap, registerSW callback)
- src/pages/Dashboard.jsx (rename header to "Insights", add goal panel)
- src/pages/Nutrition.jsx (barcode button, diet-break panel, voice dictation)
- src/pages/Training.jsx (Recovery sub-tab, PR detection, voice dictation)
- src/pages/Medications.jsx (use isMedDueToday helper)
- src/pages/Photos.jsx (timeline sub-tab)
- src/pages/Settings.jsx (seed meals button, push toggle, drive backup, theme already in header)
- src/index.css (light theme CSS overrides)
- tailwind.config.js (darkMode: 'class' if needed)
- .env.example (VAPID key)
- README.md (FCM setup notes)

## Build & verify
After all changes:
```
cd /home/user/workspace/physique-tracker && npm run build
```
Must complete without errors. Fix any until clean.

DO NOT push to git or deploy — the parent will do that.
