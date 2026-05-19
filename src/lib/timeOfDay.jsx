/**
 * Time-of-day helper utilities.
 *
 * Convention:
 *   morning   = before 12:00
 *   afternoon = 12:00–17:00
 *   evening   = 17:00–21:00
 *   night     = 21:00+
 */

export const TIME_OF_DAY_OPTIONS = [
  { value: 'morning',   label: 'Morning',   emoji: '🌅' },
  { value: 'afternoon', label: 'Afternoon', emoji: '☀️' },
  { value: 'evening',   label: 'Evening',   emoji: '🌇' },
  { value: 'night',     label: 'Night',     emoji: '🌙' },
]

/** Detect current time-of-day bucket */
export function detectTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  if (h < 21) return 'evening'
  return 'night'
}

/** Return emoji + label for a TOD value */
export function todLabel(tod) {
  const opt = TIME_OF_DAY_OPTIONS.find(o => o.value === tod)
  return opt ? `${opt.emoji} ${opt.label}` : ''
}

/** Small chip element (returns string for inline use) */
export function TodChip({ tod, className = '' }) {
  if (!tod) return null
  const opt = TIME_OF_DAY_OPTIONS.find(o => o.value === tod)
  if (!opt) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs bg-surfaceAlt text-muted rounded-full px-2 py-0.5 ${className}`}>
      {opt.emoji} {opt.label}
    </span>
  )
}

/** Select element for time-of-day (controlled) */
export function TodSelect({ value, onChange, className = '', nullable = true }) {
  return (
    <select
      className={`input ${className}`}
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
    >
      {nullable && <option value="">— Time of day —</option>}
      {TIME_OF_DAY_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>
      ))}
    </select>
  )
}
