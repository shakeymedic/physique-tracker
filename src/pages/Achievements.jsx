import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { subscribe, getSettings } from '../data.js'
import { computeAchievements, BADGE_DEFS } from '../lib/achievements.js'
import {
  Scale, Calendar, Sun, Dumbbell, Trophy, Zap, HeartPulse, Activity,
  Target, TrendingUp, Apple, Droplets, Heart, Smile, Pill, Award,
  ArrowLeft, Flame, Lock,
} from 'lucide-react'

// Map badge icon name → Lucide component
const ICON_MAP = {
  Scale, Calendar, Sun, Dumbbell, Trophy, Zap, HeartPulse, Activity,
  Target, TrendingUp, Apple, Droplets, Heart, Smile, Pill,
}

function BadgeIcon({ name, size = 28, className = '' }) {
  const Comp = ICON_MAP[name] || Award
  return <Comp size={size} className={className} />
}

function ProgressRing({ value = 0, size = 56, strokeWidth = 5 }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(1, value)
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={strokeWidth}
        className="text-surfaceAlt" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={strokeWidth}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className="text-accent transition-all duration-700" />
    </svg>
  )
}

function BadgeCard({ badge }) {
  const earned = badge.earned
  return (
    <div className={`relative rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition-all
      ${earned
        ? 'bg-surface border border-accent/30 shadow-sm'
        : 'bg-surface border border-border/20 opacity-50'
      }`}>
      {/* Icon / ring */}
      <div className="relative">
        <ProgressRing value={badge.progress} size={60} strokeWidth={5} />
        <div className="absolute inset-0 flex items-center justify-center">
          <BadgeIcon
            name={badge.icon}
            size={22}
            className={earned ? 'text-accent' : 'text-muted'}
          />
        </div>
        {earned && (
          <span className="absolute -top-1 -right-1 text-base leading-none" aria-label="Earned">✅</span>
        )}
        {!earned && badge.progress === 0 && (
          <span className="absolute -top-1 -right-1">
            <Lock size={12} className="text-muted" />
          </span>
        )}
      </div>

      {/* Name + desc */}
      <div>
        <div className={`text-xs font-semibold leading-snug ${earned ? 'text-text' : 'text-muted'}`}>
          {badge.name}
        </div>
        <div className="text-[10px] text-muted mt-0.5 leading-tight">{badge.desc}</div>
      </div>

      {/* Progress bar (only if not earned and has partial progress) */}
      {!earned && badge.progress > 0 && (
        <div className="w-full bg-surfaceAlt rounded-full h-1 mt-1">
          <div
            className="h-1 rounded-full bg-accent/60 transition-all duration-500"
            style={{ width: `${badge.progress * 100}%` }}
          />
        </div>
      )}

      {/* Earned date */}
      {earned && badge.date && (
        <div className="text-[10px] text-muted">Earned {badge.date}</div>
      )}
    </div>
  )
}

function StatPill({ label, value, sub }) {
  return (
    <div className="bg-surface border border-border/20 rounded-xl px-4 py-3 text-center">
      <div className="text-2xl font-bold text-accent">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted/70 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function Achievements() {
  const { user } = useAuth()
  const uid = user?.uid
  const navigate = useNavigate()

  const [weights, setWeights] = useState([])
  const [lifts, setLifts] = useState([])
  const [cardio, setCardio] = useState([])
  const [nutritionLog, setNutritionLog] = useState([])
  const [medicationLog, setMedicationLog] = useState([])
  const [wellbeing, setWellbeing] = useState([])
  const [selfCareLog, setSelfCareLog] = useState([])
  const [settings, setSettings] = useState({})

  useEffect(() => {
    if (!uid) return
    const u1 = subscribe(uid, 'weights', setWeights, { limit: 200 })
    const u2 = subscribe(uid, 'lifts', setLifts, { limit: 500 })
    const u3 = subscribe(uid, 'cardio', setCardio, { limit: 200 })
    const u4 = subscribe(uid, 'nutritionLog', setNutritionLog, { limit: 300 })
    const u5 = subscribe(uid, 'medicationLog', setMedicationLog, { limit: 200 })
    const u6 = subscribe(uid, 'wellbeing', setWellbeing, { limit: 200 })
    const u7 = subscribe(uid, 'selfCareLog', setSelfCareLog, { limit: 200 })
    getSettings(uid).then(setSettings)
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7() }
  }, [uid])

  const { streaks, badges } = computeAchievements({
    weights, lifts, cardio, nutritionLog, medicationLog, wellbeing, selfCareLog, settings,
  })

  const earned = badges.filter(b => b.earned)
  const inProgress = badges.filter(b => !b.earned && b.progress > 0)
  const locked = badges.filter(b => !b.earned && b.progress === 0)

  return (
    <div className="space-y-6 pb-8">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-1">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <Award size={20} className="text-accent" /> Achievements
          </h1>
          <p className="text-xs text-muted">
            {earned.length} / {badges.length} badges earned
          </p>
        </div>
      </div>

      {/* Streak summary */}
      <div>
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Active Streaks
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatPill
            label="Weigh-in streak"
            value={streaks.weighIn.current === 0 ? '—' : `${streaks.weighIn.current}d`}
            sub={streaks.weighIn.longest > 0 ? `Best: ${streaks.weighIn.longest}d` : undefined}
          />
          <StatPill
            label="Mood log streak"
            value={streaks.mood.current === 0 ? '—' : `${streaks.mood.current}d`}
            sub={streaks.mood.longest > 0 ? `Best: ${streaks.mood.longest}d` : undefined}
          />
          <StatPill
            label="Gym weeks (current)"
            value={streaks.gymWeeks.current === 0 ? '—' : `${streaks.gymWeeks.current}w`}
            sub={streaks.gymWeeks.longest > 0 ? `Best: ${streaks.gymWeeks.longest}w` : undefined}
          />
          <StatPill
            label="Meals logged streak"
            value={streaks.mealsLogged.current === 0 ? '—' : `${streaks.mealsLogged.current}d`}
            sub={streaks.mealsLogged.longest > 0 ? `Best: ${streaks.mealsLogged.longest}d` : undefined}
          />
        </div>
      </div>

      {/* Earned badges */}
      {earned.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Flame size={13} className="text-warn" /> Earned ({earned.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {earned.map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        </div>
      )}

      {/* In-progress badges */}
      {inProgress.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            In Progress ({inProgress.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {inProgress.map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        </div>
      )}

      {/* Locked badges */}
      {locked.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Locked ({locked.length})
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {locked.map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        </div>
      )}

      {/* Empty state */}
      {badges.length === 0 && (
        <div className="card text-center py-12">
          <Award size={40} className="text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">Start logging to unlock your first badge.</p>
        </div>
      )}

    </div>
  )
}
