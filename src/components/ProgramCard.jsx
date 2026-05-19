/**
 * ProgramCard — displays a program in the gallery view.
 */
import { Dumbbell, Clock, Calendar, ChevronRight, Play } from 'lucide-react'

const DIFFICULTY_STYLES = {
  beginner: 'chip-ok',
  intermediate: 'bg-warn/20 text-warn text-xs font-medium px-2 py-0.5 rounded-full',
  advanced: 'bg-danger/20 text-danger text-xs font-medium px-2 py-0.5 rounded-full',
}

const STYLE_ICONS = {
  strength: '🏋️',
  hypertrophy: '💪',
  hybrid: '⚡',
  endurance: '🏃',
}

export default function ProgramCard({ program, onView, onStart }) {
  const diffClass = DIFFICULTY_STYLES[program.difficulty] || 'chip-ok'

  return (
    <div className="card hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">{STYLE_ICONS[program.style] || '🏋️'}</span>
          <span className="font-semibold text-text">{program.name}</span>
          <span className={diffClass}>{program.difficulty}</span>
        </div>
      </div>

      <p className="text-sm text-muted mb-3 leading-relaxed">{program.description}</p>

      <div className="flex items-center gap-4 text-xs text-muted mb-4">
        <span className="flex items-center gap-1">
          <Clock size={12}/> {program.durationWeeks} weeks
        </span>
        <span className="flex items-center gap-1">
          <Calendar size={12}/> {program.daysPerWeek} days/wk
        </span>
        <span className="flex items-center gap-1">
          <Dumbbell size={12}/> {program.milestones?.length || 0} milestones
        </span>
      </div>

      <div className="flex gap-2">
        {onView && (
          <button onClick={() => onView(program)} className="btn-secondary text-xs flex items-center gap-1">
            <ChevronRight size={12}/> View details
          </button>
        )}
        {onStart && (
          <button onClick={() => onStart(program)} className="btn-primary text-xs flex items-center gap-1">
            <Play size={12}/> Start program
          </button>
        )}
      </div>
    </div>
  )
}
