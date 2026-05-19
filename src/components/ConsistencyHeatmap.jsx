/**
 * ConsistencyHeatmap — GitHub-style 90-day heatmap.
 * Shows daily activity across: weight logged, meals logged, training, meds taken, mood logged.
 *
 * Props:
 *   weights: array of { date } objects
 *   nutritionLog: array of { date } objects
 *   lifts: array of { date } objects
 *   cardio: array of { date } objects
 *   medicationLog: array of { date } objects
 *   wellbeing: array of { date } objects
 *   days: number (default 90)
 */
import { format, subDays } from 'date-fns'

const CATEGORIES = [
  { key: 'weight', label: 'Weight', color: '#22d3ee' },
  { key: 'meals', label: 'Meals', color: '#10b981' },
  { key: 'training', label: 'Training', color: '#f59e0b' },
  { key: 'meds', label: 'Meds', color: '#a78bfa' },
  { key: 'mood', label: 'Mood', color: '#fb923c' },
]

export default function ConsistencyHeatmap({
  weights = [],
  nutritionLog = [],
  lifts = [],
  cardio = [],
  medicationLog = [],
  wellbeing = [],
  days = 90,
}) {
  const today = new Date()
  const startDate = subDays(today, days - 1)

  // Build sets for fast lookup
  const sets = {
    weight: new Set(weights.map(w => w.date)),
    meals: new Set(nutritionLog.map(n => n.date)),
    training: new Set([...lifts.map(l => l.date), ...cardio.map(c => c.date)]),
    meds: new Set(medicationLog.map(m => m.date)),
    mood: new Set(wellbeing.map(w => w.date)),
  }

  // Build array of day objects
  const dayObjects = []
  for (let i = 0; i < days; i++) {
    const d = subDays(today, days - 1 - i)
    const dateStr = format(d, 'yyyy-MM-dd')
    const count = CATEGORIES.filter(c => sets[c.key].has(dateStr)).length
    dayObjects.push({ dateStr, count, d })
  }

  // Group into weeks (columns of 7)
  const weeks = []
  for (let i = 0; i < dayObjects.length; i += 7) {
    weeks.push(dayObjects.slice(i, i + 7))
  }

  function cellColor(count) {
    if (count === 0) return 'bg-surfaceAlt'
    if (count === 1) return 'bg-accent/20'
    if (count === 2) return 'bg-accent/40'
    if (count === 3) return 'bg-accent/60'
    if (count === 4) return 'bg-accent/80'
    return 'bg-accent'
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3">
        {CATEGORIES.map(c => (
          <div key={c.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c.color }}/>
            {c.label}
          </div>
        ))}
      </div>

      {/* Intensity legend */}
      <div className="flex items-center gap-1.5 text-xs text-muted mb-3">
        <span>Less</span>
        {[0,1,2,3,4,5].map(n => (
          <span key={n} className={`w-3 h-3 rounded-sm inline-block ${cellColor(n)}`}/>
        ))}
        <span>More</span>
      </div>

      {/* Grid */}
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.dateStr}
                title={`${day.dateStr}: ${day.count}/5 categories`}
                className={`w-3 h-3 rounded-sm ${cellColor(day.count)} cursor-default transition-all hover:scale-125`}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted mt-2">Last {days} days · darker = more categories logged</p>
    </div>
  )
}
