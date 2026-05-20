/**
 * ConsistencyHeatmap — 12-week goal-aware activity heatmap.
 *
 * Layout: columns = weeks (Mon–Sun), oldest week on left, newest on right.
 * Row labels M–S on the left. Month labels above columns where month changes.
 *
 * Props:
 *   entries:  { date: 'YYYY-MM-DD', type: 'lift'|'cardio'|'nutrition'|'wellbeing'|'selfcare' }[]
 *   gymGoal:  number of gym sessions per week (default 3)
 *   weeks:    number of full weeks to show (default 12)
 */
import { format, startOfWeek, addDays, isFuture, isToday } from 'date-fns'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

// Priority order when multiple activity types logged on the same day
const TYPE_PRIORITY = ['lift', 'cardio', 'wellbeing', 'nutrition', 'selfcare']

const TYPE_STYLE = {
  lift:      { cell: 'bg-accent',      dot: 'bg-accent' },
  cardio:    { cell: 'bg-success',     dot: 'bg-success' },
  nutrition: { cell: 'bg-warn',        dot: 'bg-warn' },
  wellbeing: { cell: 'bg-pink-400',    dot: 'bg-pink-400' },
  selfcare:  { cell: 'bg-purple-400',  dot: 'bg-purple-400' },
}

export default function ConsistencyHeatmap({ entries = [], gymGoal = 3, weeks: numWeeks = 12 }) {
  // Build per-date type sets from entries
  const byDate = {}
  entries.forEach(e => {
    if (!e.date) return
    if (!byDate[e.date]) byDate[e.date] = new Set()
    byDate[e.date].add(e.type)
  })

  // Build weekly gym count keyed by that week's Monday
  const weeklyGym = {}
  entries.filter(e => e.type === 'lift').forEach(e => {
    const mon = format(startOfWeek(new Date(e.date + 'T12:00:00'), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    weeklyGym[mon] = (weeklyGym[mon] || 0) + 1
  })

  // Find the Monday of the current week
  const todayDate = new Date()
  const currentMonday = startOfWeek(todayDate, { weekStartsOn: 1 })

  // Build array of 12 weeks: oldest first (left), newest last (right)
  // Week 0 = 11 weeks ago, Week 11 = this week
  const weekCols = []
  for (let w = numWeeks - 1; w >= 0; w--) {
    const monday = new Date(currentMonday)
    monday.setDate(currentMonday.getDate() - w * 7)
    const days = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(monday, d)
      const dateStr = format(date, 'yyyy-MM-dd')
      const types = byDate[dateStr] || new Set()
      days.push({ date, dateStr, types, future: isFuture(date) && !isToday(date) })
    }
    const monStr = format(monday, 'yyyy-MM-dd')
    weekCols.push({
      monday,
      monStr,
      days,
      gymCount: weeklyGym[monStr] || 0,
      monthLabel: format(monday, 'MMM'),
    })
  }

  // Figure out which columns should show a month label
  // Show the label when the month changes from the previous column
  weekCols.forEach((wk, i) => {
    const prevMonth = i > 0 ? weekCols[i - 1].monthLabel : null
    wk.showMonth = wk.monthLabel !== prevMonth
  })

  // Determine primary colour for a cell
  function cellColour(types, future) {
    if (future) return null          // future days = no colour
    if (types.size === 0) return null // empty
    for (const t of TYPE_PRIORITY) {
      if (types.has(t)) return TYPE_STYLE[t].cell
    }
    return null
  }

  const CELL = 'w-5 h-5 rounded'   // 20×20px cells — comfortable tap target

  return (
    <div className="w-full overflow-x-auto">
      {/* Month labels row */}
      <div className="flex mb-1 ml-5">
        {weekCols.map((wk, wi) => (
          <div key={wi} className="w-5 mr-1 shrink-0">
            {wk.showMonth && (
              <span className="text-[10px] text-muted leading-none">{wk.monthLabel}</span>
            )}
          </div>
        ))}
      </div>

      {/* Grid: day-row labels on left, week columns */}
      <div className="flex gap-0">
        {/* Day-of-week labels */}
        <div className="flex flex-col gap-1 mr-1 shrink-0">
          {DAY_LABELS.map((label, i) => (
            <div key={i} className="w-4 h-5 flex items-center justify-end">
              {/* Only show Mon, Wed, Fri to avoid crowding */}
              {(i === 0 || i === 2 || i === 4) && (
                <span className="text-[10px] text-muted leading-none">{label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Week columns */}
        {weekCols.map((wk, wi) => {
          const hitGoal = wk.gymCount >= gymGoal
          const isCurrentWeek = wi === weekCols.length - 1
          return (
            <div key={wi} className="flex flex-col gap-1 mr-1 shrink-0">
              {wk.days.map((day, di) => {
                const colour = cellColour(day.types, day.future)
                const isToday_ = isToday(day.date)
                const label = day.future
                  ? day.dateStr
                  : `${day.dateStr}: ${[...day.types].join(', ') || 'nothing logged'}`
                return (
                  <div
                    key={di}
                    title={label}
                    className={[
                      CELL,
                      colour || 'bg-surfaceAlt',
                      day.future ? 'opacity-20' : 'opacity-100',
                      isToday_ ? 'ring-2 ring-accent ring-offset-1 ring-offset-bg' : '',
                      !day.future && !colour ? 'opacity-40' : '',
                      'cursor-default transition-opacity hover:opacity-100',
                    ].filter(Boolean).join(' ')}
                  />
                )
              })}
              {/* Goal indicator bar below each week column */}
              <div
                title={`${wk.gymCount}/${gymGoal} gym sessions`}
                className={[
                  'h-1 rounded-full mt-0.5',
                  CELL.split(' ')[0], // same width (w-5)
                  hitGoal ? 'bg-success' : wk.gymCount > 0 ? 'bg-warn' : 'bg-surfaceAlt/30',
                ].join(' ')}
              />
            </div>
          )
        })}
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-muted">
        {[
          { label: 'Gym',              style: TYPE_STYLE.lift.cell },
          { label: 'Cardio',           style: TYPE_STYLE.cardio.cell },
          { label: 'Nutrition',        style: TYPE_STYLE.nutrition.cell },
          { label: 'Wellbeing',        style: TYPE_STYLE.wellbeing.cell },
          { label: 'Self-care',        style: TYPE_STYLE.selfcare.cell },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded-sm ${l.style}`}/>
            {l.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 ml-auto">
          <span className="inline-block w-5 h-1 rounded-full bg-success"/>
          Gym goal hit
          <span className="inline-block w-5 h-1 rounded-full bg-warn ml-2"/>
          Partial
        </span>
      </div>
    </div>
  )
}
