/**
 * MoodPicker — 5-point emoji scale selector.
 * Props:
 *   value: 1-5 | null
 *   onChange: (value: number) => void
 *   label: string (optional)
 *   compact: bool — smaller layout
 */
export default function MoodPicker({ value, onChange, label, compact = false }) {
  const options = [
    { v: 1, emoji: '😞', text: 'Very low' },
    { v: 2, emoji: '😐', text: 'Low' },
    { v: 3, emoji: '🙂', text: 'Okay' },
    { v: 4, emoji: '😊', text: 'Good' },
    { v: 5, emoji: '🤩', text: 'Excellent' },
  ]

  return (
    <div>
      {label && <div className="label mb-2">{label}</div>}
      <div className={`flex ${compact ? 'gap-1' : 'gap-2'}`}>
        {options.map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            title={o.text}
            className={`flex flex-col items-center rounded-xl transition-all ${
              compact ? 'px-2 py-1.5 text-lg' : 'px-3 py-2 text-2xl'
            } ${
              value === o.v
                ? 'bg-accent/20 ring-2 ring-accent scale-110'
                : 'bg-surfaceAlt hover:bg-accent/10 hover:scale-105'
            }`}
          >
            <span>{o.emoji}</span>
            {!compact && <span className="text-xs text-muted mt-1">{o.text}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
