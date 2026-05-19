/**
 * Built-in workout programs.
 * 4 programs: Stronglifts 5x5, PPL, 5/3/1 BBB, Hybrid
 */

export const PROGRAMS = [
  // ── A. Stronglifts 5x5 ────────────────────────────────────────────────────
  {
    id: 'stronglifts-5x5',
    name: 'Stronglifts 5\u00d75',
    description: 'Classic beginner strength program. Alternating A/B workouts 3 days/week with linear progression on the big 5.',
    difficulty: 'beginner',
    durationWeeks: 12,
    daysPerWeek: 3,
    style: 'strength',
    workouts: {
      A: {
        name: 'Workout A',
        exercises: [
          { name: 'Squat', sets: 5, reps: 5, progressKg: 2.5 },
          { name: 'Bench Press', sets: 5, reps: 5, progressKg: 2.5 },
          { name: 'Barbell Row', sets: 5, reps: 5, progressKg: 2.5 },
        ],
      },
      B: {
        name: 'Workout B',
        exercises: [
          { name: 'Squat', sets: 5, reps: 5, progressKg: 2.5 },
          { name: 'Overhead Press', sets: 5, reps: 5, progressKg: 2.5 },
          { name: 'Deadlift', sets: 1, reps: 5, progressKg: 5 },
        ],
      },
    },
    // Mon=A, Tue=rest, Wed=B, Thu=rest, Fri=A, Sat=rest, Sun=rest (alternates each week)
    weeklySchedule: ['A', 'rest', 'B', 'rest', 'A', 'rest', 'rest'],
    progressionRule: 'Add 2.5 kg to each upper body lift and 5 kg to squat/deadlift when all sets are completed. On third consecutive failed session, deload 10%.',
    milestones: [
      { id: 'sq-bw', name: 'Squat bodyweight \u00d7 5', exercise: 'Squat', target: 'bodyweight \u00d7 1.0', reps: 5, multiplier: 1.0 },
      { id: 'bn-bw', name: 'Bench bodyweight \u00d7 5', exercise: 'Bench Press', target: 'bodyweight \u00d7 1.0', reps: 5, multiplier: 1.0 },
      { id: 'dl-1p5bw', name: 'Deadlift 1.5\u00d7 bodyweight \u00d7 5', exercise: 'Deadlift', target: 'bodyweight \u00d7 1.5', reps: 5, multiplier: 1.5 },
    ],
  },

  // ── B. Push Pull Legs ───────────────────────────────────────────────────────
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: 'Intermediate 6-day PPL split. High frequency and volume for experienced lifters. Run P-P-L-P-P-L each week.',
    difficulty: 'intermediate',
    durationWeeks: 12,
    daysPerWeek: 6,
    style: 'hypertrophy',
    workouts: {
      Push: {
        name: 'Push',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '6-8', notes: 'Main compound' },
          { name: 'Overhead Press', sets: 3, reps: '8-10' },
          { name: 'Incline Bench', sets: 3, reps: '10-12' },
          { name: 'Lateral Raise', sets: 4, reps: '12-15' },
          { name: 'Tricep Extension', sets: 3, reps: '12-15' },
        ],
      },
      Pull: {
        name: 'Pull',
        exercises: [
          { name: 'Deadlift', sets: 1, reps: '3-5', notes: 'Week A only (alternating)' },
          { name: 'Barbell Row', sets: 4, reps: '6-8' },
          { name: 'Pull-Up', sets: 3, reps: '6-10' },
          { name: 'Face Pull', sets: 3, reps: '12-15' },
          { name: 'Bicep Curl', sets: 3, reps: '10-12' },
        ],
      },
      Legs: {
        name: 'Legs',
        exercises: [
          { name: 'Squat', sets: 4, reps: '6-8', notes: 'Main compound' },
          { name: 'Romanian Deadlift', sets: 3, reps: '8-10' },
          { name: 'Leg Press', sets: 3, reps: '12-15' },
          { name: 'Leg Curl', sets: 3, reps: '12-15' },
          { name: 'Calf Raise', sets: 4, reps: '15-20' },
        ],
      },
    },
    weeklySchedule: ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs', 'rest'],
    progressionRule: 'Add weight when you hit the top of the rep range for all sets. Focus on progressive overload each session.',
    milestones: [
      { id: 'ppl-bench-1x5bw', name: 'Bench Press bodyweight \u00d7 5', exercise: 'Bench Press', target: 'bodyweight \u00d7 1.0', reps: 5, multiplier: 1.0 },
      { id: 'ppl-sq-1p25bw', name: 'Squat 1.25\u00d7 bodyweight', exercise: 'Squat', target: 'bodyweight \u00d7 1.25', reps: 5, multiplier: 1.25 },
      { id: 'ppl-dl-1p5bw', name: 'Deadlift 1.5\u00d7 bodyweight', exercise: 'Deadlift', target: 'bodyweight \u00d7 1.5', reps: 5, multiplier: 1.5 },
      { id: 'ppl-ohp-0p75bw', name: 'OHP 0.75\u00d7 bodyweight', exercise: 'Overhead Press', target: 'bodyweight \u00d7 0.75', reps: 5, multiplier: 0.75 },
    ],
  },

  // ── C. 5/3/1 Boring But Big ─────────────────────────────────────────────────
  {
    id: '531-bbb',
    name: '5/3/1 Boring But Big',
    description: '4-day/week program built around the big 4 lifts. Main work follows 5/3/1 percentages, BBB accessory is 5\u00d710 at 50-60% training max.',
    difficulty: 'intermediate',
    durationWeeks: 12,
    daysPerWeek: 4,
    style: 'strength',
    workouts: {
      Squat: {
        name: 'Squat Day',
        exercises: [
          { name: 'Squat', sets: 3, reps: '5/3/1', notes: 'Main work at 65/75/85% of training max. Then 5\u00d710 at 50%' },
          { name: 'Romanian Deadlift', sets: 3, reps: '8-10', notes: 'Accessory' },
          { name: 'Leg Curl', sets: 3, reps: '10-12' },
        ],
      },
      Bench: {
        name: 'Bench Day',
        exercises: [
          { name: 'Bench Press', sets: 3, reps: '5/3/1', notes: 'Main work at 65/75/85%. Then 5\u00d710 at 50%' },
          { name: 'Barbell Row', sets: 5, reps: '10', notes: 'BBB accessory' },
          { name: 'Tricep Extension', sets: 3, reps: '12-15' },
        ],
      },
      Deadlift: {
        name: 'Deadlift Day',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: '5/3/1', notes: 'Main work at 65/75/85%. Then 5\u00d710 at 50%' },
          { name: 'Squat', sets: 5, reps: '10', notes: 'BBB accessory at 50%' },
          { name: 'Pull-Up', sets: 3, reps: '8-10' },
        ],
      },
      OHP: {
        name: 'OHP Day',
        exercises: [
          { name: 'Overhead Press', sets: 3, reps: '5/3/1', notes: 'Main work at 65/75/85%. Then 5\u00d710 at 50%' },
          { name: 'Bench Press', sets: 5, reps: '10', notes: 'BBB accessory at 50%' },
          { name: 'Face Pull', sets: 3, reps: '15-20' },
        ],
      },
    },
    weeklySchedule: ['Squat', 'Bench', 'rest', 'Deadlift', 'OHP', 'rest', 'rest'],
    progressionRule: 'Week 1: 5/5/5+, Week 2: 3/3/3+, Week 3: 5/3/1+, Week 4: deload. After each 4-week cycle add 2.5 kg upper / 5 kg lower to training max.',
    milestones: [
      { id: '531-sq-2bw', name: 'Squat 2\u00d7 bodyweight', exercise: 'Squat', target: 'bodyweight \u00d7 2.0', reps: 1, multiplier: 2.0 },
      { id: '531-dl-2p5bw', name: 'Deadlift 2.5\u00d7 bodyweight', exercise: 'Deadlift', target: 'bodyweight \u00d7 2.5', reps: 1, multiplier: 2.5 },
      { id: '531-bench-1p5bw', name: 'Bench 1.5\u00d7 bodyweight', exercise: 'Bench Press', target: 'bodyweight \u00d7 1.5', reps: 1, multiplier: 1.5 },
      { id: '531-ohp-1bw', name: 'OHP bodyweight', exercise: 'Overhead Press', target: 'bodyweight \u00d7 1.0', reps: 1, multiplier: 1.0 },
    ],
  },

  // ── D. Hybrid Plan ──────────────────────────────────────────────────────────
  {
    id: 'hybrid',
    name: 'Hybrid: Lift + Cardio + Mobility',
    description: 'The balanced life program. 3 full-body lifting days, 2 dedicated cardio days, and daily mobility work. Builds strength, endurance, and flexibility together.',
    difficulty: 'intermediate',
    durationWeeks: 12,
    daysPerWeek: 7,
    style: 'hybrid',
    workouts: {
      LiftA: {
        name: 'Lift Day A \u2014 Squat Focus',
        exercises: [
          { name: 'Squat', sets: 4, reps: '5-6', notes: 'Primary compound' },
          { name: 'Bench Press', sets: 3, reps: '8-10' },
          { name: 'Barbell Row', sets: 3, reps: '8-10' },
          { name: 'Romanian Deadlift', sets: 3, reps: '10-12' },
        ],
      },
      LiftB: {
        name: 'Lift Day B \u2014 Hinge Focus',
        exercises: [
          { name: 'Deadlift', sets: 3, reps: '4-5', notes: 'Primary compound' },
          { name: 'Overhead Press', sets: 3, reps: '8-10' },
          { name: 'Pull-Up', sets: 3, reps: '6-10' },
          { name: 'Leg Press', sets: 3, reps: '10-12' },
        ],
      },
      LiftC: {
        name: 'Lift Day C \u2014 Push/Pull Balance',
        exercises: [
          { name: 'Bench Press', sets: 4, reps: '6-8', notes: 'Heavier push day' },
          { name: 'Barbell Row', sets: 4, reps: '6-8', notes: 'Heavier pull day' },
          { name: 'Squat', sets: 3, reps: '8-10', notes: 'Moderate volume' },
          { name: 'Face Pull', sets: 3, reps: '15-20', notes: 'Shoulder health' },
        ],
      },
      CardioZ2: {
        name: 'Cardio \u2014 Zone 2',
        type: 'cardio',
        description: '35-45 minutes Zone 2 (conversational pace). Running, cycling, rowing, or elliptical. Keep heart rate 60-70% max HR.',
        durationMin: 40,
      },
      CardioHIIT: {
        name: 'Cardio \u2014 HIIT or Tempo',
        type: 'cardio',
        description: '20-30 min HIIT (e.g. 8\u00d720s on/40s off) or 30 min tempo run. Alternate weekly for variety.',
        durationMin: 25,
      },
      Mobility: {
        name: 'Daily Mobility',
        type: 'mobility',
        description: '10 minutes of mobility work. Use the 10-Minute Daily Mobility routine or customise your own.',
        routineId: 'daily-10min',
        durationMin: 10,
      },
    },
    // Mon=LiftA, Tue=CardioZ2, Wed=LiftB, Thu=Mobility, Fri=LiftC, Sat=CardioHIIT, Sun=Mobility
    weeklySchedule: ['LiftA', 'CardioZ2', 'LiftB', 'Mobility', 'LiftC', 'CardioHIIT', 'Mobility'],
    progressionRule: 'Add 2.5 kg to lifts when all prescribed reps are completed. Increase cardio duration by 5 min every 3 weeks. Daily mobility is non-negotiable.',
    milestones: [
      { id: 'hybrid-sq-bw', name: 'Squat bodyweight \u00d7 5', exercise: 'Squat', target: 'bodyweight \u00d7 1.0', reps: 5, multiplier: 1.0 },
      { id: 'hybrid-bench-0p8bw', name: 'Bench 0.8\u00d7 bodyweight', exercise: 'Bench Press', target: 'bodyweight \u00d7 0.8', reps: 5, multiplier: 0.8 },
      { id: 'hybrid-dl-1p25bw', name: 'Deadlift 1.25\u00d7 bodyweight', exercise: 'Deadlift', target: 'bodyweight \u00d7 1.25', reps: 5, multiplier: 1.25 },
      { id: 'hybrid-cardio-10', name: '10 cardio sessions logged', exercise: null, type: 'cardio-count', target: 10 },
      { id: 'hybrid-mobility-21', name: '21 days of mobility', exercise: null, type: 'mobility-streak', target: 21 },
    ],
  },
]

/**
 * Get a program by id from the built-in list only.
 * For resolution that includes custom programs, use resolveProgram() or useProgramDef().
 */
export function getProgramById(id) {
  return PROGRAMS.find(p => p.id === id) || null
}

/**
 * Resolve a program from built-ins OR a list of custom programs.
 * customPrograms: array of custom program docs from Firestore.
 */
export function resolveProgram(id, customPrograms = []) {
  return PROGRAMS.find(p => p.id === id) || customPrograms.find(p => p.id === id) || null
}

/**
 * Given an activeProgram object from settings, compute the current week number (1-indexed).
 * Uses durationWeeks from the program definition if provided.
 */
export function computeWeekNumber(activeProgram, programDef = null) {
  if (!activeProgram?.startDate) return 1
  const start = new Date(activeProgram.startDate)
  const now = new Date()
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  const maxWeek = programDef?.durationWeeks || 52
  return Math.min(Math.floor(diffDays / 7) + 1, maxWeek)
}

/**
 * Get today's scheduled workout key from program's weekly schedule.
 * scheduleMode: 'fixed' (default) = day-of-week based
 *               'sequential' = next slot after last completed, cycling through slots
 *
 * Returns the workout key (e.g. 'A', 'Push', 'LiftA') or 'rest'.
 */
export function getTodayWorkout(program, activeProgram) {
  if (!program || !activeProgram?.startDate) return null
  const schedule = program.weeklySchedule || []
  if (!schedule.length) return 'rest'

  const mode = activeProgram.scheduleMode || 'fixed'

  if (mode === 'sequential') {
    // Count total sessions completed
    const completedCount = Object.keys(activeProgram.completedSessions || {}).length
    // Find the next non-rest slot
    const nonRestSlots = schedule.filter(s => s !== 'rest')
    if (!nonRestSlots.length) return 'rest'
    // Check if today is already marked done
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayDone = !!(activeProgram.completedSessions || {})[todayStr]
    if (todayDone) {
      // Already done today — show what was done
      return (activeProgram.completedSessions || {})[todayStr] || 'rest'
    }
    const idx = completedCount % nonRestSlots.length
    return nonRestSlots[idx]
  }

  // Default: fixed day-of-week
  const dayOfWeek = new Date().getDay() // 0=Sun
  const monIdx = (dayOfWeek + 6) % 7
  return schedule[monIdx] || 'rest'
}
