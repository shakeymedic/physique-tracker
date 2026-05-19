/**
 * Exercise → muscle group mapping
 * primary: main muscles trained
 * secondary: supporting muscles
 *
 * Also includes cardio types with light fatigue mappings.
 */
export const EXERCISES = [
  { name: 'Bench Press', primary: ['Chest'], secondary: ['Triceps', 'Shoulders'] },
  { name: 'Squat', primary: ['Quads', 'Glutes'], secondary: ['Hamstrings', 'Core'] },
  { name: 'Deadlift', primary: ['Hamstrings', 'Glutes', 'Back'], secondary: ['Forearms', 'Core'] },
  { name: 'Overhead Press', primary: ['Shoulders'], secondary: ['Triceps', 'Core'] },
  { name: 'Barbell Row', primary: ['Back'], secondary: ['Biceps', 'Forearms'] },
  { name: 'Pull-Up', primary: ['Back'], secondary: ['Biceps', 'Forearms'] },
  { name: 'Romanian Deadlift', primary: ['Hamstrings', 'Glutes'], secondary: ['Back', 'Forearms'] },
  { name: 'Front Squat', primary: ['Quads'], secondary: ['Core', 'Glutes'] },
  { name: 'Incline Bench', primary: ['Chest', 'Shoulders'], secondary: ['Triceps'] },
  { name: 'Dumbbell Bench', primary: ['Chest'], secondary: ['Triceps', 'Shoulders'] },
  { name: 'Lat Pulldown', primary: ['Back'], secondary: ['Biceps'] },
  { name: 'Bicep Curl', primary: ['Biceps'], secondary: ['Forearms'] },
  { name: 'Tricep Extension', primary: ['Triceps'], secondary: [] },
  { name: 'Leg Press', primary: ['Quads', 'Glutes'], secondary: ['Hamstrings'] },
  { name: 'Leg Curl', primary: ['Hamstrings'], secondary: ['Glutes'] },
  { name: 'Leg Extension', primary: ['Quads'], secondary: [] },
  { name: 'Calf Raise', primary: ['Calves'], secondary: [] },
  { name: 'Lateral Raise', primary: ['Shoulders'], secondary: [] },
  { name: 'Face Pull', primary: ['Shoulders', 'Back'], secondary: [] },
  { name: 'Hip Thrust', primary: ['Glutes'], secondary: ['Hamstrings', 'Core'] },
  { name: 'Dip', primary: ['Triceps', 'Chest'], secondary: ['Shoulders'] },
  { name: 'Push-Up', primary: ['Chest'], secondary: ['Triceps', 'Shoulders', 'Core'] },
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
 *
 * @param {Array} lifts - array of lift docs { date, exercise, sets }
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {object} { [muscle]: daysAgo } — null means never trained
 */
export function computeMuscleRecovery(lifts, today, cardioSessions = []) {
  const lastTrained = {}

  lifts.forEach(lift => {
    // Handle new multi-exercise shape
    const exercises = lift.exercises
      ? lift.exercises
      : lift.exercise
        ? [{ name: lift.exercise, sets: lift.sets }]
        : []

    exercises.forEach(exEntry => {
      const ex = EXERCISES.find(e => e.name === exEntry.name)
      if (!ex || !lift.date) return
      const muscles = [...ex.primary, ...ex.secondary]
      muscles.forEach(m => {
        if (!lastTrained[m] || lift.date > lastTrained[m]) {
          lastTrained[m] = lift.date
        }
      })
    })
  })

  // Factor in cardio sessions
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
      result[muscle] = null // never trained
    } else {
      const ms = new Date(lastTrained[muscle]).getTime()
      result[muscle] = Math.round((todayMs - ms) / (1000 * 60 * 60 * 24))
    }
  })
  return result
}

/**
 * Classify muscle state:
 * 0 days = fatigued (red)
 * 1 day = recovering (orange)
 * 2 days = recovering (yellow)
 * 3-5 days = recovered (green)
 * 6+ days = undertrained (grey)
 * null = never trained (grey)
 */
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
