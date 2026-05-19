/**
 * Medication due-today logic + pharmacokinetic helpers.
 *
 * med.frequency: 'daily' | 'weekly' | 'specific-days' | 'asNeeded'
 * For 'specific-days': med.daysOfWeek is an array of integers 0-6 where 0 = Sunday.
 */

/**
 * @param {object} med
 * @param {string} today  - 'YYYY-MM-DD'
 * @param {string|null} lastTaken - 'YYYY-MM-DD' or null
 * @returns {boolean}
 */
export function isMedDueToday(med, today, lastTaken) {
  if (!med || !med.frequency) return false

  switch (med.frequency) {
    case 'daily':
      return lastTaken !== today

    case 'weekly': {
      if (!lastTaken) return true
      const days = daysBetween(lastTaken, today)
      return days >= 7
    }

    case 'specific-days': {
      // Today's day-of-week must be in the med's selected days, AND we haven't logged it today.
      const dow = new Date(today + 'T00:00:00').getDay()
      const selected = Array.isArray(med.daysOfWeek) ? med.daysOfWeek : []
      if (!selected.includes(dow)) return false
      return lastTaken !== today
    }

    case 'asNeeded':
      return false

    default:
      return false
  }
}

/**
 * Most recent SCHEDULED log date (YYYY-MM-DD) for a med, or null.
 *
 * Out-of-schedule / stat / catch-up doses (logs with `outOfSchedule: true`) are
 * EXCLUDED here so the next-due calculation isn't shifted by a late dose.
 * Use `lastAnyDoseDate` for the PK level chart which needs every dose.
 */
export function lastTakenDate(logs, medId) {
  const relevant = logs
    .filter(l => l.medId === medId && l.date && !l.outOfSchedule)
    .sort((a, b) => b.date.localeCompare(a.date))
  return relevant.length > 0 ? relevant[0].date : null
}

/** Most recent log date for a med INCLUDING out-of-schedule doses. */
export function lastAnyDoseDate(logs, medId) {
  const relevant = logs
    .filter(l => l.medId === medId && l.date)
    .sort((a, b) => b.date.localeCompare(a.date))
  return relevant.length > 0 ? relevant[0].date : null
}

/** Days between two YYYY-MM-DD dates (b - a). */
function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return (db.getTime() - da.getTime()) / 86400000
}

/**
 * First-order elimination PK model for a single med with a list of dose events.
 *
 *   level(t) = sum_i  dose_i  *  0.5 ^ ((t - t_i) / t_half)         for t_i <= t
 *
 * This assumes:
 *   - one-compartment model
 *   - 100% bioavailability (we report "active level" in dose-equivalent units)
 *   - the user enters half-life in hours
 *
 * Returns an array of { date, level } points sampled daily over the window.
 *
 * @param {Array<{date:string}>} doseLog - entries with `date` (YYYY-MM-DD). Each entry = 1 dose of `doseAmount`.
 * @param {number} doseAmount - mg per dose
 * @param {number} halfLifeHours
 * @param {string} fromDate - YYYY-MM-DD (inclusive)
 * @param {string} toDate - YYYY-MM-DD (inclusive)
 * @returns {Array<{date:string, level:number}>}
 */
export function computeDrugLevel(doseLog, doseAmount, halfLifeHours, fromDate, toDate) {
  if (!halfLifeHours || halfLifeHours <= 0) return []
  if (!doseAmount || doseAmount <= 0) return []

  const t0 = new Date(fromDate + 'T00:00:00').getTime()
  const t1 = new Date(toDate + 'T00:00:00').getTime()
  if (t1 < t0) return []

  const doses = (doseLog || [])
    .filter(d => d.date)
    .map(d => new Date(d.date + 'T00:00:00').getTime())
    .sort((a, b) => a - b)

  const points = []
  const dayMs = 86400000
  for (let t = t0; t <= t1; t += dayMs) {
    let level = 0
    for (const dt of doses) {
      if (dt > t) break
      const hoursSince = (t - dt) / 3600000
      level += doseAmount * Math.pow(0.5, hoursSince / halfLifeHours)
    }
    points.push({
      date: new Date(t).toISOString().slice(0, 10),
      level: +level.toFixed(2),
    })
  }
  return points
}

/** Steady-state target level for a fixed-interval regimen. Used as a reference line. */
export function steadyStateLevel(doseAmount, halfLifeHours, intervalHours) {
  if (!halfLifeHours || !intervalHours) return null
  const decay = Math.pow(0.5, intervalHours / halfLifeHours)
  // Geometric series sum: dose * 1/(1-decay)   (limit of trough levels at steady state)
  return +(doseAmount * (1 / (1 - decay))).toFixed(2)
}

/** Common day-of-week labels (Sun=0..Sat=6) for UI. */
export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
