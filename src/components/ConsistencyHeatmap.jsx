/**
 * ConsistencyHeatmap — goal-aware 90-day activity heatmap.
 * Props:
 *   entries: array of { date: 'YYYY-MM-DD', type: 'lift'|'cardio'|'nutrition'|'wellbeing'|'selfcare' }
 *   gymGoal: number (sessions per week, default 3)
 *   days: number (default 90)
 */
import { format, subDays, startOfWeek } from 'date-fns'

export default function ConsistencyHeatmap({ entries = [], gymGoal = 3, days = 90 }) {
  const today = new Date()

  // Build per-date type sets
  const byDate = {}
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = new Set()
    byDate[e.date].add(e.type)
  })

  // Build day objects
  const dayObjects = []
  for (let i = 0; i < days; i++) {
    const d = subDays(today, days - 1 - i)
    const dateStr = format(d, 'yyyy-MM-dd')
    const types = byDate[dateStr] || new Set()
    dayObjects.push({ dateStr, types, d })
  }

  // Group into weeks (columns of 7)
  const weeks = []
  for (let i = 0; i < dayObjects.length; i += 7) {
    weeks.push(dayObjects.slice(i, i + 7))
  }

  // Colour logic: primary activity type for the day
  function cellStyle(types) {
    if (types.size === 0) return { bg: 'bg-surfaceAlt', opacity: 1 }
    if (types.has('lift')) return { bg: 'bg-accent', opacity: types.size > 1 ? 1 : 0.85 }
    if (types.has('cardio')) return { bg: 'bg-success', opacity: 0.85 }
    if (types.has('nutrition')) return { bg: 'bg-warn', opacity: 0.7 }
    if (types.has('wellbeing')) return { bg: 'bg-pink-400', opacity: 0.7 }
    return { bg: 'bg-purple-400', opacity: 0.7 }
  }

  // Weekly gym sessions for goal-hit indicators
  const weeklyGym = {}
  entries.filter(e => e.type === 'lift').forEach(e => {
    const mon = format(startOfWeek(new Date(e.date + 'T00:00:00'), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    if (!weeklyGym[mon]) weeklyGym[mon] = new Set()
    weeklyGym[mon].add(e.date)
  })

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {weeks.map((week, wi) => {
          const monDate = week[0]?.dateStr
          const gymCount = weeklyGym[monDate]?.size || 0
          const hitGoal = gymCount >= gymGoal
          return (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => {
                const { bg, opacity } = cellStyle(day.types)
                const label = [...day.types].join(', ') || 'nothing logged'
                return (
                  <div
                    key={day.dateStr}
                    title={`${day.dateStr}: ${label}`}
                    className={`w-3 h-3 rounded-sm ${bg} cursor-default transition-all hover:scale-125`}
                    style={{ opacity }}
                  />
                )
              })}
              {/* Goal indicator dot below week column */}
              <div className={`w-3 h-1 rounded-sm mt-0.5 ${hitGoal ? 'bg-success' : 'bg-surfaceAlt/40'}`}
                title={`Week gym: ${gymCount}/${gymGoal}`}/>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted mt-1">Last {days} days · green dot = gym goal hit that week</p>
    </div>
  )
}
