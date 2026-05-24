/**
 * ExerciseBrowser
 * A full-page exercise browser organised by muscle group.
 * For each exercise, shows:
 *   - Muscle groups, tips, ExRx link
 *   - Smart weight + rep suggestions based on the user's logged history
 * Called from the Workout log tab via an "Browse exercises" button.
 */
import { useState, useEffect } from 'react'
import { BUILT_IN_EXERCISES } from '../training/exercises.js'
import { subscribe, getAll } from '../data.js'
import { Info, ExternalLink, Dumbbell, ChevronDown, ChevronRight, Plus, X, Trophy } from 'lucide-react'
import { format } from 'date-fns'

// Epley e1RM
const epley = (w, r) => r === 1 ? w : parseFloat(w) * (1 + parseFloat(r) / 30)

// Reverse Epley: target weight for a given rep count from e1RM
// e1RM = w * (1 + r/30)  =>  w = e1RM / (1 + r/30)
const targetWeight = (e1rm, reps) => Math.round((e1rm / (1 + reps / 30)) / 2.5) * 2.5

const REP_SCHEMES = [
  { label: '1RM test', reps: 1, pct: 100, note: 'Max effort single' },
  { label: '3×3 (strength)', reps: 3, note: 'Heavy triples, 90–95% 1RM' },
  { label: '4×5 (strength)', reps: 5, note: 'Stronglifts / 5×5 zone' },
  { label: '4×6 (strength/size)', reps: 6, note: 'Sweet spot for strength + hypertrophy' },
  { label: '3×8 (hypertrophy)', reps: 8, note: 'Classic hypertrophy range' },
  { label: '3×10 (hypertrophy)', reps: 10, note: 'Volume accumulation' },
  { label: '3×12 (endurance/pump)', reps: 12, note: 'Metabolic stress, lighter load' },
  { label: '3×15 (endurance)', reps: 15, note: 'Muscular endurance' },
]

// Group exercises by primary muscle
const MUSCLE_ORDER = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core',
]

function buildGroups(allExercises) {
  const groups = {}
  MUSCLE_ORDER.forEach(m => { groups[m] = [] })
  groups['Other'] = []
  allExercises.forEach(ex => {
    const primary = ex.primary?.[0]
    if (primary && groups[primary]) {
      groups[primary].push(ex)
    } else {
      groups['Other'].push(ex)
    }
  })
  return groups
}

function ExerciseCard({ ex, bestE1rm, allTimeBest, onAdd }) {
  const [open, setOpen] = useState(false)
  const [selectedReps, setSelectedReps] = useState(8)

  const suggested = allTimeBest
    ? targetWeight(allTimeBest, selectedReps)
    : null

  return (
    <div className="border border-border/30 rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-3 bg-surfaceAlt hover:bg-surfaceAlt/80 transition-colors text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Dumbbell size={13} className="text-accent shrink-0"/>
            <span className="text-sm font-semibold text-text truncate">{ex.name}</span>
            {allTimeBest && (
              <span className="text-xs text-accent shrink-0">e1RM {allTimeBest.toFixed(1)} kg</span>
            )}
          </div>
          <div className="text-xs text-muted mt-0.5">
            {ex.primary?.join(', ')}
            {ex.secondary?.length > 0 && <span className="opacity-60"> · {ex.secondary.join(', ')}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {onAdd && (
            <button
              onClick={e => { e.stopPropagation(); onAdd(ex.name) }}
              className="btn-primary text-xs flex items-center gap-1"
            >
              <Plus size={11}/> Add
            </button>
          )}
          {open ? <ChevronDown size={14} className="text-muted"/> : <ChevronRight size={14} className="text-muted"/>}
        </div>
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-3 py-3 space-y-3 bg-bg">
          {/* Tips */}
          {ex.tips && (
            <div className="bg-surfaceAlt rounded-xl p-3">
              <div className="text-xs font-semibold text-accent mb-1 flex items-center gap-1">
                <Info size={11}/> Coaching cues
              </div>
              <p className="text-xs text-muted leading-relaxed">{ex.tips}</p>
              {ex.url && (
                <a href={ex.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-accent flex items-center gap-1 mt-2 hover:underline">
                  <ExternalLink size={10}/> Full instructions (ExRx.net)
                </a>
              )}
            </div>
          )}

          {/* Weight suggestions */}
          <div>
            <div className="text-xs font-semibold text-text mb-2 flex items-center gap-1">
              <Trophy size={11} className="text-warn"/>
              {allTimeBest
                ? `Weight suggestions (based on your e1RM: ${allTimeBest.toFixed(1)} kg)`
                : 'Rep scheme guide (log this exercise to get personalised weight suggestions)'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {REP_SCHEMES.map(scheme => {
                const w = allTimeBest ? targetWeight(allTimeBest, scheme.reps) : null
                const isSelected = selectedReps === scheme.reps
                return (
                  <button
                    key={scheme.reps}
                    onClick={() => setSelectedReps(scheme.reps)}
                    className={`text-left rounded-xl px-2.5 py-2 border transition-colors ${
                      isSelected
                        ? 'border-accent/40 bg-accent/10'
                        : 'border-border/20 bg-surfaceAlt hover:border-accent/20'
                    }`}
                  >
                    <div className="text-xs font-semibold text-text">{scheme.label}</div>
                    {w !== null ? (
                      <div className="text-base font-bold text-accent">{w} kg</div>
                    ) : (
                      <div className="text-xs text-muted">Log first</div>
                    )}
                    <div className="text-[10px] text-muted leading-tight mt-0.5">{scheme.note}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* History summary */}
          {bestE1rm?.recentSets?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted mb-1">Recent sets</div>
              <div className="space-y-0.5">
                {bestE1rm.recentSets.slice(0, 4).map((s, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-muted w-24 shrink-0">{s.date}</span>
                    <span className="text-text">{s.weight} kg × {s.reps}</span>
                    <span className="text-accent">e1RM {epley(s.weight, s.reps).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ExerciseBrowser({ uid, onAdd, onClose }) {
  const [lifts, setLifts] = useState([])
  const [customExercises, setCustomExercises] = useState([])
  const [search, setSearch] = useState('')
  const [selectedMuscle, setSelectedMuscle] = useState('All')
  const [expandedGroups, setExpandedGroups] = useState({})

  useEffect(() => {
    const unsub = subscribe(uid, 'lifts', data => setLifts(data), { limit: 500 })
    getAll(uid, 'customExercises').then(setCustomExercises)
    return unsub
  }, [uid])

  // Build e1RM map from lift history
  const e1rmMap = {}
  lifts.forEach(l => {
    const exercises = l.exercises
      ? l.exercises
      : l.exercise ? [{ name: l.exercise, sets: l.sets || [] }] : []
    exercises.forEach(ex => {
      if (!ex.name) return
      ;(ex.sets || []).filter(s => !s.warmup).forEach(s => {
        const e = epley(s.weight, s.reps)
        if (!e1rmMap[ex.name]) {
          e1rmMap[ex.name] = { best: 0, recentSets: [] }
        }
        if (e > e1rmMap[ex.name].best) e1rmMap[ex.name].best = e
        e1rmMap[ex.name].recentSets.unshift({ weight: s.weight, reps: s.reps, date: l.date })
      })
    })
  })

  const allExercises = [
    ...BUILT_IN_EXERCISES,
    ...customExercises.map(ex => ({ ...ex, isCustom: true })),
  ]

  const groups = buildGroups(allExercises)
  const muscles = ['All', ...MUSCLE_ORDER.filter(m => groups[m]?.length > 0), ...(groups.Other?.length ? ['Other'] : [])]

  const filteredGroups = Object.fromEntries(
    Object.entries(groups).map(([muscle, exes]) => [
      muscle,
      exes.filter(ex => {
        const matchesMuscle = selectedMuscle === 'All' || muscle === selectedMuscle
        const matchesSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase())
        return matchesMuscle && matchesSearch
      }),
    ])
  )

  const toggleGroup = (muscle) => {
    setExpandedGroups(prev => ({ ...prev, [muscle]: !prev[muscle] }))
  }

  // Auto-expand group when searching or filtering by muscle
  const effectiveExpanded = search || selectedMuscle !== 'All'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="card-title flex items-center gap-2">
          <Dumbbell size={16} className="text-accent"/> Exercise Library
        </div>
        {onClose && (
          <button onClick={onClose} className="btn-ghost p-1"><X size={16}/></button>
        )}
      </div>

      {/* Search + muscle filter */}
      <div className="space-y-2">
        <input
          type="text"
          className="input"
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className="flex gap-1.5 flex-wrap">
          {muscles.map(m => (
            <button
              key={m}
              onClick={() => setSelectedMuscle(m)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                selectedMuscle === m
                  ? 'bg-accent text-bg border-accent font-semibold'
                  : 'bg-surfaceAlt text-muted border-border/30 hover:border-accent/30'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Summary of your best lifts */}
      {Object.keys(e1rmMap).length > 0 && !search && selectedMuscle === 'All' && (
        <div className="card">
          <div className="text-xs font-semibold text-muted mb-2">Your top e1RMs</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(e1rmMap)
              .sort((a, b) => b[1].best - a[1].best)
              .slice(0, 6)
              .map(([name, data]) => (
                <div key={name} className="bg-surfaceAlt rounded-xl p-2 text-center">
                  <div className="text-xs text-muted truncate">{name.split(' ').slice(0, 2).join(' ')}</div>
                  <div className="text-sm font-bold text-accent">{data.best.toFixed(1)} kg</div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Exercise groups */}
      {MUSCLE_ORDER.concat(['Other']).map(muscle => {
        const exes = filteredGroups[muscle] || []
        if (!exes.length) return null
        const isOpen = effectiveExpanded || expandedGroups[muscle]
        return (
          <div key={muscle} className="card">
            <button
              onClick={() => toggleGroup(muscle)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text">{muscle}</span>
                <span className="text-xs text-muted">{exes.length} exercises</span>
              </div>
              {isOpen
                ? <ChevronDown size={14} className="text-muted"/>
                : <ChevronRight size={14} className="text-muted"/>
              }
            </button>
            {isOpen && (
              <div className="space-y-2 mt-3">
                {exes.map(ex => (
                  <ExerciseCard
                    key={ex.name}
                    ex={ex}
                    bestE1rm={e1rmMap[ex.name]}
                    allTimeBest={e1rmMap[ex.name]?.best || null}
                    onAdd={onAdd}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
