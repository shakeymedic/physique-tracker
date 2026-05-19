/**
 * Achievement / badge computation.
 * All data is computed client-side from existing Firestore collections.
 */

import { format, subDays, startOfWeek } from 'date-fns'

// ── Streak helpers ─────────────────────────────────────────────────────────────

/**
 * Compute current + longest streak of consecutive days from a set of date strings.
 * @param {string[]} dates - array of 'YYYY-MM-DD' strings
 * @returns {{ current: number, longest: number }}
 */
function dateStreak(dates) {
  if (!dates || dates.length === 0) return { current: 0, longest: 0 }
  const unique = [...new Set(dates)].sort()
  let longest = 1, current = 1
  for (let i = 1; i < unique.length; i++) {
    const prev = new Date(unique[i - 1])
    const curr = new Date(unique[i])
    const diff = Math.round((curr - prev) / 86400000)
    if (diff === 1) {
      current++
      if (current > longest) longest = current
    } else {
      current = 1
    }
  }
  // Check if streak is still active (last date is today or yesterday)
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd')
  const lastDate = unique[unique.length - 1]
  if (lastDate !== todayStr && lastDate !== yesterdayStr) {
    current = 0
  }
  return { current, longest }
}

/**
 * How many complete weeks (Mon–Sun) hit the gym goal.
 * @param {string[]} liftDates - sorted lift session dates
 * @param {number} gymGoal - sessions per week goal
 * @returns {{ current: number, longest: number, totalWeeks: number }}
 */
function gymWeekStreak(liftDates, gymGoal = 3) {
  if (!liftDates.length) return { current: 0, longest: 0, totalWeeks: 0 }

  // Group dates by ISO week string (YYYY-Www)
  const byWeek = {}
  liftDates.forEach(d => {
    const mon = startOfWeek(new Date(d), { weekStartsOn: 1 })
    const key = format(mon, 'yyyy-MM-dd')
    if (!byWeek[key]) byWeek[key] = new Set()
    byWeek[key].add(d)
  })

  const weeks = Object.keys(byWeek).sort()
  let current = 0, longest = 0, totalWeeks = 0
  let streak = 0

  for (let i = 0; i < weeks.length; i++) {
    const sessions = byWeek[weeks[i]].size
    if (sessions >= gymGoal) {
      streak++
      totalWeeks++
      if (streak > longest) longest = streak
    } else {
      streak = 0
    }
  }

  // Is the current week still in progress? Check if last week hit the goal
  const thisWeekMon = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const lastWeek = weeks[weeks.length - 1]
  current = lastWeek >= thisWeekMon ? streak : 0

  return { current, longest, totalWeeks }
}

// ── Badge definitions ──────────────────────────────────────────────────────────

export const BADGE_DEFS = [
  { id: 'first-weigh',       name: 'First Step',         icon: 'Scale',     desc: 'Log your first weight entry' },
  { id: 'week-warrior',      name: 'Week Warrior',        icon: 'Calendar',  desc: '7-day weigh-in streak' },
  { id: 'month-mornings',    name: 'Month of Mornings',   icon: 'Sun',       desc: '30-day weigh-in streak' },
  { id: 'iron-beginner',     name: 'Iron Beginner',       icon: 'Dumbbell',  desc: 'Log your first lift session' },
  { id: 'pr-hunter',         name: 'PR Hunter',           icon: 'Trophy',    desc: 'Set your first personal record' },
  { id: 'triple-threat',     name: 'Triple Threat',       icon: 'Zap',       desc: 'PR in bench, squat, and deadlift' },
  { id: 'cardio-convert',    name: 'Cardio Convert',      icon: 'HeartPulse', desc: 'Log your first cardio session' },
  { id: 'endurance',         name: 'Endurance',           icon: 'Activity',  desc: '10 cardio sessions logged' },
  { id: 'goal-crusher',      name: 'Goal Crusher',        icon: 'Target',    desc: 'Hit your weekly gym goal' },
  { id: 'steady-eddie',      name: 'Steady Eddie',        icon: 'TrendingUp', desc: '4 consecutive weeks hitting gym goal' },
  { id: 'macro-master',      name: 'Macro Master',        icon: 'Apple',     desc: 'Hit macro targets (±5%) for 7 days' },
  { id: 'hydrated',          name: 'Hydrated',            icon: 'Droplets',  desc: 'Log meals 7 days in a row' },
  { id: 'selfcare-champion', name: 'Self-Care Champion',  icon: 'Heart',     desc: 'Hit weekly self-care goal' },
  { id: 'mood-tracker',      name: 'Mood Tracker',        icon: 'Smile',     desc: '14-day mood-log streak' },
  { id: 'med-adherent',      name: 'Med Adherent',        icon: 'Pill',      desc: '30 days no missed scheduled meds' },
  // ── Program milestones ──
  { id: 'program-enrolled',   name: 'Committed',            icon: 'Zap',       desc: 'Enrol in a workout program' },
  { id: 'program-week4',      name: 'Month Strong',         icon: 'Calendar',  desc: 'Complete 4 weeks of a program' },
  { id: 'program-complete',   name: 'Program Complete',     icon: 'Trophy',    desc: 'Finish a 12-week program' },
  { id: 'mobility-7',         name: 'Mobility Habit',       icon: 'Activity',  desc: '7 mobility sessions logged' },
  { id: 'mobility-30',        name: 'Flexible',             icon: 'Heart',     desc: '30 mobility sessions logged' },
  { id: 'milestone-first',    name: 'Milestone Hit',        icon: 'CheckCircle', desc: 'Hit your first program milestone' },
]

// ── Main computation ───────────────────────────────────────────────────────────

/**
 * Compute all achievements from raw data.
 * Returns { streaks, badges }
 */
export function computeAchievements({ weights = [], lifts = [], cardio = [], nutritionLog = [], medicationLog = [], wellbeing = [], selfCareLog = [], mobilityLog = [], settings = {} }) {
  const goals = settings.activityGoals || {}
  const gymGoal = goals.gymPerWeek || 3
  const nutritionTargets = settings.nutritionTargets || {}
  const selfCareGoal = goals.selfCarePerWeek || 5

  // ── Streaks ──────────────────────────────────────────────────────────────────
  const weightDates = weights.map(w => w.date)
  const mealDates = nutritionLog.map(n => n.date)
  const moodDates = wellbeing.map(w => w.date)

  // Lift sessions (new multi-exercise model or old single)
  const liftDates = lifts.map(l => l.date)
  const { current: gymWeekCurrent, longest: gymWeekLongest } = gymWeekStreak(liftDates, gymGoal)

  const streaks = {
    weighIn: dateStreak(weightDates),
    mealsLogged: dateStreak(mealDates),
    gymWeeks: { current: gymWeekCurrent, longest: gymWeekLongest },
    mood: dateStreak(moodDates),
  }

  // ── PR detection ─────────────────────────────────────────────────────────────
  const prsEver = new Set()
  lifts.forEach(l => {
    // Handle both old shape (l.prs = [...]) and new (l.prs computed per exercise)
    ;(l.prs || []).forEach(p => prsEver.add(p))
  })

  const hasBenchPR = prsEver.has('Bench Press')
  const hasSquatPR = prsEver.has('Squat')
  const hasDeadliftPR = prsEver.has('Deadlift')

  // ── Macro target adherence (7 days) ─────────────────────────────────────────
  let macroMasterDays = 0
  if (nutritionTargets.kcal) {
    const last30 = nutritionLog.filter(n => {
      return n.date >= format(subDays(new Date(), 30), 'yyyy-MM-dd')
    })
    const byDate = {}
    last30.forEach(n => {
      if (!byDate[n.date]) byDate[n.date] = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      byDate[n.date].kcal += parseFloat(n.kcal) || 0
      byDate[n.date].protein += parseFloat(n.protein) || 0
      byDate[n.date].carbs += parseFloat(n.carbs) || 0
      byDate[n.date].fat += parseFloat(n.fat) || 0
    })
    Object.values(byDate).forEach(day => {
      const kcalOk = nutritionTargets.kcal && Math.abs(day.kcal - nutritionTargets.kcal) / nutritionTargets.kcal <= 0.05
      const proteinOk = nutritionTargets.protein && Math.abs(day.protein - nutritionTargets.protein) / nutritionTargets.protein <= 0.05
      if (kcalOk && proteinOk) macroMasterDays++
    })
  }

  // ── Self-care weekly goal hit ────────────────────────────────────────────────
  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const thisWeekSelfCare = selfCareLog.filter(s => s.date >= thisWeekStart).length


  // ── Program milestone data ─────────────────────────────────────────────────
  const activeProgram = settings.activeProgram || null
  const programEnrolled = !!activeProgram
  const programWeekNum = activeProgram?.startDate
    ? (() => {
        const start = new Date(activeProgram.startDate)
        const diffDays = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24))
        return Math.floor(diffDays / 7) + 1
      })()
    : 0
  const programComplete = programWeekNum >= 12

  const epleyA = (w, r) => parseFloat(w) * (1 + parseFloat(r) / 30)
  function getBestE1RM(exerciseName) {
    let best = 0
    lifts.forEach(l => {
      const exs = l.exercises
        ? l.exercises
        : l.exercise ? [{ name: l.exercise, sets: l.sets || [] }] : []
      exs.filter(e => e.name === exerciseName).forEach(e => {
        ;(e.sets || []).forEach(s => {
          const v = epleyA(s.weight, s.reps)
          if (v > best) best = v
        })
      })
    })
    return best
  }

  const latestBodyWeight = weights.length
    ? weights.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.weight || 80
    : 80

  const anyMilestoneHit = [
    { ex: 'Squat', mult: 1.0 },
    { ex: 'Bench Press', mult: 0.8 },
    { ex: 'Deadlift', mult: 1.25 },
  ].some(({ ex, mult }) => getBestE1RM(ex) >= latestBodyWeight * mult)

  // ── Badge evaluation ─────────────────────────────────────────────────────────
  const badges = BADGE_DEFS.map(def => {
    let earned = false
    let date = null
    let progress = 0

    switch (def.id) {
      case 'first-weigh':
        earned = weights.length > 0
        if (earned) date = weights[weights.length - 1]?.date
        break

      case 'week-warrior':
        earned = streaks.weighIn.longest >= 7
        progress = Math.min(1, streaks.weighIn.current / 7)
        break

      case 'month-mornings':
        earned = streaks.weighIn.longest >= 30
        progress = Math.min(1, streaks.weighIn.current / 30)
        break

      case 'iron-beginner':
        earned = lifts.length > 0
        if (earned) date = lifts[lifts.length - 1]?.date
        break

      case 'pr-hunter':
        earned = prsEver.size > 0
        break

      case 'triple-threat':
        earned = hasBenchPR && hasSquatPR && hasDeadliftPR
        progress = ([hasBenchPR, hasSquatPR, hasDeadliftPR].filter(Boolean).length) / 3
        break

      case 'cardio-convert':
        earned = cardio.length > 0
        if (earned) date = cardio[cardio.length - 1]?.date
        break

      case 'endurance':
        earned = cardio.length >= 10
        progress = Math.min(1, cardio.length / 10)
        break

      case 'goal-crusher':
        earned = gymWeekStreak(liftDates, gymGoal).totalWeeks >= 1
        break

      case 'steady-eddie':
        earned = gymWeekStreak(liftDates, gymGoal).longest >= 4
        progress = Math.min(1, gymWeekStreak(liftDates, gymGoal).longest / 4)
        break

      case 'macro-master':
        earned = macroMasterDays >= 7
        progress = Math.min(1, macroMasterDays / 7)
        break

      case 'hydrated':
        earned = streaks.mealsLogged.longest >= 7
        progress = Math.min(1, streaks.mealsLogged.current / 7)
        break

      case 'selfcare-champion':
        earned = thisWeekSelfCare >= selfCareGoal
        progress = Math.min(1, thisWeekSelfCare / selfCareGoal)
        break

      case 'mood-tracker':
        earned = streaks.mood.longest >= 14
        progress = Math.min(1, streaks.mood.current / 14)
        break

      case 'med-adherent':
        // Simple heuristic: 30+ medication log entries
        earned = medicationLog.length >= 30
        progress = Math.min(1, medicationLog.length / 30)
        break

      case 'program-enrolled':
        earned = programEnrolled
        break

      case 'program-week4':
        earned = programWeekNum >= 4
        progress = Math.min(1, programWeekNum / 4)
        break

      case 'program-complete':
        earned = programComplete
        progress = Math.min(1, programWeekNum / 12)
        break

      case 'mobility-7':
        earned = mobilityLog.length >= 7
        progress = Math.min(1, mobilityLog.length / 7)
        break

      case 'mobility-30':
        earned = mobilityLog.length >= 30
        progress = Math.min(1, mobilityLog.length / 30)
        break

      case 'milestone-first':
        earned = anyMilestoneHit
        break

      default:
        break
    }

    return { ...def, earned, date: date || null, progress: progress || (earned ? 1 : 0) }
  })

  return { streaks, badges }
}
