/**
 * Exercise → muscle group mapping
 * primary: main muscles trained
 * secondary: supporting muscles
 * tips: 2-3 key coaching cues
 * url: ExRx.net or similar authoritative reference
 */
// Legacy alias (for backward compat with existing imports)
export { BUILT_IN_EXERCISES as EXERCISES }

/**
 * Built-in exercise list.
 * Each entry has: name, primary, secondary, category, tips, url
 */
export const BUILT_IN_EXERCISES = [
  {
    name: 'Bench Press',
    primary: ['Chest'], secondary: ['Triceps', 'Shoulders'], category: 'strength',
    tips: 'Retract and depress shoulder blades. Bar touches lower chest. Drive feet into floor and keep a natural arch.',
    url: 'https://exrx.net/WeightExercises/PectoralSternal/BBBenchPress',
  },
  {
    name: 'Squat',
    primary: ['Quads', 'Glutes'], secondary: ['Hamstrings', 'Core'], category: 'strength',
    tips: 'Bar on traps, chest up, knees track toes. Break at hips and knees simultaneously. Hip crease below parallel.',
    url: 'https://exrx.net/WeightExercises/Quadriceps/BBSquat',
  },
  {
    name: 'Deadlift',
    primary: ['Hamstrings', 'Glutes', 'Back'], secondary: ['Forearms', 'Core'], category: 'strength',
    tips: 'Bar over mid-foot, neutral spine, lat engagement before the pull. Push the floor away — don\'t yank.',
    url: 'https://exrx.net/WeightExercises/GluteusMaximus/BBDeadlift',
  },
  {
    name: 'Overhead Press',
    primary: ['Shoulders'], secondary: ['Triceps', 'Core'], category: 'strength',
    tips: 'Grip just outside shoulders, elbows slightly forward. Press bar in a straight line, head back to avoid bar path. Squeeze glutes.',
    url: 'https://exrx.net/WeightExercises/DeltoidAnterior/BBMilitaryPress',
  },
  {
    name: 'Barbell Row',
    primary: ['Back'], secondary: ['Biceps', 'Forearms'], category: 'strength',
    tips: 'Hinge to roughly 45°. Pull to lower chest/upper abdomen, lead with elbows. Keep lower back neutral.',
    url: 'https://exrx.net/WeightExercises/BackGeneral/BBBentOverRow',
  },
  {
    name: 'Pull-Up',
    primary: ['Back'], secondary: ['Biceps', 'Forearms'], category: 'strength',
    tips: 'Dead hang start, depress scapulae first. Pull chest to bar, avoid kipping. Full extension at bottom.',
    url: 'https://exrx.net/WeightExercises/LatissimusDorsi/WAClosePullup',
  },
  {
    name: 'Romanian Deadlift',
    primary: ['Hamstrings', 'Glutes'], secondary: ['Back', 'Forearms'], category: 'strength',
    tips: 'Soft knee bend throughout. Push hips back, bar stays close to legs. Feel hamstring stretch — don\'t round lower back.',
    url: 'https://exrx.net/WeightExercises/Hamstrings/BBRomanianDeadlift',
  },
  {
    name: 'Front Squat',
    primary: ['Quads'], secondary: ['Core', 'Glutes'], category: 'strength',
    tips: 'Clean grip or cross-arm position. Elbows high throughout. More upright torso than back squat — demands ankle mobility.',
    url: 'https://exrx.net/WeightExercises/Quadriceps/BBFrontSquat',
  },
  {
    name: 'Incline Bench',
    primary: ['Chest', 'Shoulders'], secondary: ['Triceps'], category: 'strength',
    tips: '30–45° incline. Grip slightly narrower than flat bench. Bar touches upper chest. Avoids excessive shoulder strain.',
    url: 'https://exrx.net/WeightExercises/PectoralClavicular/BBInclineBenchPress',
  },
  {
    name: 'Dumbbell Bench',
    primary: ['Chest'], secondary: ['Triceps', 'Shoulders'], category: 'strength',
    tips: 'Greater stretch than barbell. Keep a slight arc, don\'t let dumbbells flare out. Control the eccentric.',
    url: 'https://exrx.net/WeightExercises/PectoralSternal/DBBenchPress',
  },
  {
    name: 'Lat Pulldown',
    primary: ['Back'], secondary: ['Biceps'], category: 'strength',
    tips: 'Lean back slightly, pull bar to upper chest. Initiate with scapular depression, not arm pull. Avoid momentum.',
    url: 'https://exrx.net/WeightExercises/LatissimusDorsi/CBFrontPulldown',
  },
  {
    name: 'Bicep Curl',
    primary: ['Biceps'], secondary: ['Forearms'], category: 'strength',
    tips: 'Elbows pinned to sides throughout. Full range — full extension at bottom, squeeze at top. Avoid swinging.',
    url: 'https://exrx.net/WeightExercises/Biceps/BBCurl',
  },
  {
    name: 'Tricep Extension',
    primary: ['Triceps'], secondary: [], category: 'strength',
    tips: 'Overhead: arms by ears, hinge only at elbow. Cable/pushdown: elbows locked at sides, full lockout at bottom.',
    url: 'https://exrx.net/WeightExercises/Triceps/CBPushdown',
  },
  {
    name: 'Leg Press',
    primary: ['Quads', 'Glutes'], secondary: ['Hamstrings'], category: 'strength',
    tips: 'Feet shoulder-width, mid-platform. Don\'t lock knees at top. Lower until 90° or hips start to roll. Heels drive.',
    url: 'https://exrx.net/WeightExercises/Quadriceps/LVLegPress',
  },
  {
    name: 'Leg Curl',
    primary: ['Hamstrings'], secondary: ['Glutes'], category: 'strength',
    tips: 'Hips flat on bench. Curl fully, pause at top. Slow eccentric. Avoid jerking hip up to cheat the movement.',
    url: 'https://exrx.net/WeightExercises/Hamstrings/LVSeatedLegCurl',
  },
  {
    name: 'Leg Extension',
    primary: ['Quads'], secondary: [], category: 'strength',
    tips: 'Full extension with brief squeeze at top. Control the return — don\'t drop. Avoid if you have patellar issues.',
    url: 'https://exrx.net/WeightExercises/Quadriceps/LVLegExtension',
  },
  {
    name: 'Calf Raise',
    primary: ['Calves'], secondary: [], category: 'strength',
    tips: 'Full range — heel below platform level. Pause 1 second at top. Slow eccentric for hypertrophy.',
    url: 'https://exrx.net/WeightExercises/Gastrocnemius/LVSeatedCalfRaise',
  },
  {
    name: 'Lateral Raise',
    primary: ['Shoulders'], secondary: [], category: 'strength',
    tips: 'Slight elbow bend. Raise to shoulder height — no higher. Lead with elbows, not hands. Control the descent.',
    url: 'https://exrx.net/WeightExercises/DeltoidLateral/DBLateralRaise',
  },
  {
    name: 'Face Pull',
    primary: ['Shoulders', 'Back'], secondary: [], category: 'strength',
    tips: 'Rope at face height. Pull to ears with elbows flared high. Externally rotate — thumbs pointing back. High reps.',
    url: 'https://exrx.net/WeightExercises/DeltoidPosterior/CBFacePull',
  },
  {
    name: 'Hip Thrust',
    primary: ['Glutes'], secondary: ['Hamstrings', 'Core'], category: 'strength',
    tips: 'Shoulders on bench edge, bar over hip crease. Drive through heels, squeeze glutes hard at top. Chin tucked.',
    url: 'https://exrx.net/WeightExercises/GluteusMaximus/BBHipThrust',
  },
  {
    name: 'Dip',
    primary: ['Triceps', 'Chest'], secondary: ['Shoulders'], category: 'strength',
    tips: 'Upright torso for tricep focus, lean forward for chest. Full lockout at top. Lower until upper arm is parallel.',
    url: 'https://exrx.net/WeightExercises/Triceps/WAPushup',
  },
  {
    name: 'Push-Up',
    primary: ['Chest'], secondary: ['Triceps', 'Shoulders', 'Core'], category: 'strength',
    tips: 'Hands slightly wider than shoulders. Rigid plank throughout. Chest touches floor. Elbows at 45°, not flared.',
    url: 'https://exrx.net/WeightExercises/PectoralSternal/BBBenchPress',
  },
]

/**
 * Cardio type → muscle recovery effect
 * recoveryDays: approximate recovery time (used in heatmap)
 */
export const CARDIO_TYPES = [
  'Running', 'Cycling', 'Walking', 'Rowing', 'Swimming',
  'Elliptical', 'Stair Climber', 'HIIT', 'Spin', 'Other',
]

export const CARDIO_MUSCLE_MAP = {
  Running:       { muscles: ['Quads', 'Hamstrings', 'Calves'], recoveryDays: 1 },
  Cycling:       { muscles: ['Quads', 'Hamstrings', 'Calves'], recoveryDays: 1 },
  Walking:       { muscles: ['Quads', 'Hamstrings', 'Calves'], recoveryDays: 1 },
  Rowing:        { muscles: ['Back', 'Biceps', 'Core', 'Quads'], recoveryDays: 2 },
  Swimming:      { muscles: ['Shoulders', 'Back', 'Core'], recoveryDays: 2 },
  Elliptical:    { muscles: ['Quads', 'Hamstrings', 'Calves'], recoveryDays: 1 },
  'Stair Climber': { muscles: ['Quads', 'Glutes', 'Calves'], recoveryDays: 1 },
  HIIT:          { muscles: ['Quads', 'Hamstrings', 'Calves', 'Chest', 'Core'], recoveryDays: 2 },
  Spin:          { muscles: ['Quads', 'Hamstrings', 'Calves'], recoveryDays: 1 },
  Other:         { muscles: [], recoveryDays: 1 },
}

/** All distinct muscle regions for the heatmap */
export const MUSCLE_REGIONS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core',
]

/**
 * Given a list of lift sessions (from Firestore) and a target date string,
 * compute how many days since each muscle group was last trained.
 */
export function computeMuscleRecovery(lifts, today, cardioSessions = [], allExercises = []) {
  const lastTrained = {}
  const exDb = allExercises.length > 0 ? allExercises : BUILT_IN_EXERCISES

  lifts.forEach(lift => {
    const exercises = lift.exercises
      ? lift.exercises
      : lift.exercise
        ? [{ name: lift.exercise, sets: lift.sets }]
        : []

    exercises.forEach(exEntry => {
      const ex = exDb.find(e => e.name === exEntry.name)
      if (!ex || !lift.date) return
      const muscles = [...ex.primary, ...ex.secondary]
      muscles.forEach(m => {
        if (!lastTrained[m] || lift.date > lastTrained[m]) {
          lastTrained[m] = lift.date
        }
      })
    })
  })

  cardioSessions.forEach(session => {
    const mapping = CARDIO_MUSCLE_MAP[session.type]
    if (!mapping || !session.date) return
    mapping.muscles.forEach(m => {
      if (!lastTrained[m] || session.date > lastTrained[m]) {
        lastTrained[m] = session.date
      }
    })
  })

  const todayMs = new Date(today).getTime()
  const result = {}
  MUSCLE_REGIONS.forEach(muscle => {
    if (!lastTrained[muscle]) {
      result[muscle] = null
    } else {
      const ms = new Date(lastTrained[muscle]).getTime()
      result[muscle] = Math.round((todayMs - ms) / (1000 * 60 * 60 * 24))
    }
  })
  return result
}

export function muscleStatus(daysAgo) {
  if (daysAgo === null) return 'never'
  if (daysAgo === 0) return 'fatigued'
  if (daysAgo === 1) return 'recovering1'
  if (daysAgo === 2) return 'recovering2'
  if (daysAgo >= 3 && daysAgo <= 5) return 'recovered'
  return 'undertrained'
}

export const MUSCLE_STATUS_STYLES = {
  fatigued: { bg: 'bg-danger/30', text: 'text-danger', label: 'Fatigued' },
  recovering1: { bg: 'bg-warn/25', text: 'text-warn', label: '1d ago' },
  recovering2: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '2d ago' },
  recovered: { bg: 'bg-success/20', text: 'text-success', label: 'Ready' },
  undertrained: { bg: 'bg-surfaceAlt', text: 'text-muted', label: 'Undertrained' },
  never: { bg: 'bg-surfaceAlt', text: 'text-muted', label: 'No data' },
}
