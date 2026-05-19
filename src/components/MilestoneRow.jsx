/**
 * MilestoneRow — shows a single milestone with progress bar.
 */
import { Trophy, CheckCircle } from 'lucide-react'

export default function MilestoneRow({ milestone, progress = 0, hit = false, hitDate = null, currentKg = null, targetKg = null }) {
  const pct = Math.min(100, Math.round(progress * 100))

  return (
    <div className={`rounded-xl p-3 mb-2 ${hit ? 'bg-warn/10 border border-warn/20' : 'bg-surfaceAlt'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {hit
            ? <CheckCircle size={14} className="text-warn shrink-0"/>
            : <Trophy size={14} className="text-muted shrink-0"/>
          }
          <span className={`text-sm font-medium truncate ${hit ? 'text-warn' : 'text-text'}`}>
            {milestone.name}
          </span>
        </div>
        <span className="text-xs text-muted shrink-0 ml-2">
          {hit && hitDate ? `✓ ${hitDate}` : `${pct}%`}
        </span>
      </div>

      {!hit && (
        <div className="w-full bg-bg rounded-full h-1.5 mb-1">
          <div
            className="bg-accent h-1.5 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {!hit && currentKg !== null && targetKg !== null && (
        <div className="text-xs text-muted">
          Current: <span className="text-accent">{currentKg.toFixed(1)} kg</span>
          {' '}· Target: <span className="text-text">{targetKg.toFixed(1)} kg</span>
        </div>
      )}
    </div>
  )
}
