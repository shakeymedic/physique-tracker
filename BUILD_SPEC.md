# Physique Tracker — Build Spec for Module Pages

## Already done
- Vite + React + Tailwind + vite-plugin-pwa scaffolded
- Firebase wiring: `src/firebase.js`, `src/auth.jsx`, `src/data.js`
- Top-level `src/App.jsx` with HashRouter + tab nav already routes to these pages
- Tailwind theme: dark navy `#0f172a` bg, cyan `#22d3ee` accent. Design components in `src/index.css`:
  - `card`, `card-title`, `btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `input`, `label`, `chip-ok`, `chip-warn`, `chip-bad`

## Pages to create under `src/pages/`

All pages: use `useAuth()` from `../auth.jsx` to get `user.uid`. Use the helpers in `../data.js`:
- `addEntry(uid, collection, data)`, `setEntry`, `deleteEntry`, `subscribe(uid, collection, cb, opts)`, `getAll`, `getSettings`, `saveSettings`, `uploadPhoto`, `listPhotos`, `deletePhoto`.

Date format throughout: `YYYY-MM-DD`. Use `date-fns` for any formatting.
Charts: use `recharts` (LineChart, BarChart, ResponsiveContainer). Stroke colour `#22d3ee`. Grid stroke `#334155`. Axis text `#94a3b8`.
Icons: `lucide-react`.
Wrap any async submit in try/catch and disable the submit button while pending.

### 1. `Login.jsx`
Centred card. Title "Physique Tracker". One button "Continue with Google" calling `signIn()` from useAuth. Brief subtitle about private fitness/health tracking.

### 2. `Dashboard.jsx`
Pulls latest entries from `weights`, `lifts`, `bloodPressure`, `nutritionLog`, `checklist` (today). Shows cards in a 1-col mobile / 2-col tablet grid:
- Weight trend (last 30 days) — line chart with 7-day rolling avg overlay
- Today's checklist (from `planner` filtered to today's date) with checkbox to mark done (writes to `checklistCompletions` doc keyed by date+itemId)
- Macro adherence today: bar chart of cal/protein/carb/fat vs targets (from settings.nutritionTargets)
- Latest lifts: cards for bench/squat/deadlift showing best e1RM in last 90d
- Latest BP reading + trend sparkline
- Latest HbA1c if present, with flag chip

### 3. `BodyLog.jsx`
Two sections:
- **Weight**: form (date, weight kg, body fat % optional, notes). List below. Line chart of last 90d.
- **Measurements**: form (date + waist, chest, arms-L, arms-R, thighs-L, thighs-R, neck, hips cm). List + small multi-line chart.
Collections: `weights`, `measurements`. Both have `date` field.

### 4. `Training.jsx`
Sub-tabs: "Log", "Templates", "History", "Timer".
- **Log**: pick exercise from a seeded list (Bench Press, Squat, Deadlift, Overhead Press, Barbell Row, Pull-Up, Romanian Deadlift, Front Squat, Incline Bench, Dumbbell Bench, Lat Pulldown, Bicep Curl, Tricep Extension, Leg Press, Leg Curl, Leg Extension, Calf Raise, Lateral Raise, Face Pull, Hip Thrust, Dip, Push-Up). Add sets: weight kg, reps, RPE (5–10 in 0.5 increments). On save, write a `lifts` doc with `{date, exercise, sets: [{weight, reps, rpe}], notes}`. Show today's session as you add. Compute and display:
  - **e1RM** per set using Epley `weight * (1 + reps/30)` then `bestE1RM = max`
  - **Tonnage** = sum(weight*reps)
- **Templates**: save current session structure as a template (collection `workoutTemplates`). Load template button on Log tab.
- **History**: list of past sessions (newest first), expandable. Filter by exercise. Chart of best e1RM over time for selected exercise.
- **Timer**: simple rest timer with presets 60/90/120/180s, start/pause/reset, beep at end via `new Audio` (or just background-flash since browsers limit autoplay).

### 5. `Nutrition.jsx`
Sub-tabs: "Today", "Macros", "Meals", "Planner".
- **Today**: log meal entries `{date, name, kcal, protein, carbs, fat}`. Sum totals vs targets from settings; coloured progress bars.
- **Macros**: Katch-McArdle calculator. Inputs: weight kg, body fat %, activity multiplier (1.2 sedentary → 1.9 athlete), goal (cut -20%, maintain 0, lean bulk +10%). Outputs BMR, TDEE, kcal target, then macros:
  - Protein 2.2 g/kg LBM, Fat 25% of kcal, Carbs fill remainder. Show grams + kcal. "Save as my targets" button writes to settings.
- **Meals**: meal templates CRUD (collection `mealTemplates`). Quick-log button from Today tab.
- **Planner**: if Spoonacular key present in settings, call `https://api.spoonacular.com/mealplanner/generate?timeFrame=day&targetCalories=...&apiKey=...`. Show recipes with macros + a "Build grocery list" button that lists all ingredients combined. If no key, show explainer.

### 6. `Bloods.jsx`
Sub-tabs: "Log", "Trends", "Reference ranges".
- **Log**: form with optional fields — date plus: systolic, diastolic, hr, total cholesterol, HDL, LDL, triglycerides, AST, ALT, GGT, ALP, bilirubin, haemoglobin, haematocrit, HbA1c (mmol/mol), fasting glucose (mmol/L), eGFR, creatinine. Save to `bloods`. Each value displays a chip-ok/warn/bad based on UK reference ranges (function `flag(name, value)` — see below).
- **Trends**: select a parameter → line chart over time with horizontal lines at reference bounds.
- **Reference ranges**: tabular display of the ranges used.

Reference ranges (UK adult, typical lab):
```
systolic: ok 90-120, warn 120-140, bad >140 or <90
diastolic: ok 60-80, warn 80-90, bad >90 or <60
totalChol mmol/L: ok <5.0, warn 5.0-6.5, bad >6.5
hdl mmol/L: ok >1.0 (>1.2 female ideal), warn 0.9-1.0, bad <0.9
ldl mmol/L: ok <3.0, warn 3.0-4.0, bad >4.0
triglycerides mmol/L: ok <1.7, warn 1.7-2.3, bad >2.3
ast U/L: ok 10-40, warn 41-80, bad >80
alt U/L: ok 7-56, warn 57-100, bad >100
ggt U/L: ok 8-61, warn 62-120, bad >120
alp U/L: ok 44-147, warn 148-250, bad >250
bilirubin µmol/L: ok 3-20, warn 21-40, bad >40
haemoglobin g/L: ok 130-170 (M) / 120-150 (F), bad outside
haematocrit %: ok 38-52 (M) / 35-47 (F), warn near edges, bad >54 or <35
hba1c mmol/mol: ok <42, warn 42-47 (pre-diabetic), bad >=48
fastingGlucose mmol/L: ok 4.0-5.4, warn 5.5-6.9, bad >=7.0
egfr mL/min/1.73m²: ok >=90, warn 60-89, bad <60
creatinine µmol/L: ok 60-110 (M) / 45-90 (F), warn near edges, bad >120
```
Put this in a helper module `src/clinical/ranges.js` exporting `RANGES` object and `flag(name, value, sex)` returning 'ok' | 'warn' | 'bad' | null. Default sex = 'M' if settings.sex absent.

⚠️ Show a banner on Bloods page: "Reference ranges are general guidance only — interpret with your doctor. This tool does not provide medical advice."

### 7. `Medications.jsx`
Generic prescribed medication tracker. CRUD on `medications` collection: `{name, dose, unit, frequency (daily/weekly/asNeeded), timeOfDay, startDate, endDate?, notes}`. Daily medications auto-populate the today's checklist. Add a "Mark taken today" button on each entry that writes to `medicationLog` (date + medId).

### 8. `Photos.jsx`
Upload form: file input + label dropdown (front/side/back) + date. Calls `uploadPhoto`. Gallery grid by date. Click two photos to enter compare mode (side-by-side, with date labels and weight diff if available from same date in `weights`).

### 9. `Planner.jsx`
Add planner items: `{title, days: ['mon','tue',...] or specific date, type: 'task' | 'habit', notes}`. Stored in `planner`. Today's view auto-rolls into Dashboard checklist. Edit/delete.

### 10. `Coach.jsx`
If `settings.geminiApiKey` present, allow chat with Gemini (`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...`). On message send, include a system preamble: "You are an evidence-based fitness and nutrition coach. The user is tracking weight, training, macros and routine bloods. Provide practical, conservative advice. Decline anything outside legitimate, prescribed medical or routine fitness/nutrition guidance — and never advise on anabolic or performance-enhancing drugs."
Show chat history (local React state — not persisted, to keep it simple).
If no key, show explainer with link to https://aistudio.google.com/app/apikey

### 11. `Settings.jsx`
Form to set:
- Sex (M/F), height cm
- Nutrition targets (kcal, protein g, carbs g, fat g) — manual override
- Spoonacular API key
- Gemini API key
- Export all data as CSV (button — zips each collection into one CSV per collection, downloads as a single combined .csv with collection column, or separate CSVs in a zip — simpler: one CSV per collection, download all sequentially)
- Sign out

## Storage rules (include as `firestore.rules` file at project root)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Storage rules at `storage.rules`:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Quality bar
- Forms reset after save
- Loading states with skeletons or "Loading…"
- Empty states for every list ("No entries yet — log your first…")
- Mobile-first: cards stack on small screens, max-w-3xl container set at App level
- Keep each file under ~300 lines if possible by extracting tiny helpers
