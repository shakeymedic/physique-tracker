# Physique Tracker v4 — Custom Exercises, Programs, Mobility

Layered on top of v3. Read existing code first. No new npm packages needed.

---

## 1. CUSTOM EXERCISES

The exercise list in `src/training/exercises.js` is hardcoded. Let users add their own and have them persist.

### Data
New Firestore collection `customExercises` per user:
```js
{
  name: string,
  category: 'strength' | 'cardio' | 'mobility' | 'other',
  primary: [string],     // muscle groups e.g. ['Chest']
  secondary: [string],
  isMobility: boolean,
  defaultDurationSec: number | null,  // for stretches
  defaultSets: number | null,
  notes: string,
  createdAt,
}
```

### UI
- In the Training Log → exercise picker dropdown, append a `+ Add custom exercise` option at the bottom
- Selecting it opens a small inline form (name + category + primary muscle group selector + optional secondary + notes)
- Save → added to `customExercises` collection AND immediately selectable
- Show custom exercises with a chip "Custom" in the picker
- A separate "Manage exercises" link in Settings → list of custom exercises with edit/delete

### Loader behaviour
`src/training/exercises.js` exports `BUILT_IN_EXERCISES` (current list). Components consuming exercises should now call a helper:
```js
useExerciseList(uid) → { all, builtIn, custom }
```
which subscribes to `customExercises` and merges.

Update the muscle-recovery heatmap to include custom exercises' primary/secondary muscle groups too.

---

## 2. MOBILITY / STRETCHING LIBRARY

### Data
Built-in stretches in `src/training/stretches.js`:
```js
export const STRETCHES = [
  { name: 'Hamstring stretch (seated)', muscle: 'Hamstrings', defaultDurationSec: 30 },
  { name: 'Couch stretch', muscle: 'Hip flexors', defaultDurationSec: 60 },
  { name: 'Pigeon pose', muscle: 'Glutes', defaultDurationSec: 60 },
  { name: 'Cat-cow', muscle: 'Spine', defaultDurationSec: 30 },
  { name: 'Thoracic spine rotation', muscle: 'T-spine', defaultDurationSec: 30 },
  { name: 'Doorway chest stretch', muscle: 'Chest', defaultDurationSec: 45 },
  { name: 'Child's pose', muscle: 'Lower back', defaultDurationSec: 60 },
  { name: 'Downward dog', muscle: 'Calves, hamstrings, shoulders', defaultDurationSec: 45 },
  { name: 'Cobra', muscle: 'Abs, lower back', defaultDurationSec: 30 },
  { name: 'World's greatest stretch', muscle: 'Full body', defaultDurationSec: 45 },
  { name: 'Lat stretch (overhead reach)', muscle: 'Lats', defaultDurationSec: 30 },
  { name: 'Calf stretch (wall)', muscle: 'Calves', defaultDurationSec: 30 },
  { name: 'Quad stretch (standing)', muscle: 'Quads', defaultDurationSec: 30 },
  { name: 'Neck rolls', muscle: 'Neck', defaultDurationSec: 30 },
  { name: 'Shoulder rolls', muscle: 'Shoulders', defaultDurationSec: 30 },
  { name: 'Hip circles', muscle: 'Hips', defaultDurationSec: 30 },
  { name: 'Ankle circles', muscle: 'Ankles', defaultDurationSec: 30 },
  { name: 'Hip flexor stretch (kneeling)', muscle: 'Hip flexors', defaultDurationSec: 45 },
  { name: 'Glute bridge', muscle: 'Glutes', defaultDurationSec: 30 },
  { name: 'Dead hang', muscle: 'Shoulders, lats, grip', defaultDurationSec: 60 },
]
```

### Built-in routines in `src/training/routines.js`:
```js
export const ROUTINES = [
  {
    id: 'daily-10min',
    name: '10-Minute Daily Mobility',
    description: 'A quick full-body routine.',
    durationMin: 10,
    stretches: [
      { stretch: 'Cat-cow', durationSec: 60 },
      { stretch: 'World's greatest stretch', durationSec: 60 },
      { stretch: 'Hip flexor stretch (kneeling)', durationSec: 60 },
      { stretch: 'Pigeon pose', durationSec: 60 },
      { stretch: 'Hamstring stretch (seated)', durationSec: 60 },
      { stretch: 'Thoracic spine rotation', durationSec: 60 },
      { stretch: 'Doorway chest stretch', durationSec: 60 },
      { stretch: 'Calf stretch (wall)', durationSec: 60 },
      { stretch: 'Child's pose', durationSec: 60 },
      { stretch: 'Shoulder rolls', durationSec: 60 },
    ],
  },
  {
    id: 'pre-lift-warmup',
    name: 'Pre-Lift Dynamic Warmup',
    description: 'Get ready to lift heavy.',
    durationMin: 5,
    stretches: [
      { stretch: 'Hip circles', durationSec: 30 },
      { stretch: 'Ankle circles', durationSec: 30 },
      { stretch: 'Cat-cow', durationSec: 30 },
      { stretch: 'World's greatest stretch', durationSec: 60 },
      { stretch: 'Glute bridge', durationSec: 30 },
      { stretch: 'Thoracic spine rotation', durationSec: 30 },
      { stretch: 'Dead hang', durationSec: 30 },
      { stretch: 'Shoulder rolls', durationSec: 30 },
    ],
  },
  {
    id: 'hip-openers',
    name: 'Hip Openers',
    description: 'Counter the desk job / long shifts.',
    durationMin: 8,
    stretches: [
      { stretch: 'Pigeon pose', durationSec: 90 },   // each side
      { stretch: 'Couch stretch', durationSec: 90 },
      { stretch: 'Hip flexor stretch (kneeling)', durationSec: 60 },
      { stretch: 'Glute bridge', durationSec: 30 },
      { stretch: 'World's greatest stretch', durationSec: 60 },
    ],
  },
  {
    id: 'desk-recovery',
    name: 'Desk Recovery',
    description: 'For after long shifts or computer work.',
    durationMin: 6,
    stretches: [
      { stretch: 'Neck rolls', durationSec: 30 },
      { stretch: 'Shoulder rolls', durationSec: 30 },
      { stretch: 'Doorway chest stretch', durationSec: 60 },
      { stretch: 'Lat stretch (overhead reach)', durationSec: 60 },
      { stretch: 'Thoracic spine rotation', durationSec: 60 },
      { stretch: 'Cat-cow', durationSec: 60 },
      { stretch: 'Child's pose', durationSec: 60 },
    ],
  },
  {
    id: 'bedtime-wind-down',
    name: 'Bedtime Wind-Down',
    description: 'Slow, grounding stretches before sleep.',
    durationMin: 8,
    stretches: [
      { stretch: 'Child's pose', durationSec: 90 },
      { stretch: 'Pigeon pose', durationSec: 90 },
      { stretch: 'Cat-cow', durationSec: 60 },
      { stretch: 'Cobra', durationSec: 30 },
      { stretch: 'Hamstring stretch (seated)', durationSec: 60 },
      { stretch: 'Glute bridge', durationSec: 30 },
    ],
  },
]
```

### UI
New sub-tab on Training: **"Mobility"** (after Cardio).

- Top: list of routine cards (built-ins + user's saved custom routines). Each card has name, description, duration, "Start" button.
- "Start routine" → opens a timer modal showing current stretch name, time remaining, progress bar (X of N stretches), next-up preview. Auto-advances. Skip / pause / back buttons.
- On completion → automatically logs a `mobilityLog` entry with date, routine name, total duration, stretches done.
- Also: pickable individual stretches (like other exercises in the Training picker — category: mobility). User can add a stretch as part of any session.
- "Save current routine" — if user customises a routine on the fly, save to `customRoutines` collection.

### Data
`mobilityLog` collection:
```js
{ date, timeOfDay, routineId, routineName, durationMin, stretches: [{name, durationSec}], notes }
```

`customRoutines` collection same shape as built-ins.

Add to Recovery heatmap: log mobility → mark relevant muscle groups as freshly-stretched (small positive recovery contribution, not "trained").

---

## 3. WORKOUT PROGRAMS

### Concept
A program = a multi-week schedule + milestone goals.

### Built-in programs (4)
Create `src/training/programs.js` with these:

#### A. Stronglifts 5×5 (beginner, 12 weeks)
- 3 days/week (e.g. Mon/Wed/Fri)
- Alternating Workout A and Workout B
- A: Squat 5×5, Bench 5×5, Barbell Row 5×5
- B: Squat 5×5, Overhead Press 5×5, Deadlift 1×5
- Progression rule: add 2.5 kg to each lift when all sets completed; reset 10% on third failed session
- Milestones: e.g. "Squat bodyweight × 5", "Bench bodyweight × 5", "Deadlift 1.5 × bodyweight × 5"

#### B. Push Pull Legs (intermediate, 12 weeks, 6 days/week)
- Push: Bench, OHP, Incline DB Bench, Lat Raise, Tricep Extension
- Pull: Deadlift (week A only), Barbell Row, Pull-Up, Face Pull, Bicep Curl
- Legs: Squat, RDL, Leg Press, Leg Curl, Calf Raise
- Days per week: PPLPPL R or similar
- Milestones: PR progression on big 3

#### C. 5/3/1 Boring But Big (intermediate, 12 weeks)
- 4 days/week
- Main lift: % of training max (90% of 1RM): warm-up 5/5/5 then 5×5 main work at 65/75/85 over the cycle
- Accessory "BBB": 5×10 same lift at 50-60%
- Milestones: training max +2.5kg upper / +5kg lower each cycle

#### D. Hybrid Plan (general, 12 weeks)
- 3 lifting days (full body), 2 cardio days, mobility daily
- Lift: Squat / Bench / Deadlift / Row / OHP / Pull-Up rotated
- Cardio: 30-45 min Z2 or HIIT
- Mobility: daily 10-min routine
- Milestones: 5K time, 1RM lifts, body composition

### Program structure
```js
// src/training/programs.js
export const PROGRAMS = [
  {
    id: 'stronglifts-5x5',
    name: 'Stronglifts 5×5',
    description: 'Classic beginner strength program.',
    difficulty: 'beginner',
    durationWeeks: 12,
    daysPerWeek: 3,
    style: 'strength',
    // Workout templates A/B/etc
    workouts: {
      A: { name: 'Workout A', exercises: [
        { name: 'Squat', sets: 5, reps: 5, progressKg: 2.5 },
        { name: 'Bench Press', sets: 5, reps: 5, progressKg: 2.5 },
        { name: 'Barbell Row', sets: 5, reps: 5, progressKg: 2.5 },
      ]},
      B: { name: 'Workout B', exercises: [
        { name: 'Squat', sets: 5, reps: 5, progressKg: 2.5 },
        { name: 'Overhead Press', sets: 5, reps: 5, progressKg: 2.5 },
        { name: 'Deadlift', sets: 1, reps: 5, progressKg: 5 },
      ]},
    },
    // Schedule: day index 0..N where each day is which workout (or 'rest' or 'cardio' or 'mobility')
    weeklySchedule: ['A', 'rest', 'B', 'rest', 'A', 'rest', 'rest'],  // Mon=A, Wed=B, Fri=A, etc.
    // Milestones to track
    milestones: [
      { id: 'sq-bw', name: 'Squat bodyweight × 5', exercise: 'Squat', target: 'bodyweight × 1.0', reps: 5 },
      { id: 'bn-bw', name: 'Bench bodyweight × 5', exercise: 'Bench Press', target: 'bodyweight × 1.0', reps: 5 },
      { id: 'dl-1p5bw', name: 'Deadlift 1.5× bodyweight × 5', exercise: 'Deadlift', target: 'bodyweight × 1.5', reps: 5 },
    ],
  },
  // ...3 more programs, similar shape
]
```

### Active program
User can enroll in at most 1 active program at a time. Store in settings:
```js
activeProgram: {
  id: 'stronglifts-5x5',
  startDate: 'YYYY-MM-DD',
  weekNumber: 1,                              // computed but cached
  customisations: {},                         // user overrides
  // Track which workout in each week's schedule has been completed:
  completedSessions: {                         // keyed by week_day index
    '0_0': { date: '2026-05-19', sessionId: '<lifts doc id>' },
    ...
  },
  customMilestones: [],
}
```

### UI
New sub-tab on Training: **"Programs"** (between Templates and History).

- If no active program: gallery of available programs (built-in + custom). Each card: name, difficulty chip, duration, days/week, brief description, "View" + "Start program" buttons.
- "View" → details: full schedule, milestones, exercises used
- "Start program" → asks for start date (defaults today), enrolls user
- If active program: dashboard view:
  - Top: program name + week N of M, progress bar
  - Today's workout panel: "Today is Workout A" or "Rest day" or "Cardio Z2 30min" → big "Start session" button → opens Log Session pre-populated with the workout's exercises
  - This week summary: 5 dot indicators (one per day), filled when completed
  - Milestones list with progress: e.g. "Squat 100kg × 5 — 87kg current best (87%)"
  - "Pause program" / "Customise" / "Exit program" buttons

### Custom programs
User can create custom programs (Settings → Programs → Create custom).
- Form: name, difficulty, duration weeks, days/week, list of workouts (each with exercises + sets/reps), weekly schedule, milestones.
- Saved to `customPrograms` collection.

### Milestone tracking
Every time a `lifts` session is saved, recompute milestone progress:
- For each milestone, check if its target has been hit (e.g. has the user ever logged the exercise with weight ≥ target at the required reps?)
- Store achievements with date hit
- Surface "🏆 Milestone hit: Squat bodyweight × 5!" on Today + Insights when applicable

Update `src/lib/achievements.js` to include program milestones.

---

## 4. EXTRA POLISH

### Training Log "Add Exercise" picker enhancement
Make it searchable. Show categories (Strength / Cardio / Mobility / Custom) as tabs in the picker.

### Settings additions
- "Active Program" section showing the user's current program and progress
- "Custom Programs" link → manage
- "Custom Exercises" link → manage
- "Custom Routines" link → manage

### Today.jsx surfacing
- If on an active program, show "Today's plan: Workout A — Squat, Bench, Row" with a "Start" button
- Show milestone progress on Insights

---

## File operations

### Create
- src/training/stretches.js
- src/training/routines.js
- src/training/programs.js
- src/lib/useExerciseList.js (hook for merged built-in + custom exercises)
- src/components/RoutineTimer.jsx (the mobility timer modal)
- src/components/ProgramCard.jsx
- src/components/MilestoneRow.jsx

### Modify
- src/training/exercises.js (rename existing const → BUILT_IN_EXERCISES; add categories)
- src/pages/Training.jsx (Mobility sub-tab, Programs sub-tab, custom exercise add inline, searchable picker, today's program plan)
- src/pages/Today.jsx (today's program plan if enrolled)
- src/pages/Dashboard.jsx — Insights (milestone progress)
- src/pages/Settings.jsx (manage custom exercises/routines/programs links, active program section)
- src/lib/achievements.js (program milestones)

### Build & verify
After every major file, build:
cd /home/user/workspace/physique-tracker && npm run build

DO NOT push or deploy. Parent handles that.
