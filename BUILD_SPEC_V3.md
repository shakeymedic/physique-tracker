# Physique Tracker v3 — Feature Expansion Spec

This document specifies v3 improvements layered on top of v2. Read existing code thoroughly before editing — the current architecture is in `src/`. All collections go through `src/data.js` helpers. Tailwind/recharts/lucide-react patterns are established. Mobile-first.

NEW DEPENDENCIES already considered — use what's already installed. No new npm packages.

---

## 1. CARDIO IN TRAINING TRACKER

### Data model
Add a new Firestore collection `cardio` (separate from `lifts`):
```js
{
  date: 'YYYY-MM-DD',
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null,  // optional
  type: 'Running' | 'Cycling' | 'Walking' | 'Rowing' | 'Swimming' | 'Elliptical' | 'Stair Climber' | 'HIIT' | 'Spin' | 'Other',
  durationMin: number,
  distanceKm: number | null,
  avgHr: number | null,
  maxHr: number | null,
  kcal: number | null,
  rpe: number | null,        // 1-10
  notes: string,
  createdAt: timestamp,
}
```

### UI changes — Training page
Add a new sub-tab between "Log" and "Templates": **"Cardio"**.

Cardio tab UI:
- Form: Date | Time of day (select) | Type (select from above list) | Duration (min) | Distance (km, optional) | Avg HR | Max HR | Calories | RPE 1-10 | Notes
- Save as `cardio` entry
- Below form: scrollable history of past 30 cardio sessions, each EDITABLE (click → opens form populated with that session)
- Each row: delete button

Also add cardio sessions to the **History** sub-tab merged with lift sessions — sorted by date, distinguished by an icon (Dumbbell for lifts, HeartPulse for cardio).

### Update exercise→muscle mapping
Add cardio "muscle group" recovery effect to `src/training/exercises.js`:
- Running, Cycling → Quads, Hamstrings, Calves (light fatigue, ~1 day recovery)
- Rowing → Back, Biceps, Legs, Core
- Swimming → Shoulders, Back, Core
- HIIT → Full body, 2 days
Add these so the Recovery heatmap reflects cardio too.

### Update Today.jsx PR/recovery panel
Add a line: "Cardio this week: X sessions / Y km" if any cardio logged this week.

---

## 2. MACRO PROGRESS BARS — VERIFICATION & POLISH

The bars already exist in both Today.jsx and Nutrition.jsx but the user says they aren't filling. Make sure:

- If `nutritionTargets` are not set in settings, show a helpful empty state: "Set your macro targets in Nutrition → Macros to see progress bars" instead of bars at 0%
- On Nutrition Today tab, after logging a meal, the bars MUST recompute (they should via the realtime `subscribe` already in place — verify and fix any stale-state bug)
- On the Today (home) tab, ditto
- Add a number above the bar showing percent (e.g. "73%") in addition to the existing "actual / target" line

Also: when bars hit 100% turn them green; over 110% red; under 80% accent (current behaviour is close but tighten thresholds).

---

## 3. EXERCISE GOAL TRACKING

### Settings → new section "Activity goals"
Add to settings:
```js
activityGoals: {
  gymPerWeek: 3,           // sessions
  cardioPerWeek: 2,        // sessions
  cardioMinutesPerWeek: 90,
  stepsPerDay: 8000,       // optional (no step tracking — manual log later)
  selfCarePerWeek: 5,      // see Self-Care section below
}
```

Show goals as inputs in Settings.

### Display on Today + Insights pages
On Today tab, new card "This Week" showing for each goal:
- Sessions logged this week vs goal (e.g. "Gym 2/3 ✓")
- Progress ring or bar
- Colour: green if hit, accent if in progress, muted if at 0
- Click → routes to relevant tab

On Insights, larger version with last 4 weeks history.

---

## 4. MOOD AND SYMPTOM TRACKER

### Data model
New collection `wellbeing`:
```js
{
  date: 'YYYY-MM-DD',
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null,
  mood: 1-5,                            // 1=very low, 5=excellent
  energy: 1-5,
  sleep: 1-5,                           // quality
  stress: 1-5,
  symptoms: ['nausea', 'headache', ...],  // multi-select free + preset chips
  notes: string,
  createdAt: timestamp,
}
```

Preset symptom chips (tappable, multi-select):
- Nausea, Headache, Fatigue, Insomnia, Anxiety, Low mood, Heartburn, Dizziness, Joint pain, GI upset, Brain fog, Bloating, Cravings, Hunger, Other

### New tab: "Wellbeing" (place between Bloods and Meds in the nav)
- Quick log: 5-point selector for each metric (radio-style buttons, emoji-flavoured: 😞 😐 🙂 😊 🤩)
- Symptom chip selector
- Save → `wellbeing` collection

### Trends sub-tab
- Line chart over last 30/60/90 days for each metric
- **Overlay options** (multi-select):
  - "Show medications taken" → vertical markers on chart for each med dose
  - "Show training days" → markers
  - "Show weight" → secondary Y axis
- Filterable symptom timeline (chronological list of "today: nausea, headache" entries)

### Surface on Today
Compact "How are you today?" card with 5-emoji mood picker. One tap saves mood + opens a "More details?" expand for energy/sleep/symptoms/notes.

---

## 5. TIME-OF-DAY FOR EXERCISE AND FOOD

### Lifts / Cardio / Meals all get a new optional field
`timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | null`

Convention:
- morning: before noon
- afternoon: 12-17
- evening: 17-21
- night: 21+

Add to all forms (lift Log, Cardio Log, meal Log on Nutrition Today). Default by current clock time but editable.

History views and meals/sessions lists should show the time-of-day as a small chip.

---

## 6. BADGES + CONSISTENCY REWARDS

### Data model
Compute on the fly from existing collections. Define in a new file `src/lib/achievements.js`:

```js
export function computeAchievements({ weights, lifts, cardio, nutritionLog, medicationLog, wellbeing, settings }) {
  // Returns:
  // {
  //   streaks: {
  //     weighIn: { current: 5, longest: 12 },     // consecutive days with a weight entry
  //     mealsLogged: { current: 3, longest: 21 },
  //     gymWeeks: { current: 2, longest: 8 },     // consecutive weeks hitting gym goal
  //     ...
  //   },
  //   badges: [
  //     { id: 'first-weigh', name: 'First Step', earned: true, date: 'YYYY-MM-DD', icon: 'Scale' },
  //     { id: 'week-warrior', name: 'Week Warrior', earned: true, ...},
  //     { id: 'gym-goal-met-4w', name: 'Consistent Lifter', earned: false, progress: 0.75 },
  //     ...
  //   ]
  // }
}
```

### Badge definitions (15 to start)
1. **First Step** — log first weight
2. **Week Warrior** — 7-day weigh-in streak
3. **Month of Mornings** — 30-day weigh-in streak
4. **Iron Beginner** — log first lift
5. **PR Hunter** — first PR
6. **Triple Threat** — PR in bench, squat, deadlift
7. **Cardio Convert** — log first cardio session
8. **Endurance** — 10 cardio sessions
9. **Goal Crusher** — hit weekly gym goal
10. **Steady Eddie** — 4 consecutive weeks hitting gym goal
11. **Macro Master** — hit macro targets (±5%) for 7 days
12. **Hydrated** — log 7 days of meals (no skips)
13. **Self-Care Champion** — hit weekly self-care goal
14. **Mood Tracker** — 14 day mood-log streak
15. **Med Adherent** — 30 days no missed scheduled meds

### Page: "Achievements" — accessible from Settings or a new tab
Show all badges (earned in colour, unearned greyed). Click for detail. Show streak summary at top.

### Consistency chart
Heatmap (GitHub-style) showing the last 90 days. Each day has cells for: weight logged, meals logged, training, meds taken, mood logged. Colour intensity = how many categories logged that day.

Place on Insights page.

### Customisable goals
The user can edit Settings to change goal thresholds (already covered in section 3).

---

## 7. SELF-CARE TRACKER

### Data model
New collection `selfCareLog`:
```js
{
  date: 'YYYY-MM-DD',
  timeOfDay: ...,
  category: 'skincare' | 'walk' | 'meditation' | 'stretching' | 'reading' | 'sauna' | 'massage' | 'social' | 'hobby' | 'sleep-priority' | 'other',
  durationMin: number | null,
  notes: string,
  createdAt: timestamp,
}
```

Customisable categories: in Settings, allow user to add/remove categories from a list.

### New tab "Self-Care" (or fold into Wellbeing as a sub-tab)
- Quick log: tap a category chip → add a `selfCareLog` entry for today
- History list with edit/delete
- Weekly goal: `settings.activityGoals.selfCarePerWeek`
- Show on Today's "This Week" card

---

## 8. EDITING SAVED ENTRIES

Audit every collection and make sure list rows allow EDIT (not just delete).

Specifically required:
- **Lifts** (training sessions) — click row in History to open populated form
- **Meals** (nutritionLog) — click row → edit form
- **Weights** — click → edit
- **Measurements** — click → edit
- **Bloods entries** — click → edit
- **Cardio** — click → edit
- **Self-care entries** — click → edit
- **Wellbeing entries** — click → edit
- **Planner items** — already editable, verify
- **Medications** — already editable

Use a single pattern: row has an Edit icon (pencil) and Delete (trash). Click pencil → form populates with existing values + the existing entry id passed so save updates rather than creates.

---

## 9. TRAINING — WHOLE GYM SESSION LOGGING (not one lift at a time)

Major refactor of the Training "Log" tab.

### New model: a "session" contains multiple exercises
Instead of one Save per exercise, restructure so:

1. User opens **"Log Session"** sub-tab
2. Date + Time of day at top
3. Big **"+ Add Exercise"** button — opens picker (existing exercise list + search)
4. Selected exercise appears as a CARD in the session, with sets table inside
5. Add another exercise → another card
6. Each card has its own delete button
7. Bottom: Save Session button → writes ONE `lifts` doc with `exercises: [{name, sets: [...]}, ...]`

### Updated `lifts` document
```js
{
  date,
  timeOfDay,
  exercises: [
    { name, sets: [{weight, reps, rpe}], e1RM, tonnage },
    ...
  ],
  totalTonnage,
  notes,
  prs: [],
  createdAt,
}
```

### Migration
Existing single-exercise `lifts` documents work fine because the new model is a superset — wrap them in a 1-element `exercises` array at read time if `exercise` field exists at the top level. Don't migrate the data, just handle both shapes in the read layer.

### Exercise name visible
Critically: the History view MUST show exercise names prominently. Current display only shows weight/reps. Show exercise name + sets summary.

### Templates
Workout templates should now save the FULL session (multiple exercises). Update the template flow.

---

## 10. DRAFT AUTOSAVE — don't lose work on refresh

Implement an autosave layer for in-progress forms:
- When the user starts typing in: Training Log session, Cardio Log, Nutrition meal Log, Wellbeing Log, Self-Care Log → debounced (500ms) save to `localStorage` under a key like `pt-draft-{form}-{uid}`.
- On mount, check for existing draft and offer "Restore unsaved entry from {time ago}?" prompt above the form
- On successful save to Firestore, clear the draft

Use a small helper `src/lib/draft.js`:
```js
export function saveDraft(key, data) { localStorage.setItem(key, JSON.stringify({ data, at: Date.now() })) }
export function loadDraft(key, maxAgeMs = 24*60*60*1000) {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    const { data, at } = JSON.parse(raw)
    if (Date.now() - at > maxAgeMs) return null
    return { data, at }
  } catch { return null }
}
export function clearDraft(key) { localStorage.removeItem(key) }
```

Forms that need autosave:
- Training Log session (the new multi-exercise one)
- Cardio Log
- Nutrition meal log
- Wellbeing log
- Self-care log

---

## File operations summary

### Create
- src/pages/Wellbeing.jsx
- src/pages/SelfCare.jsx — OR fold into Wellbeing.jsx as a sub-tab
- src/pages/Achievements.jsx
- src/components/MoodPicker.jsx
- src/components/EditableRow.jsx (reusable row with edit/delete)
- src/components/ConsistencyHeatmap.jsx
- src/lib/achievements.js (badge logic)
- src/lib/draft.js (autosave helper)
- src/lib/timeOfDay.js (helper: detect current TOD; render TOD chip)

### Modify
- src/App.jsx (add new tabs/routes: Wellbeing, Achievements; keep tab strip horizontal-scroll friendly)
- src/pages/Training.jsx (major refactor: multi-exercise sessions, Cardio sub-tab, edit support)
- src/pages/Nutrition.jsx (edit meals, TOD, fix progress bar empty state)
- src/pages/Today.jsx (mood quick log, This Week goals card, cardio summary)
- src/pages/Insights (was Dashboard.jsx) (consistency heatmap, weekly goals, badges link)
- src/pages/Settings.jsx (activity goals, self-care categories, link to Achievements)
- src/pages/BodyLog.jsx (edit support for weights & measurements)
- src/pages/Bloods.jsx (edit support)
- src/training/exercises.js (cardio types + muscle mappings)
- src/clinical/meds.js — no changes
- src/data.js — no schema changes (Firestore is schemaless), just new collection names used

### Migration handling
The new `lifts` schema with `exercises:[]` is a superset. In the read layer (everywhere that reads `lifts`), check `if (doc.exercise && !doc.exercises) { doc.exercises = [{ name: doc.exercise, sets: doc.sets }] }`. This keeps old data viewable without touching it.

---

## Quality

- Build must complete cleanly: `cd /home/user/workspace/physique-tracker && npm run build`
- Mobile-first; test layout on a 390x844 viewport mentally
- Don't break existing functionality
- Keep `src/pages/Coach.jsx` SYSTEM_PREAMBLE unchanged
- NO PED features

DO NOT push to git. The parent will handle deploy.
