/**
 * Medication due-today logic.
 * med.frequency: 'daily' | 'weekly' | 'asNeeded'
 */

/**
 * @param {object} med - medication document
 * @param {string} today - 'YYYY-MM-DD'
 * @param {string|null} lastTaken - 'YYYY-MM-DD' of last medicationLog entry for this med, or null
 * @returns {boolean}
 */
export function isMedDueToday(med, today, lastTaken) {
  if (!med || !med.frequency) return false

  switch (med.frequency) {
    case 'daily':
      // Due if not already taken today
      return lastTaken !== today

    case 'weekly': {
      if (!lastTaken) return true
      const last = new Date(lastTaken)
      const now = new Date(today)
      const diffMs = now.getTime() - last.getTime()
      const diffDays = diffMs / (1000 * 60 * 60 * 24)
      return diffDays >= 7
    }

    case 'asNeeded':
      // Never auto-due — user decides
      return false

    default:
      return false
  }
}

/**
 * Given a list of medicationLog entries for a specific med,
 * returns the most recent date taken (YYYY-MM-DD) or null.
 */
export function lastTakenDate(logs, medId) {
  const relevant = logs
    .filter(l => l.medId === medId && l.date)
    .sort((a, b) => b.date.localeCompare(a.date))
  return relevant.length > 0 ? relevant[0].date : null
}
