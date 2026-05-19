/**
 * Shared weight chart — used on Today (compact) and Insights (detailed).
 * Shows: raw weight, 7-day rolling average, optional target trajectory line.
 */
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts'
import { format, subDays, addDays } from 'date-fns'

/** Linear regression: returns { slope, intercept } for array of [x, y] pairs */
function linreg(points) {
  if (points.length < 2) return { slope: 0, intercept: 0 }
  const n = points.length
  const sumX = points.reduce((a, p) => a + p[0], 0)
  const sumY = points.reduce((a, p) => a + p[1], 0)
  const sumXY = points.reduce((a, p) => a + p[0] * p[1], 0)
  const sumXX = points.reduce((a, p) => a + p[0] * p[0], 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: sumY / n }
  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n
  return { slope, intercept }
}

/**
 * Compute actual weekly rate from last 14 days using linear regression.
 * Returns kg/week (negative = loss, positive = gain)
 */
export function computeWeeklyRate(weights) {
  const cutoff = format(subDays(new Date(), 14), 'yyyy-MM-dd')
  const recent = weights
    .filter(w => w.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (recent.length < 2) return null
  const t0 = new Date(recent[0].date).getTime()
  const points = recent.map(w => [
    (new Date(w.date).getTime() - t0) / (1000 * 60 * 60 * 24),
    parseFloat(w.weight),
  ])
  const { slope } = linreg(points)
  return parseFloat((slope * 7).toFixed(2)) // kg per week
}

/**
 * Build chart data array from raw weights array.
 * Optional goalSettings: { targetWeight, rateKgPerWeek, startWeight, startDate }
 */
export function buildChartData(weights, goalSettings = null) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  if (!sorted.length) return []

  // 7-day rolling avg
  const data = sorted.map((w, i) => {
    const slice = sorted.slice(Math.max(0, i - 6), i + 1)
    const avg = slice.reduce((s, x) => s + parseFloat(x.weight || 0), 0) / slice.length
    const entry = {
      date: w.date.slice(5),
      fullDate: w.date,
      weight: parseFloat(w.weight),
      avg: parseFloat(avg.toFixed(1)),
    }
    return entry
  })

  // Target trajectory overlay
  if (goalSettings && goalSettings.targetWeight && goalSettings.rateKgPerWeek) {
    const { targetWeight, rateKgPerWeek } = goalSettings
    const startW = goalSettings.startWeight || parseFloat(sorted[0].weight)
    const startDate = goalSettings.startDate || sorted[0].date
    const startMs = new Date(startDate).getTime()
    const dayRateKg = rateKgPerWeek / 7
    const isLoss = targetWeight < startW
    const isGain = targetWeight > startW

    data.forEach(entry => {
      const daysDiff = (new Date(entry.fullDate).getTime() - startMs) / (1000 * 60 * 60 * 24)
      if (daysDiff < 0) return
      let target = isLoss
        ? Math.max(targetWeight, startW - dayRateKg * daysDiff)
        : isGain
          ? Math.min(targetWeight, startW + dayRateKg * daysDiff)
          : startW
      entry.target = parseFloat(target.toFixed(1))
    })
  }

  return data
}

/**
 * WeightChart component.
 * Props:
 *   weights: array of weight docs
 *   goalSettings: optional { targetWeight, rateKgPerWeek, startWeight, startDate }
 *   height: chart height in px (default 160)
 *   compact: boolean — hides grid, labels on compact mode
 */
export default function WeightChart({ weights = [], goalSettings = null, height = 160, compact = false }) {
  const data = buildChartData(weights, goalSettings)

  if (data.length < 2) {
    return <p className="text-sm text-muted py-6 text-center">Not enough weight data yet.</p>
  }

  const hasTarget = data.some(d => d.target !== undefined)
  const tickStyle = { fill: '#94a3b8', fontSize: compact ? 9 : 10 }
  const tooltipStyle = { background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', fontSize: 12 }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        {!compact && <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>}
        <XAxis dataKey="date" tick={tickStyle} interval="preserveStartEnd" hide={compact}/>
        <YAxis tick={tickStyle} domain={['auto', 'auto']} width={compact ? 0 : 36} hide={compact}/>
        <Tooltip contentStyle={tooltipStyle}/>
        <Line type="monotone" dataKey="weight" stroke="#22d3ee" dot={false} strokeWidth={1.5} name="Weight kg"/>
        <Line type="monotone" dataKey="avg" stroke="#f59e0b" dot={false} strokeWidth={1.5}
          strokeDasharray="4 2" name="7d avg"/>
        {hasTarget && (
          <Line type="monotone" dataKey="target" stroke="#10b981" dot={false} strokeWidth={1.5}
            strokeDasharray="6 3" name="Target"/>
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}
