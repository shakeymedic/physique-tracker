import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, deleteEntry, getAll, getSettings, saveSettings } from '../data.js'
import { format, subDays, startOfWeek } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Plus, Trash2, Play, Pause, RotateCcw, Trophy, Pencil, HeartPulse, Dumbbell, X,
  Timer, Activity, Zap, ChevronDown, ChevronRight, CheckCircle, Circle,
  Copy, ArrowUp, ArrowDown, Save, Settings2, Calendar, Info, ExternalLink,
} from 'lucide-react'
import MicButton from '../components/MicButton.jsx'
import EditableRow from '../components/EditableRow.jsx'
import {
  BUILT_IN_EXERCISES, CARDIO_TYPES, computeMuscleRecovery, muscleStatus,
  MUSCLE_REGIONS, MUSCLE_STATUS_STYLES,
} from '../training/exercises.js'
import { TodChip, TodSelect, detectTimeOfDay } from '../lib/timeOfDay.jsx'
import { saveDraft, loadDraft, clearDraft, draftAgo } from '../lib/draft.js'
import { ROUTINES } from '../training/routines.js'
import { STRETCHES } from '../training/stretches.js'
import { PROGRAMS, getProgramById, resolveProgram, getTodayWorkout, computeWeekNumber } from '../training/programs.js'
import RoutineTimer from '../components/RoutineTimer.jsx'
import ProgramCard from '../components/ProgramCard.jsx'
import MilestoneRow from '../components/MilestoneRow.jsx'
import { useExerciseList } from '../lib/useExerciseList.js'

const RPE_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const today = () => format(new Date(), 'yyyy-MM-dd')
const epley = (w, r) => parseFloat(w) * (1 + parseFloat(r) / 30)

// Compute best e1RM across all lifts for a given exercise name
function getBestE1RM(lifts, exerciseName) {
  let best = 0
  lifts.forEach(l => {
    // New multi-exercise shape
    const exercises = l.exercises
      ? l.exercises
      : l.exercise
        ? [{ name: l.exercise, sets: l.sets || [] }]
        : []
    exercises.filter(e => e.name === exerciseName).forEach(e => {
      ;(e.sets || []).forEach(s => {
        const e1 = epley(s.weight, s.reps)
        if (e1 > best) best = e1
      })
    })
  })
  return best
}

// Compute milestone progress for a single milestone
function computeMilestoneProgress(milestone, lifts, weights, cardioLogs = [], mobilityLogs = []) {
  if (!milestone) return { hit: false, progress: 0, currentKg: null, targetKg: null }

  // Non-lift milestones: compute actual progress
  if (milestone.type === 'cardio-count') {
    const count = (cardioLogs || []).length
    const target = milestone.target || 10
    return { hit: count >= target, progress: Math.min(1, count / target), currentKg: count, targetKg: target }
  }
  if (milestone.type === 'mobility-streak') {
    const count = (mobilityLogs || []).length
    const target = milestone.target || 21
    return { hit: count >= target, progress: Math.min(1, count / target), currentKg: count, targetKg: target }
  }

  if (!milestone.exercise) return { hit: false, progress: 0, currentKg: null, targetKg: null }

  const latestWeight = weights?.length
    ? weights.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.weight || 80
    : 80

  const targetKg = latestWeight * (milestone.multiplier || 1.0)
  const currentKg = getBestE1RM(lifts, milestone.exercise)

  const progress = targetKg > 0 ? Math.min(1, currentKg / targetKg) : 0
  const hit = currentKg >= targetKg * 0.99 // within 1% counts

  return { hit, progress, currentKg, targetKg }
}

// Normalise a lift doc to the new multi-exercise shape
function normaliseLift(lift) {
  if (lift.exercises && Array.isArray(lift.exercises)) return lift
  if (lift.exercise) {
    return { ...lift, exercises: [{ name: lift.exercise, sets: lift.sets || [] }] }
  }
  return { ...lift, exercises: [] }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function Tabs({ active, set }) {
  const primary = ['Workout', 'Cardio', 'Mobility', 'Programs']
  const secondary = ['Templates', 'History', 'Recovery', 'Timer']
  return (
    <div className="mb-4 space-y-1.5">
      <div className="flex gap-1.5 flex-wrap">
        {primary.map(t => (
          <button key={t} onClick={() => set(t)}
            className={active === t ? 'btn-primary text-xs px-3 py-1.5' : 'btn-secondary text-xs px-3 py-1.5'}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {secondary.map(t => (
          <button key={t} onClick={() => set(t)}
            className={active === t ? 'btn-primary text-xs px-3 py-1.5' : 'btn-ghost text-xs px-3 py-1.5 text-muted'}>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Exercise Tips tooltip ────────────────────────────────────────────────────
function ExerciseTips({ exerciseName, allExercises }) {
  const [open, setOpen] = useState(false)
  const ex = allExercises.find(e => e.name === exerciseName)
  if (!ex?.tips && !ex?.url) return null
  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        className="btn-ghost p-1 text-muted hover:text-accent"
        title="Exercise tips"
      >
        <Info size={13}/>
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-surface border border-border/40 rounded-xl p-3 shadow-lg">
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-text">{exerciseName}</span>
            <button onClick={() => setOpen(false)} className="btn-ghost p-0.5"><X size={12}/></button>
          </div>
          {ex.tips && <p className="text-xs text-muted mb-2 leading-relaxed">{ex.tips}</p>}
          {ex.url && (
            <a href={ex.url} target="_blank" rel="noopener noreferrer"
              className="text-xs text-accent flex items-center gap-1 hover:underline">
              <ExternalLink size={11}/> Full instructions (ExRx.net)
            </a>
          )}
        </div>
      )}
    </>
  )
}

// ── Exercise Picker (dropdown style) ──────────────────────────────────────────
function ExercisePicker({ uid, onAdd }) {
  const { all: allExercises, loading } = useExerciseList(uid)
  const [selected, setSelected] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', category: 'strength', primary: '', secondary: '' })
  const [addSaving, setAddSaving] = useState(false)

  // Group exercises by category for <optgroup>
  const grouped = { strength: [], cardio: [], mobility: [], other: [], Custom: [] }
  allExercises.forEach(ex => {
    if (ex.isCustom) grouped.Custom.push(ex)
    else grouped[ex.category || 'strength']?.push(ex)
  })

  const handleAdd = () => {
    if (!selected) return
    onAdd(selected)
    setSelected('')
  }

  const saveCustom = async () => {
    if (!addForm.name.trim() || !uid) return
    setAddSaving(true)
    try {
      await addEntry(uid, 'customExercises', {
        name: addForm.name.trim(),
        category: addForm.category,
        primary: addForm.primary ? addForm.primary.split(',').map(s => s.trim()).filter(Boolean) : [],
        secondary: addForm.secondary ? addForm.secondary.split(',').map(s => s.trim()).filter(Boolean) : [],
        isMobility: addForm.category === 'mobility',
      })
      onAdd(addForm.name.trim())
      setAddForm({ name: '', category: 'strength', primary: '', secondary: '' })
      setShowAddForm(false)
    } finally { setAddSaving(false) }
  }

  if (loading) return <p className="text-xs text-muted">Loading exercises...</p>

  if (showAddForm) {
    return (
      <div className="bg-surfaceAlt rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-semibold text-text">New exercise</span>
          <button onClick={() => setShowAddForm(false)} className="btn-ghost p-0.5"><X size={14}/></button>
        </div>
        <input
          className="input"
          placeholder="Exercise name *"
          value={addForm.name}
          onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
          autoFocus
        />
        <div className="flex gap-2">
          <select className="input flex-1" value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))}>
            <option value="strength">Strength</option>
            <option value="cardio">Cardio</option>
            <option value="mobility">Mobility</option>
            <option value="other">Other</option>
          </select>
        </div>
        <input
          className="input text-sm"
          placeholder="Primary muscles (optional, comma separated)"
          value={addForm.primary}
          onChange={e => setAddForm(p => ({ ...p, primary: e.target.value }))}
        />
        <input
          className="input text-sm"
          placeholder="Secondary muscles (optional)"
          value={addForm.secondary}
          onChange={e => setAddForm(p => ({ ...p, secondary: e.target.value }))}
        />
        <div className="flex gap-2">
          <button onClick={saveCustom} className="btn-primary text-sm flex-1" disabled={addSaving || !addForm.name.trim()}>
            {addSaving ? 'Saving...' : 'Save & add to session'}
          </button>
          <button onClick={() => setShowAddForm(false)} className="btn-secondary text-sm">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <select
        className="input flex-1"
        value={selected}
        onChange={e => setSelected(e.target.value)}
      >
        <option value="">Add exercise to session...</option>
        {grouped.strength.length > 0 && (
          <optgroup label="Strength">
            {grouped.strength.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
          </optgroup>
        )}
        {grouped.cardio.length > 0 && (
          <optgroup label="Cardio">
            {grouped.cardio.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
          </optgroup>
        )}
        {grouped.mobility.length > 0 && (
          <optgroup label="Mobility">
            {grouped.mobility.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
          </optgroup>
        )}
        {grouped.other.length > 0 && (
          <optgroup label="Other">
            {grouped.other.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
          </optgroup>
        )}
        {grouped.Custom.length > 0 && (
          <optgroup label="Custom">
            {grouped.Custom.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
          </optgroup>
        )}
      </select>
      <button
        onClick={handleAdd}
        disabled={!selected}
        className="btn-primary shrink-0 flex items-center gap-1"
      >
        <Plus size={14}/> Add
      </button>
      <button
        onClick={() => setShowAddForm(true)}
        className="btn-secondary shrink-0 text-sm flex items-center gap-1"
        title="Create new exercise"
      >
        <Plus size={13}/> New
      </button>
    </div>
  )
}

// ── Log Tab ────────────────────────────────────────────────────────────────────
function LogTab({ uid, initialEditLift, onEditStart }) {
  const DRAFT_KEY = `pt-draft-training-${uid}`
  const { all: allExercises } = useExerciseList(uid)

  const emptySession = () => ({
    date: today(),
    timeOfDay: detectTimeOfDay(),
    exercises: [],   // { type:'strength'|'cardio', name, sets[], cardio:{...} }
    notes: '',
    sessionRpe: null,
  })

  const [session, setSession] = useState(emptySession)
  // Per-exercise set forms: { [exIdx]: { weight, reps, rpe } }
  const [setForms, setSetForms] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedSummary, setSavedSummary] = useState(null)
  const [editId, setEditId] = useState(null)
  const [liftsAll, setLiftsAll] = useState([])
  const [templates, setTemplates] = useState([])
  const [draftPrompt, setDraftPrompt] = useState(null)

  const draftTimer = useRef(null)

  useEffect(() => {
    getAll(uid, 'workoutTemplates').then(setTemplates)
    getAll(uid, 'lifts').then(data => setLiftsAll(data.map(normaliseLift)))
    const draft = loadDraft(DRAFT_KEY)
    if (draft && draft.data?.exercises?.length) setDraftPrompt(draft)
  }, [uid])

  const pendingEditRef = useRef(initialEditLift)

  const debouncedSaveDraft = useCallback((data) => {
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => saveDraft(DRAFT_KEY, data), 500)
  }, [DRAFT_KEY])

  useEffect(() => {
    if (session.exercises.length > 0) debouncedSaveDraft(session)
  }, [session, debouncedSaveDraft])

  const restoreDraft = () => {
    if (draftPrompt?.data) { setSession(draftPrompt.data); setDraftPrompt(null) }
  }

  const getSetForm = (idx) => setForms[idx] || { weight: '', reps: '', rpe: '7' }
  const updateSetForm = (idx, field, val) => setSetForms(prev => ({
    ...prev, [idx]: { ...getSetForm(idx), [field]: val }
  }))

  // After adding a set, carry weight forward, clear reps
  const addSet = (exIdx) => {
    const sf = getSetForm(exIdx)
    if (!sf.weight || !sf.reps) return
    const newSet = { weight: parseFloat(sf.weight), reps: parseInt(sf.reps), rpe: parseFloat(sf.rpe), warmup: sf.warmup || false }
    setSession(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === exIdx ? { ...ex, sets: [...ex.sets, newSet] } : ex
      ),
    }))
    // Carry weight, clear reps ready for next set
    setSetForms(prev => ({ ...prev, [exIdx]: { weight: sf.weight, reps: '', rpe: sf.rpe } }))
  }

  const removeSet = (exIdx, setIdx) => {
    setSession(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
      ),
    }))
  }

  const addExercise = (name) => {
    setSession(prev => ({
      ...prev,
      exercises: [...prev.exercises, { type: 'strength', name, sets: [] }],
    }))
    // Pre-fill set form with last-used data for this exercise across all history
    const exIdx = session.exercises.length
    const prevBest = getPrevBest(name)
    if (prevBest) {
      setSetForms(prev => ({
        ...prev,
        [exIdx]: { weight: String(prevBest.weight), reps: String(prevBest.reps), rpe: String(prevBest.rpe || 7) }
      }))
    }
  }

  const addCardioBlock = () => {
    setSession(prev => ({
      ...prev,
      exercises: [...prev.exercises, {
        type: 'cardio',
        name: 'Running',
        cardio: { type: 'Running', durationMin: '', distanceKm: '', kcal: '', avgHr: '', rpe: '' }
      }],
    }))
  }

  const removeExercise = (idx) => {
    setSession(prev => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== idx) }))
    setSetForms(prev => {
      const n = {}
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k)
        if (ki < idx) n[ki] = v
        else if (ki > idx) n[ki - 1] = v
      })
      return n
    })
  }

  const updateCardioBlock = (exIdx, field, val) => {
    setSession(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === exIdx
          ? { ...ex, name: field === 'type' ? val : ex.name, cardio: { ...ex.cardio, [field]: val } }
          : ex
      ),
    }))
  }

  const getPrevBest = (exerciseName) => {
    let best = null
    liftsAll.forEach(l => {
      ;(l.exercises || []).filter(e => e.name === exerciseName).forEach(e => {
        ;(e.sets || []).forEach(s => {
          const e1 = epley(s.weight, s.reps)
          if (!best || e1 > best.e1rm) {
            best = { weight: s.weight, reps: s.reps, rpe: s.rpe, e1rm: e1, date: l.date }
          }
        })
      })
    })
    return best
  }

  const saveSession = async () => {
    const hasStrength = session.exercises.some(ex => ex.type === 'strength' && ex.sets.length > 0)
    const hasCardio = session.exercises.some(ex => ex.type === 'cardio' && ex.cardio?.durationMin)
    if (!hasStrength && !hasCardio) return
    setSaving(true)
    try {
      const prs = []
      session.exercises.filter(ex => ex.type === 'strength').forEach(ex => {
        if (!ex.sets.length) return
        const newBest = Math.max(...ex.sets.map(s => epley(s.weight, s.reps)))
        let allTimeBest = 0
        liftsAll.forEach(l => {
          ;(l.exercises || []).filter(e => e.name === ex.name).forEach(e => {
            ;(e.sets || []).forEach(s => { const e1 = epley(s.weight, s.reps); if (e1 > allTimeBest) allTimeBest = e1 })
          })
        })
        if (newBest > allTimeBest && allTimeBest > 0) prs.push(ex.name)
      })

      const totalTonnage = session.exercises
        .filter(ex => ex.type === 'strength')
        .reduce((acc, ex) => acc + ex.sets.reduce((a, s) => a + s.weight * s.reps, 0), 0)

      const totalCardioKcal = session.exercises
        .filter(ex => ex.type === 'cardio')
        .reduce((acc, ex) => acc + (parseFloat(ex.cardio?.kcal) || 0), 0)

      const docData = {
        date: session.date,
        timeOfDay: session.timeOfDay || null,
        exercises: session.exercises
          .filter(ex => ex.type === 'strength' && ex.sets.length > 0)
          .map(ex => ({
            name: ex.name,
            sets: ex.sets,
            e1RM: Math.max(...ex.sets.map(s => epley(s.weight, s.reps))),
            tonnage: ex.sets.reduce((a, s) => a + s.weight * s.reps, 0),
          })),
        cardioBlocks: session.exercises
          .filter(ex => ex.type === 'cardio' && ex.cardio?.durationMin)
          .map(ex => ({ ...ex.cardio })),
        totalTonnage,
        totalCardioKcal: totalCardioKcal || null,
        notes: session.notes,
        sessionRpe: session.sessionRpe || null,
        prs,
      }

      if (editId) {
        await setEntry(uid, 'lifts', editId, docData)
        setEditId(null)
      } else {
        await addEntry(uid, 'lifts', docData)
      }

      const strengthExes = session.exercises.filter(ex => ex.type === 'strength' && ex.sets.length > 0)
      const cardioBlocks = session.exercises.filter(ex => ex.type === 'cardio' && ex.cardio?.durationMin)
      setSavedSummary({ exercises: strengthExes, cardioBlocks, totalTonnage, totalCardioKcal, prs, date: session.date })

      clearDraft(DRAFT_KEY)
      setSession(emptySession())
      setSetForms({})
    } finally { setSaving(false) }
  }

  const loadTemplate = (t) => {
    const exes = t.exercises
      ? t.exercises.map(ex => ({ type: 'strength', name: ex.name, sets: ex.sets || [] }))
      : t.exercise ? [{ type: 'strength', name: t.exercise, sets: t.sets || [] }] : []
    setSession(prev => ({ ...prev, exercises: exes }))
  }

  const startEdit = (lift) => {
    const norm = normaliseLift(lift)
    const exercises = norm.exercises.map(ex => ({ type: 'strength', name: ex.name, sets: ex.sets || [] }))
    const cardioBlocks = (norm.cardioBlocks || []).map(c => ({ type: 'cardio', name: c.type || 'Running', cardio: c }))
    setSession({ date: norm.date, timeOfDay: norm.timeOfDay || null, exercises: [...exercises, ...cardioBlocks], notes: norm.notes || '' })
    setEditId(lift.id)
  }

  useEffect(() => {
    if (pendingEditRef.current) {
      startEdit(pendingEditRef.current)
      pendingEditRef.current = null
      if (onEditStart) onEditStart()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialEditLift])

  const cancelEdit = () => { setEditId(null); setSession(emptySession()); setSetForms({}) }

  // ── Post-save summary ──
  if (savedSummary) {
    return (
      <div className="space-y-4">
        <div className="card border-success/30 bg-success/5">
          <div className="flex items-center justify-between mb-3">
            <div className="card-title flex items-center gap-2 text-success">
              <CheckCircle size={18}/> Session saved
            </div>
            <span className="text-xs text-muted">{savedSummary.date}</span>
          </div>

          {savedSummary.prs.length > 0 && (
            <div className="bg-warn/10 border border-warn/20 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
              <Trophy size={14} className="text-warn shrink-0"/>
              <span className="text-sm font-semibold text-warn">New PRs: {savedSummary.prs.join(', ')}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-3">
            {savedSummary.totalTonnage > 0 && (
              <div className="bg-bg rounded-xl p-3">
                <div className="text-xs text-muted mb-1">Total tonnage</div>
                <div className="text-accent font-bold text-lg">{savedSummary.totalTonnage.toFixed(0)} kg</div>
              </div>
            )}
            {savedSummary.exercises.length > 0 && (
              <div className="bg-bg rounded-xl p-3">
                <div className="text-xs text-muted mb-1">Exercises</div>
                <div className="text-text font-bold text-lg">{savedSummary.exercises.length}</div>
              </div>
            )}
            {savedSummary.totalCardioKcal > 0 && (
              <div className="bg-bg rounded-xl p-3">
                <div className="text-xs text-muted mb-1">Cardio kcal burned</div>
                <div className="text-accent font-bold text-lg">{savedSummary.totalCardioKcal} kcal</div>
              </div>
            )}
          </div>

          <div className="space-y-1 mb-3">
            {savedSummary.exercises.map((ex, i) => {
              const bestE1rm = Math.max(...ex.sets.map(s => epley(s.weight, s.reps))).toFixed(1)
              const tonnage = ex.sets.reduce((a, s) => a + s.weight * s.reps, 0)
              return (
                <div key={i} className="flex items-center justify-between text-sm bg-bg rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Dumbbell size={12} className="text-accent shrink-0"/>
                    <span className="font-medium text-text">{ex.name}</span>
                    {savedSummary.prs.includes(ex.name) && <Trophy size={11} className="text-warn"/>}
                  </div>
                  <span className="text-xs text-muted">{ex.sets.length} sets · {tonnage.toFixed(0)} kg · e1RM {bestE1rm}</span>
                </div>
              )
            })}
            {savedSummary.cardioBlocks.map((cb, i) => (
              <div key={`c${i}`} className="flex items-center justify-between text-sm bg-bg rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <HeartPulse size={12} className="text-success shrink-0"/>
                  <span className="font-medium text-text">{cb.cardio?.type || 'Cardio'}</span>
                </div>
                <span className="text-xs text-muted">{cb.cardio?.durationMin} min{cb.cardio?.kcal ? ` · ${cb.cardio.kcal} kcal` : ''}</span>
              </div>
            ))}
          </div>

          <button onClick={() => setSavedSummary(null)} className="btn-primary">Log another session</button>
        </div>
      </div>
    )
  }

  // ── Main log form ──
  return (
    <div className="space-y-4">
      {draftPrompt && (
        <div className="card border-accent/30 bg-accent/5">
          <div className="flex items-center justify-between">
            <p className="text-sm">Unsaved session from <span className="text-accent">{draftAgo(draftPrompt.at)}</span> — restore?</p>
            <div className="flex gap-2">
              <button onClick={restoreDraft} className="btn-primary text-xs">Restore</button>
              <button onClick={() => { clearDraft(DRAFT_KEY); setDraftPrompt(null) }} className="btn-ghost text-xs">Discard</button>
            </div>
          </div>
        </div>
      )}

      {editId && (
        <div className="card border-warn/30 bg-warn/5">
          <p className="text-sm text-warn">Editing existing session. <button onClick={cancelEdit} className="underline">Cancel edit</button></p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="card">
          <div className="card-title text-sm">Load Template</div>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => loadTemplate(t)} className="btn-secondary text-xs">{t.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        {/* Date / time */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={session.date}
              onChange={e => setSession(p => ({ ...p, date: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Time of day</label>
            <TodSelect value={session.timeOfDay} onChange={v => setSession(p => ({ ...p, timeOfDay: v }))}/>
          </div>
        </div>

        {/* Exercise blocks — always fully expanded */}
        {session.exercises.length > 0 && (
          <div className="space-y-4 mb-4">
            {session.exercises.map((ex, exIdx) => {
              const sf = getSetForm(exIdx)

              // ── Cardio block ──
              if (ex.type === 'cardio') {
                const cb = ex.cardio || {}
                return (
                  <div key={exIdx} className="border border-success/30 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-success/10">
                      <div className="flex items-center gap-2">
                        <HeartPulse size={14} className="text-success"/>
                        <span className="text-sm font-semibold text-success">Cardio</span>
                      </div>
                      <button onClick={() => removeExercise(exIdx)} className="btn-ghost p-1 text-danger"><X size={14}/></button>
                    </div>
                    <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div className="col-span-2 md:col-span-3">
                        <label className="label text-xs">Activity</label>
                        <select className="input" value={cb.type || 'Running'} onChange={e => updateCardioBlock(exIdx, 'type', e.target.value)}>
                          {CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">Duration (min) *</label>
                        <input type="number" className="input" placeholder="30"
                          value={cb.durationMin || ''} onChange={e => updateCardioBlock(exIdx, 'durationMin', e.target.value)}/>
                      </div>
                      <div>
                        <label className="label text-xs">Distance (km)</label>
                        <input type="number" step="0.01" className="input" placeholder="optional"
                          value={cb.distanceKm || ''} onChange={e = inputMode="decimal"> updateCardioBlock(exIdx, 'distanceKm', e.target.value)}/>
                      </div>
                      <div>
                        <label className="label text-xs">Kcal burned</label>
                        <input type="number" className="input" placeholder="optional"
                          value={cb.kcal || ''} onChange={e => updateCardioBlock(exIdx, 'kcal', e.target.value)}/>
                      </div>
                      <div>
                        <label className="label text-xs">Avg HR (bpm)</label>
                        <input type="number" className="input" placeholder="optional"
                          value={cb.avgHr || ''} onChange={e => updateCardioBlock(exIdx, 'avgHr', e.target.value)}/>
                      </div>
                      <div>
                        <label className="label text-xs">RPE</label>
                        <input type="number" min="1" max="10" step="0.5" className="input" placeholder="optional"
                          value={cb.rpe || ''} onChange={e = inputMode="decimal"> updateCardioBlock(exIdx, 'rpe', e.target.value)}/>
                      </div>
                    </div>
                  </div>
                )
              }

              // ── Strength block ──
              const prevBest = getPrevBest(ex.name)
              const totalSets = ex.sets.length
              const tonnage = ex.sets.reduce((a, s) => a + s.weight * s.reps, 0)
              const bestE1rm = totalSets ? Math.max(...ex.sets.map(s => epley(s.weight, s.reps))) : null

              return (
                <div key={exIdx} className="border border-border/40 rounded-xl overflow-hidden">
                  {/* Exercise header */}
                  <div className="relative flex items-center justify-between px-3 py-2.5 bg-surfaceAlt">
                    <div className="flex items-center gap-2 min-w-0">
                      <Dumbbell size={14} className="text-accent shrink-0"/>
                      <span className="font-semibold text-text truncate">{ex.name}</span>
                      <ExerciseTips exerciseName={ex.name} allExercises={allExercises}/>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {totalSets > 0 && (
                        <span className="text-xs text-muted">{totalSets} sets · {tonnage.toFixed(0)} kg</span>
                      )}
                      <button onClick={() => removeExercise(exIdx)} className="btn-ghost p-1 text-danger"><X size={14}/></button>
                    </div>
                  </div>

                  <div className="p-3">
                    {/* Previous best */}
                    {prevBest && (
                      <div className="flex items-center gap-1.5 text-xs text-muted bg-surfaceAlt/60 rounded-lg px-2.5 py-1.5 mb-3">
                        <Trophy size={11} className="text-warn shrink-0"/>
                        <span>Best: <span className="text-text font-medium">{prevBest.weight} kg × {prevBest.reps}</span> @ RPE {prevBest.rpe || '?'} — e1RM <span className="text-accent">{prevBest.e1rm.toFixed(1)}</span> ({prevBest.date})</span>
                      </div>
                    )}

                    {/* Logged sets table */}
                    {ex.sets.length > 0 && (
                      <div className="mb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted">
                              <th className="text-left pb-1 w-6">#</th>
                              <th className="text-left pb-1">kg</th>
                              <th className="text-left pb-1">Reps</th>
                              <th className="text-left pb-1">RPE</th>
                              <th className="text-left pb-1">e1RM</th>
                              <th className="w-6 pb-1"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {ex.sets.map((s, si) => (
                              <tr key={si} className="border-t border-border/20">
                                <td className="py-1.5 text-muted text-xs">{si + 1}{s.warmup ? ' W' : ''}</td>
                                <td className="py-1.5 font-medium">{s.weight}</td>
                                <td className="py-1.5">{s.reps}</td>
                                <td className="py-1.5 text-muted">{s.rpe}</td>
                                <td className="py-1.5 text-accent">{epley(s.weight, s.reps).toFixed(1)}</td>
                                <td className="py-1.5">
                                  <button onClick={() => removeSet(exIdx, si)} className="btn-ghost p-0.5 text-muted hover:text-danger">
                                    <Trash2 size={12}/>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {bestE1rm && (
                          <div className="flex gap-4 text-xs text-muted pt-2 border-t border-border/20 mt-1">
                            <span>Best e1RM: <span className="text-accent font-medium">{bestE1rm.toFixed(1)} kg</span></span>
                            <span>Tonnage: <span className="text-accent font-medium">{tonnage.toFixed(0)} kg</span></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Add set row — always visible */}
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label className="label text-xs">kg</label>
                        <input
                          type="number" step="0.5" min="0"
                          className="input text-center font-medium"
                          placeholder="0"
                          value={sf.weight}
                          onChange={e = inputMode="decimal"> updateSetForm(exIdx, 'weight', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { document.getElementById(`reps-${exIdx}`)?.focus() } }}
                        />
                      </div>
                      <div className="flex-1">
                        <label className="label text-xs">Reps</label>
                        <input
                          id={`reps-${exIdx}`}
                          type="number" min="1" max="100"
                          className="input text-center font-medium"
                          placeholder="0"
                          value={sf.reps}
                          onChange={e => updateSetForm(exIdx, 'reps', e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') addSet(exIdx) }}
                        />
                      </div>
                      <div className="w-20 shrink-0">
                        <label className="label text-xs">RPE</label>
                        <select
                          className="input text-center"
                          value={sf.rpe}
                          onChange={e => updateSetForm(exIdx, 'rpe', e.target.value)}
                        >
                          {RPE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <label className="label text-xs">W-up</label>
                        <input type="checkbox" className="w-4 h-4 accent-accent"
                          checked={sf.warmup || false}
                          onChange={e => updateSetForm(exIdx, 'warmup', e.target.checked)}/>
                      </div>
                      <button
                        onClick={() => addSet(exIdx)}
                        disabled={!sf.weight || !sf.reps}
                        className="btn-primary shrink-0 flex items-center gap-1 disabled:opacity-40"
                      >
                        <Plus size={14}/> Set
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add exercise row */}
        <div className="mb-3">
          <label className="label">Add exercise</label>
          <ExercisePicker uid={uid} onAdd={addExercise}/>
        </div>

        {/* Add cardio block */}
        <button
          onClick={addCardioBlock}
          className="btn-secondary text-sm flex items-center gap-1.5 w-full justify-center mb-4"
        >
          <HeartPulse size={14} className="text-success"/> Add cardio block
        </button>

        {/* Session notes */}
        <div className="mb-4">
          <label className="label">Session notes</label>
          <div className="flex gap-2">
            <input type="text" className="input" placeholder="Optional"
              value={session.notes} onChange={e => setSession(p => ({ ...p, notes: e.target.value }))}/>
            <MicButton onTranscript={t => setSession(p => ({ ...p, notes: p.notes ? p.notes + ' ' + t : t }))}/>
          </div>
        </div>

        {/* Session RPE */}
        <div className="mb-3">
          <label className="label">Session RPE <span className="text-muted">(overall feel, optional)</span></label>
          <div className="flex gap-2 flex-wrap">
            {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(r => (
              <button key={r} type="button"
                onClick={() => setSession(p => ({ ...p, sessionRpe: r }))}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${session.sessionRpe === r ? 'bg-accent text-bg border-accent' : 'bg-surfaceAlt text-muted border-border/30'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Save / template */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={saveSession}
            className="btn-primary"
            disabled={saving || (!session.exercises.some(ex => ex.type === 'strength' && ex.sets.length > 0) && !session.exercises.some(ex => ex.type === 'cardio' && ex.cardio?.durationMin))}
          >
            {saving ? 'Saving...' : editId ? 'Update Session' : 'Save Session'}
          </button>
          {session.exercises.length > 0 && <SaveTemplateButton uid={uid} session={session}/>}
        </div>
      </div>
    </div>
  )
}

function SaveTemplateButton({ uid, session }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  const save = async () => {
    if (!name) return
    setSaving(true)
    try {
      await addEntry(uid, 'workoutTemplates', {
        name,
        exercises: session.exercises.filter(ex => ex.type === 'strength').map(ex => ({ name: ex.name, sets: ex.sets })),
      })
      setName(''); setOpen(false)
    } finally { setSaving(false) }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="btn-secondary">Save as Template</button>
  return (
    <div className="flex gap-2 items-center">
      <input className="input w-36" placeholder="Template name" value={name} onChange={e => setName(e.target.value)}/>
      <button onClick={save} className="btn-primary" disabled={saving}>Save</button>
      <button onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
    </div>
  )
}


// ── Cardio Tab ────────────────────────────────────────────────────────────────
function CardioTab({ uid }) {
  const DRAFT_KEY = `pt-draft-cardio-${uid}`

  const emptyForm = () => ({
    date: today(),
    timeOfDay: detectTimeOfDay(),
    type: 'Running',
    durationMin: '',
    distanceKm: '',
    avgHr: '',
    maxHr: '',
    kcal: '',
    rpe: '',
    notes: '',
  })

  const [form, setForm] = useState(emptyForm)
  const [entries, setEntries] = useState([])
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [draftPrompt, setDraftPrompt] = useState(null)

  const draftTimer = useRef(null)

  useEffect(() => {
    const unsub = subscribe(uid, 'cardio', setEntries, { limit: 100 })
    const draft = loadDraft(DRAFT_KEY)
    if (draft?.data?.type) setDraftPrompt(draft)
    return unsub
  }, [uid])

  useEffect(() => {
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      if (form.type && (form.durationMin || form.distanceKm)) saveDraft(DRAFT_KEY, form)
    }, 500)
  }, [form])

  const save = async (e) => {
    e.preventDefault()
    if (!form.durationMin) return
    setSaving(true)
    try {
      const data = {
        date: form.date,
        timeOfDay: form.timeOfDay || null,
        type: form.type,
        durationMin: parseFloat(form.durationMin),
        distanceKm: form.distanceKm ? parseFloat(form.distanceKm) : null,
        avgHr: form.avgHr ? parseInt(form.avgHr) : null,
        maxHr: form.maxHr ? parseInt(form.maxHr) : null,
        kcal: form.kcal ? parseFloat(form.kcal) : null,
        rpe: form.rpe ? parseFloat(form.rpe) : null,
        notes: form.notes,
      }
      if (editId) {
        await setEntry(uid, 'cardio', editId, data)
        setEditId(null)
      } else {
        await addEntry(uid, 'cardio', data)
      }
      clearDraft(DRAFT_KEY)
      setForm(emptyForm())
    } finally { setSaving(false) }
  }

  const startEdit = (entry) => {
    setForm({
      date: entry.date,
      timeOfDay: entry.timeOfDay || null,
      type: entry.type || 'Running',
      durationMin: entry.durationMin || '',
      distanceKm: entry.distanceKm || '',
      avgHr: entry.avgHr || '',
      maxHr: entry.maxHr || '',
      kcal: entry.kcal || '',
      rpe: entry.rpe || '',
      notes: entry.notes || '',
    })
    setEditId(entry.id)
  }

  const cancelEdit = () => { setEditId(null); setForm(emptyForm()) }

  return (
    <div className="space-y-4">
      {draftPrompt && (
        <div className="card border-accent/30 bg-accent/5">
          <div className="flex items-center justify-between">
            <p className="text-sm">Unsaved cardio from <span className="text-accent">{draftAgo(draftPrompt.at)}</span> — restore?</p>
            <div className="flex gap-2">
              <button onClick={() => { setForm(draftPrompt.data); setDraftPrompt(null) }} className="btn-primary text-xs">Restore</button>
              <button onClick={() => { clearDraft(DRAFT_KEY); setDraftPrompt(null) }} className="btn-ghost text-xs">Discard</button>
            </div>
          </div>
        </div>
      )}

      {editId && (
        <div className="card border-warn/30 bg-warn/5">
          <p className="text-sm text-warn">Editing existing session. <button onClick={cancelEdit} className="underline">Cancel edit</button></p>
        </div>
      )}

      <div className="card">
        <div className="card-title flex items-center gap-2">
          <HeartPulse size={16} className="text-accent"/>
          {editId ? 'Edit Cardio Session' : 'Log Cardio Session'}
        </div>
        <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Time of day</label>
            <TodSelect value={form.timeOfDay} onChange={v => setForm(p => ({ ...p, timeOfDay: v }))}/>
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
              {CARDIO_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Duration (min) *</label>
            <input type="number" min="1" step="1" className="input" placeholder="e.g. 30"
              value={form.durationMin} onChange={e => setForm(p => ({ ...p, durationMin: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Distance (km)</label>
            <input type="number" step="0.01" min="0" className="input" placeholder="optional"
              value={form.distanceKm} onChange={e = inputMode="decimal"> setForm(p => ({ ...p, distanceKm: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Avg HR (bpm)</label>
            <input type="number" min="40" max="220" className="input" placeholder="optional"
              value={form.avgHr} onChange={e => setForm(p => ({ ...p, avgHr: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Max HR (bpm)</label>
            <input type="number" min="40" max="220" className="input" placeholder="optional"
              value={form.maxHr} onChange={e => setForm(p => ({ ...p, maxHr: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Calories</label>
            <input type="number" min="0" step="1" className="input" placeholder="optional"
              value={form.kcal} onChange={e => setForm(p => ({ ...p, kcal: e.target.value }))}/>
          </div>
          <div>
            <label className="label">RPE (1–10)</label>
            <input type="number" min="1" max="10" step="0.5" className="input" placeholder="optional"
              value={form.rpe} onChange={e = inputMode="decimal"> setForm(p => ({ ...p, rpe: e.target.value }))}/>
          </div>
          <div className="col-span-2 md:col-span-3">
            <label className="label">Notes</label>
            <input type="text" className="input" placeholder="Optional notes"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
          </div>
          <div className="col-span-2 md:col-span-3 flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving || !form.durationMin}>
              {saving ? 'Saving…' : editId ? 'Update' : 'Save Cardio'}
            </button>
            {editId && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      {/* Cardio stats summary */}
      {(() => {
        const last30 = entries.filter(e => e.date >= format(new Date(Date.now() - 30 * 86400000), 'yyyy-MM-dd'))
        const totalKm = last30.reduce((a, e) => a + (parseFloat(e.distanceKm) || 0), 0)
        const totalMin = last30.reduce((a, e) => a + (parseFloat(e.durationMin) || 0), 0)
        const totalKcal = last30.reduce((a, e) => a + (parseFloat(e.kcal) || 0), 0)
        const longest = last30.reduce((best, e) => (parseFloat(e.durationMin) || 0) > (best?.durationMin || 0) ? e : best, null)
        const withPace = last30.filter(e => e.distanceKm && e.durationMin && e.type === 'Running')
        const avgPaceSec = withPace.length ? withPace.reduce((a, e) => a + (e.durationMin * 60 / e.distanceKm), 0) / withPace.length : null
        const avgPaceStr = avgPaceSec ? `${Math.floor(avgPaceSec / 60)}:${String(Math.round(avgPaceSec % 60)).padStart(2, '0')}/km` : null
        if (!last30.length) return null
        return (
          <div className="card">
            <div className="card-title flex items-center gap-2"><HeartPulse size={16} className="text-success"/>Last 30 Days</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-bg rounded-xl p-3 text-center">
                <div className="text-xs text-muted mb-1">Sessions</div>
                <div className="text-accent font-bold text-lg">{last30.length}</div>
              </div>
              {totalKm > 0 && (
                <div className="bg-bg rounded-xl p-3 text-center">
                  <div className="text-xs text-muted mb-1">Distance</div>
                  <div className="text-accent font-bold text-lg">{totalKm.toFixed(1)} km</div>
                </div>
              )}
              <div className="bg-bg rounded-xl p-3 text-center">
                <div className="text-xs text-muted mb-1">Total time</div>
                <div className="text-accent font-bold text-lg">{Math.round(totalMin)} min</div>
              </div>
              {totalKcal > 0 && (
                <div className="bg-bg rounded-xl p-3 text-center">
                  <div className="text-xs text-muted mb-1">Calories burned</div>
                  <div className="text-accent font-bold text-lg">{Math.round(totalKcal)}</div>
                </div>
              )}
              {avgPaceStr && (
                <div className="bg-bg rounded-xl p-3 text-center">
                  <div className="text-xs text-muted mb-1">Avg running pace</div>
                  <div className="text-accent font-bold text-lg">{avgPaceStr}</div>
                </div>
              )}
              {longest && (
                <div className="bg-bg rounded-xl p-3 text-center col-span-2">
                  <div className="text-xs text-muted mb-1">Longest session</div>
                  <div className="text-text font-semibold text-sm">{longest.type} · {longest.durationMin} min{longest.distanceKm ? ` · ${longest.distanceKm} km` : ''}</div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      <div className="card">
        <div className="card-title">Recent Cardio (last 30)</div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No cardio sessions logged yet.</p>
        ) : entries.slice(0, 30).map(e => (
          <EditableRow key={e.id}
            onEdit={() => startEdit(e)}
            onDelete={() => deleteEntry(uid, 'cardio', e.id)}
            className="mb-1"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-text">{e.type}</span>
                <TodChip tod={e.timeOfDay}/>
                <span className="text-xs text-muted">{e.date}</span>
              </div>
              <div className="text-xs text-muted mt-0.5">
                {e.durationMin} min
                {e.distanceKm ? ` · ${e.distanceKm} km` : ''}
                {e.avgHr ? ` · ♥ avg ${e.avgHr} bpm` : ''}
                {e.kcal ? ` · ${e.kcal} kcal` : ''}
                {e.rpe ? ` · RPE ${e.rpe}` : ''}
              </div>
              {e.notes && <p className="text-xs text-muted italic mt-0.5">{e.notes}</p>}
            </div>
          </EditableRow>
        ))}
      </div>
    </div>
  )
}

// ── Custom Routine Builder ─────────────────────────────────────────────────────
function RoutineBuilder({ uid, initial = null, onSave, onCancel }) {
  const blankStretch = () => ({ stretch: '', durationSec: 30 })
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [items, setItems] = useState(
    initial?.stretches?.length ? initial.stretches.map(s => ({ ...s })) : [blankStretch()]
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const updateItem = (i, field, val) => setItems(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  const addItem = () => setItems(prev => [...prev, blankStretch()])
  const removeItem = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const moveItem = (i, dir) => {
    const next = [...items]
    const swap = i + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[i], next[swap]] = [next[swap], next[i]]
    setItems(next)
  }

  const totalMin = Math.round(items.reduce((acc, s) => acc + (parseInt(s.durationSec) || 0), 0) / 60)

  const handleSave = async () => {
    if (!name.trim()) { setErr('Give the routine a name.'); return }
    const validItems = items.filter(s => (s.stretch === '__custom' ? s.customName?.trim() : s.stretch?.trim()))
    if (!validItems.length) { setErr('Add at least one stretch.'); return }
    setSaving(true)
    try {
      const doc = {
        name: name.trim(),
        description: description.trim(),
        durationMin: totalMin || 1,
        stretches: validItems.map(s => ({
          stretch: s.stretch === '__custom' ? (s.customName || 'Custom') : s.stretch,
          durationSec: parseInt(s.durationSec) || 30,
        })),
      }
      if (initial?.id) {
        await setEntry(uid, 'customRoutines', initial.id, { ...doc, id: initial.id })
        onSave({ ...doc, id: initial.id })
      } else {
        const ref = await addEntry(uid, 'customRoutines', doc)
        onSave({ ...doc, id: ref.id })
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Activity size={16} className="text-accent"/>
          {initial ? 'Edit Routine' : 'New Routine'}
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Mobility"/>
          </div>
          <div>
            <label className="label">Description <span className="text-muted">(optional)</span></label>
            <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What is this for?"/>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-text">Stretches</div>
          <span className="text-xs text-muted">{totalMin} min total</span>
        </div>

        <div className="space-y-2 mb-3">
          {items.map((item, i) => (
            <div key={i} className="bg-surfaceAlt rounded-xl p-2 flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="btn-ghost p-0.5 disabled:opacity-30"><ArrowUp size={12}/></button>
                <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="btn-ghost p-0.5 disabled:opacity-30"><ArrowDown size={12}/></button>
              </div>
              <div className="flex-1 min-w-0">
                <select
                  className="input text-xs mb-1 w-full"
                  value={item.stretch}
                  onChange={e => updateItem(i, 'stretch', e.target.value)}
                >
                  <option value="">Pick stretch...</option>
                  {STRETCHES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  <option value="__custom">Custom...</option>
                </select>
                {item.stretch === '__custom' && (
                  <input className="input text-xs mb-1 w-full" placeholder="Stretch name"
                    value={item.customName || ''}
                    onChange={e => updateItem(i, 'customName', e.target.value)}
                  />
                )}
              </div>
              <div className="w-20 shrink-0">
                <input
                  type="number" className="input text-xs text-center"
                  value={item.durationSec}
                  min={5} step={5}
                  onChange={e => updateItem(i, 'durationSec', e.target.value)}
                />
                <div className="text-xs text-muted text-center">sec</div>
              </div>
              <button onClick={() => removeItem(i)} className="btn-ghost p-1 text-danger shrink-0"><Trash2 size={13}/></button>
            </div>
          ))}
        </div>

        <button onClick={addItem} className="btn-secondary text-xs flex items-center gap-1 mb-4">
          <Plus size={12}/> Add stretch
        </button>

        {err && <p className="text-xs text-danger mb-2">{err}</p>}

        <div className="flex gap-2">
          <button onClick={handleSave} className="btn-primary flex items-center gap-1" disabled={saving}>
            <Save size={13}/> {saving ? 'Saving...' : 'Save routine'}
          </button>
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Mobility Tab ──────────────────────────────────────────────────────────────
function MobilityTab({ uid }) {
  const [activeTimer, setActiveTimer] = useState(null)
  const [mobilityLogs, setMobilityLogs] = useState([])
  const [customRoutines, setCustomRoutines] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [building, setBuilding] = useState(false)
  const [editingRoutine, setEditingRoutine] = useState(null)

  useEffect(() => {
    const unsub = subscribe(uid, 'mobilityLog', setMobilityLogs, { limit: 50 })
    getAll(uid, 'customRoutines').then(setCustomRoutines)
    return unsub
  }, [uid])

  const allRoutines = [...ROUTINES, ...customRoutines]

  const handleComplete = async (logData) => {
    setSaving(true)
    try {
      await addEntry(uid, 'mobilityLog', {
        ...logData,
        date: format(new Date(), 'yyyy-MM-dd'),
        timeOfDay: detectTimeOfDay(),
        notes: '',
      })
      setActiveTimer(null)
      setSaved(logData.routineName)
      setTimeout(() => setSaved(''), 3000)
    } finally { setSaving(false) }
  }

  const handleDeleteRoutine = async (r) => {
    if (!confirm(`Delete "${r.name}"?`)) return
    await deleteEntry(uid, 'customRoutines', r.id)
    setCustomRoutines(prev => prev.filter(x => x.id !== r.id))
  }

  const handleRoutineSaved = (savedRoutine) => {
    setCustomRoutines(prev => {
      const idx = prev.findIndex(r => r.id === savedRoutine.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = savedRoutine; return n }
      return [...prev, savedRoutine]
    })
    setBuilding(false)
    setEditingRoutine(null)
  }

  if (building || editingRoutine) {
    return (
      <RoutineBuilder
        uid={uid}
        initial={editingRoutine}
        onSave={handleRoutineSaved}
        onCancel={() => { setBuilding(false); setEditingRoutine(null) }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {activeTimer && (
        <RoutineTimer
          routine={activeTimer}
          onComplete={handleComplete}
          onClose={() => setActiveTimer(null)}
        />
      )}

      {saved && (
        <div className="card border-success/30 bg-success/5">
          <p className="text-sm text-success flex items-center gap-2">
            <CheckCircle size={14}/> {saved} logged!
          </p>
        </div>
      )}

      {/* Routines */}
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <div className="card-title flex items-center gap-2">
            <Activity size={16} className="text-accent"/> Mobility Routines
          </div>
          <button onClick={() => setBuilding(true)} className="btn-primary text-xs flex items-center gap-1">
            <Plus size={12}/> New routine
          </button>
        </div>
        <p className="text-xs text-muted mb-3">
          Start a routine — the timer guides you through each stretch automatically.
        </p>
        <div className="space-y-3">
          {allRoutines.map(r => {
            const isCustom = !ROUTINES.find(br => br.id === r.id)
            return (
              <div key={r.id} className="bg-surfaceAlt rounded-xl p-3">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <span className="font-medium text-text text-sm">{r.name}</span>
                    {isCustom && <span className="text-accent text-xs ml-2">Custom</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {isCustom && (
                      <>
                        <button onClick={() => setEditingRoutine(r)} className="btn-ghost p-1"><Pencil size={12}/></button>
                        <button onClick={() => handleDeleteRoutine(r)} className="btn-ghost p-1 text-danger"><Trash2 size={12}/></button>
                      </>
                    )}
                    <button
                      onClick={() => setActiveTimer(r)}
                      className="btn-primary text-xs flex items-center gap-1 ml-1 shrink-0"
                    >
                      <Play size={12}/> Start
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted mb-1">{r.description}</p>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span><Timer size={11} className="inline mr-0.5"/>{r.durationMin} min</span>
                  <span>{r.stretches?.length} stretches</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Individual stretches reference */}
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Zap size={16} className="text-accent"/> Stretch Library
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {STRETCHES.map(s => (
            <div key={s.name} className="bg-surfaceAlt rounded-lg px-3 py-2">
              <div className="text-sm font-medium text-text">{s.name}</div>
              <div className="text-xs text-muted">{s.muscle} · {s.defaultDurationSec}s</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent mobility logs */}
      {mobilityLogs.length > 0 && (
        <div className="card">
          <div className="card-title">Recent Mobility Sessions</div>
          {mobilityLogs.slice(0, 10).map(log => (
            <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
              <div>
                <span className="text-sm text-text">{log.routineName}</span>
                <span className="text-xs text-muted ml-2">{log.durationMin} min</span>
              </div>
              <span className="text-xs text-muted">{log.date}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Custom Program Builder ─────────────────────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DIFFICULTY_OPTIONS = ['beginner', 'intermediate', 'advanced']
const STYLE_OPTIONS = ['strength', 'hypertrophy', 'hybrid', 'endurance']

function ProgramBuilder({ uid, initial = null, onSave, onCancel }) {
  const { all: allExercises } = useExerciseList(uid)
  const exerciseNames = allExercises.map(e => e.name)

  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [difficulty, setDifficulty] = useState(initial?.difficulty || 'intermediate')
  const [style, setStyle] = useState(initial?.style || 'strength')
  const [durationWeeks, setDurationWeeks] = useState(initial?.durationWeeks || 8)
  const [scheduleMode, setScheduleMode] = useState(initial?.scheduleMode || 'fixed')
  const [progressionRule, setProgressionRule] = useState(initial?.progressionRule || '')

  const blankWorkout = (key) => ({ key: key || `Day${Date.now()}`, name: '', type: 'strength', exercises: [], description: '', durationMin: 0 })
  const [workouts, setWorkouts] = useState(() => {
    if (initial?.workouts) {
      return Object.entries(initial.workouts).map(([key, w]) => ({ key, ...w }))
    }
    return [blankWorkout('A')]
  })

  const [schedule, setSchedule] = useState(() => {
    if (initial?.weeklySchedule?.length === 7) return [...initial.weeklySchedule]
    return Array(7).fill('rest')
  })

  const blankMilestone = () => ({ id: `m-${Date.now()}`, name: '', exercise: '', multiplier: 1.0, reps: 5 })
  const [milestones, setMilestones] = useState(initial?.milestones ? initial.milestones.map(m => ({ ...m })) : [])

  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const [activeWorkoutIdx, setActiveWorkoutIdx] = useState(0)

  const addWorkout = () => setWorkouts(prev => [...prev, blankWorkout()])
  const removeWorkout = (i) => {
    const key = workouts[i].key
    setWorkouts(prev => prev.filter((_, idx) => idx !== i))
    setSchedule(prev => prev.map(s => s === key ? 'rest' : s))
    setActiveWorkoutIdx(0)
  }
  const updateWorkout = (i, field, val) => setWorkouts(prev => prev.map((w, idx) => idx === i ? { ...w, [field]: val } : w))

  const blankExercise = () => ({ name: '', sets: 3, reps: '8-10', notes: '' })
  const addExercise = (wi) => setWorkouts(prev => prev.map((w, i) => i === wi ? { ...w, exercises: [...(w.exercises || []), blankExercise()] } : w))
  const removeExercise = (wi, ei) => setWorkouts(prev => prev.map((w, i) => i === wi ? { ...w, exercises: w.exercises.filter((_, j) => j !== ei) } : w))
  const updateExercise = (wi, ei, field, val) => setWorkouts(prev => prev.map((w, i) => i === wi ? {
    ...w, exercises: w.exercises.map((ex, j) => j === ei ? { ...ex, [field]: val } : ex)
  } : w))
  const moveExercise = (wi, ei, dir) => setWorkouts(prev => prev.map((w, i) => {
    if (i !== wi) return w
    const exs = [...w.exercises]
    const swap = ei + dir
    if (swap < 0 || swap >= exs.length) return w
    ;[exs[ei], exs[swap]] = [exs[swap], exs[ei]]
    return { ...w, exercises: exs }
  }))

  const updateMilestone = (i, field, val) => setMilestones(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m))
  const removeMilestone = (i) => setMilestones(prev => prev.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!name.trim()) { setErr('Give the program a name.'); return }
    if (!workouts.some(w => w.name.trim())) { setErr('Name at least one workout day.'); return }
    setSaving(true)
    try {
      const workoutsObj = {}
      workouts.filter(w => w.name.trim()).forEach(w => {
        const { key, ...rest } = w
        workoutsObj[key] = { ...rest, name: rest.name.trim() }
      })
      const docData = {
        name: name.trim(),
        description: description.trim(),
        difficulty,
        style,
        durationWeeks: parseInt(durationWeeks) || 8,
        daysPerWeek: schedule.filter(s => s !== 'rest').length,
        weeklySchedule: schedule,
        scheduleMode,
        progressionRule: progressionRule.trim(),
        workouts: workoutsObj,
        milestones: milestones.filter(m => m.name.trim()),
        custom: true,
      }
      if (initial?.id) {
        await setEntry(uid, 'customPrograms', initial.id, { ...docData, id: initial.id })
        onSave({ ...docData, id: initial.id })
      } else {
        const ref = await addEntry(uid, 'customPrograms', docData)
        onSave({ ...docData, id: ref.id })
      }
    } finally { setSaving(false) }
  }

  const activeW = workouts[activeWorkoutIdx] || workouts[0]

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Zap size={16} className="text-accent"/>
          {initial?.id ? 'Edit Program' : 'New Program'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
          <div>
            <label className="label">Program name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Upper/Lower Split"/>
          </div>
          <div>
            <label className="label">Duration (weeks)</label>
            <input type="number" className="input" value={durationWeeks} min={1} max={52} onChange={e => setDurationWeeks(e.target.value)}/>
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select className="input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
              {DIFFICULTY_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Style</label>
            <select className="input" value={style} onChange={e => setStyle(e.target.value)}>
              {STYLE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <label className="label">Description <span className="text-muted">(optional)</span></label>
          <input className="input" value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this program about?"/>
        </div>
        <div className="mb-3">
          <label className="label">Schedule mode</label>
          <div className="flex gap-2 mb-1">
            {[['fixed', 'Fixed days'], ['sequential', 'Next in sequence']].map(([val, label]) => (
              <button key={val} onClick={() => setScheduleMode(val)}
                className={scheduleMode === val ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            {scheduleMode === 'fixed'
              ? 'Mon = slot 1, Tue = slot 2, etc. Missing a day means missing that workout.'
              : 'Next workout happens whenever you next train. Missed days carry over.'}
          </p>
        </div>
        <div>
          <label className="label">Progression rule <span className="text-muted">(optional)</span></label>
          <input className="input" value={progressionRule} onChange={e => setProgressionRule(e.target.value)} placeholder="e.g. Add 2.5 kg when all reps completed"/>
        </div>
      </div>

      {/* Workout day builder */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="card-title flex items-center gap-2"><Dumbbell size={16} className="text-accent"/> Workout Days</div>
          <button onClick={addWorkout} className="btn-primary text-xs flex items-center gap-1"><Plus size={12}/> Add day</button>
        </div>
        <div className="flex gap-1 flex-wrap mb-3">
          {workouts.map((w, i) => (
            <button key={i} onClick={() => setActiveWorkoutIdx(i)}
              className={`text-xs px-3 py-1 rounded-lg ${activeWorkoutIdx === i ? 'bg-accent text-bg font-semibold' : 'bg-surfaceAlt text-muted'}`}>
              {w.name || `Day ${i + 1}`}
            </button>
          ))}
        </div>

        {activeW && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Day name</label>
                <input className="input" value={activeW.name} onChange={e => updateWorkout(activeWorkoutIdx, 'name', e.target.value)} placeholder="e.g. Push A"/>
              </div>
              <div>
                <label className="label">Type</label>
                <select className="input" value={activeW.type || 'strength'} onChange={e => updateWorkout(activeWorkoutIdx, 'type', e.target.value)}>
                  <option value="strength">Strength / Hypertrophy</option>
                  <option value="cardio">Cardio</option>
                  <option value="mobility">Mobility</option>
                </select>
              </div>
            </div>

            {(activeW.type === 'cardio' || activeW.type === 'mobility') ? (
              <div className="space-y-2">
                <div>
                  <label className="label">Description</label>
                  <input className="input" value={activeW.description || ''} onChange={e => updateWorkout(activeWorkoutIdx, 'description', e.target.value)} placeholder="e.g. 30 min Zone 2 run"/>
                </div>
                <div>
                  <label className="label">Target duration (min)</label>
                  <input type="number" className="input" value={activeW.durationMin || ''} onChange={e => updateWorkout(activeWorkoutIdx, 'durationMin', parseInt(e.target.value) || 0)}/>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-text">Exercises</div>
                  <button onClick={() => addExercise(activeWorkoutIdx)} className="btn-secondary text-xs flex items-center gap-1"><Plus size={11}/> Add</button>
                </div>
                <div className="space-y-2">
                  {(activeW.exercises || []).map((ex, ei) => (
                    <div key={ei} className="bg-surfaceAlt rounded-xl p-2 flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveExercise(activeWorkoutIdx, ei, -1)} disabled={ei === 0} className="btn-ghost p-0.5 disabled:opacity-30"><ArrowUp size={11}/></button>
                        <button onClick={() => moveExercise(activeWorkoutIdx, ei, 1)} disabled={ei === (activeW.exercises?.length || 0) - 1} className="btn-ghost p-0.5 disabled:opacity-30"><ArrowDown size={11}/></button>
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <select className="input text-xs w-full" value={ex.name} onChange={e => updateExercise(activeWorkoutIdx, ei, 'name', e.target.value)}>
                          <option value="">Pick exercise...</option>
                          {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <div className="flex gap-1">
                          <input type="number" className="input text-xs w-16" placeholder="Sets" min={1} value={ex.sets} onChange={e => updateExercise(activeWorkoutIdx, ei, 'sets', parseInt(e.target.value) || 1)}/>
                          <input className="input text-xs flex-1" placeholder="Reps e.g. 5 or 8-10" value={ex.reps} onChange={e => updateExercise(activeWorkoutIdx, ei, 'reps', e.target.value)}/>
                          <input className="input text-xs flex-1" placeholder="Notes" value={ex.notes || ''} onChange={e => updateExercise(activeWorkoutIdx, ei, 'notes', e.target.value)}/>
                        </div>
                      </div>
                      <button onClick={() => removeExercise(activeWorkoutIdx, ei)} className="btn-ghost p-1 text-danger shrink-0"><Trash2 size={13}/></button>
                    </div>
                  ))}
                  {!activeW.exercises?.length && <p className="text-xs text-muted">No exercises yet.</p>}
                </div>
              </div>
            )}

            {workouts.length > 1 && (
              <button onClick={() => removeWorkout(activeWorkoutIdx)} className="btn-danger text-xs flex items-center gap-1">
                <Trash2 size={12}/> Remove this day
              </button>
            )}
          </div>
        )}
      </div>

      {/* Weekly schedule */}
      <div className="card">
        <div className="card-title flex items-center gap-2"><Calendar size={16} className="text-accent"/> Weekly Schedule</div>
        <p className="text-xs text-muted mb-3">Assign a workout to each day, or leave as rest. Only matters in Fixed days mode.</p>
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="text-xs text-muted">{day}</div>
              <select
                className="input text-xs p-1 text-center w-full"
                value={schedule[i]}
                onChange={e => setSchedule(prev => prev.map((s, j) => j === i ? e.target.value : s))}
              >
                <option value="rest">Rest</option>
                {workouts.filter(w => w.name.trim()).map(w => (
                  <option key={w.key} value={w.key}>{w.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="card-title flex items-center gap-2"><Trophy size={16} className="text-warn"/> Milestones <span className="text-muted text-xs">(optional)</span></div>
          <button onClick={() => setMilestones(prev => [...prev, blankMilestone()])} className="btn-secondary text-xs flex items-center gap-1"><Plus size={11}/> Add</button>
        </div>
        {milestones.length === 0 && <p className="text-xs text-muted">No milestones set.</p>}
        {milestones.map((m, i) => (
          <div key={m.id} className="bg-surfaceAlt rounded-xl p-2 mb-2 space-y-1">
            <div className="flex gap-2">
              <input className="input text-xs flex-1" placeholder="e.g. Squat bodyweight x 5" value={m.name} onChange={e => updateMilestone(i, 'name', e.target.value)}/>
              <button onClick={() => removeMilestone(i)} className="btn-ghost p-1 text-danger"><Trash2 size={13}/></button>
            </div>
            <div className="flex gap-1 flex-wrap">
              <select className="input text-xs" value={m.exercise || ''} onChange={e => updateMilestone(i, 'exercise', e.target.value)}>
                <option value="">Exercise...</option>
                {exerciseNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <input type="number" className="input text-xs w-24" placeholder="BW mult e.g. 1.5" step={0.25} value={m.multiplier} onChange={e => updateMilestone(i, 'multiplier', parseFloat(e.target.value) || 1)}/>
              <input type="number" className="input text-xs w-16" placeholder="Reps" min={1} value={m.reps} onChange={e => updateMilestone(i, 'reps', parseInt(e.target.value) || 1)}/>
            </div>
          </div>
        ))}
      </div>

      {err && <p className="text-xs text-danger">{err}</p>}
      <div className="flex gap-2 flex-wrap">
        <button onClick={handleSave} className="btn-primary flex items-center gap-1" disabled={saving}>
          <Save size={13}/> {saving ? 'Saving...' : (initial?.id ? 'Save changes' : 'Create program')}
        </button>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </div>
  )
}

// ── Programs Tab ──────────────────────────────────────────────────────────────
function ProgramsTab({ uid }) {
  const [settings, setSettings] = useState({})
  const [lifts, setLifts] = useState([])
  const [weights, setWeights] = useState([])
  const [customPrograms, setCustomPrograms] = useState([])
  const [viewProgram, setViewProgram] = useState(null)
  const [building, setBuilding] = useState(false)
  const [editingProgram, setEditingProgram] = useState(null)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings(uid).then(setSettings)
    const u1 = subscribe(uid, 'lifts', data => setLifts(data.map(normaliseLift)), { limit: 500 })
    const u2 = subscribe(uid, 'weights', setWeights, { limit: 90 })
    getAll(uid, 'customPrograms').then(setCustomPrograms)
    return () => { u1(); u2() }
  }, [uid])

  const activeProgram = settings.activeProgram || null
  const activeProgramDef = activeProgram ? resolveProgram(activeProgram.id, customPrograms) : null

  const startProgram = async (program, sd) => {
    setSaving(true)
    try {
      const newActive = {
        id: program.id,
        startDate: sd || format(new Date(), 'yyyy-MM-dd'),
        weekNumber: 1,
        scheduleMode: program.scheduleMode || 'fixed',
        customisations: {},
        completedSessions: {},
        customMilestones: [],
      }
      await saveSettings(uid, { activeProgram: newActive })
      setSettings(prev => ({ ...prev, activeProgram: newActive }))
      setViewProgram(null)
    } finally { setSaving(false) }
  }

  const exitProgram = async () => {
    if (!confirm('Exit current program? Progress will be saved.')) return
    setSaving(true)
    try {
      await saveSettings(uid, { activeProgram: null })
      setSettings(prev => ({ ...prev, activeProgram: null }))
    } finally { setSaving(false) }
  }

  const markSessionDone = async () => {
    if (!activeProgram || !activeProgramDef) return
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const todayWorkoutKey = getTodayWorkout(activeProgramDef, activeProgram)
    const updated = {
      ...activeProgram,
      completedSessions: {
        ...(activeProgram.completedSessions || {}),
        [todayStr]: todayWorkoutKey,
      },
    }
    await saveSettings(uid, { activeProgram: updated })
    setSettings(prev => ({ ...prev, activeProgram: updated }))
  }

  const toggleScheduleMode = async () => {
    if (!activeProgram) return
    const newMode = (activeProgram.scheduleMode || 'fixed') === 'fixed' ? 'sequential' : 'fixed'
    const updated = { ...activeProgram, scheduleMode: newMode }
    await saveSettings(uid, { activeProgram: updated })
    setSettings(prev => ({ ...prev, activeProgram: updated }))
  }

  const handleProgramSaved = (savedProg) => {
    setCustomPrograms(prev => {
      const idx = prev.findIndex(p => p.id === savedProg.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = savedProg; return n }
      return [...prev, savedProg]
    })
    setBuilding(false)
    setEditingProgram(null)
  }

  const handleDeleteProgram = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return
    await deleteEntry(uid, 'customPrograms', p.id)
    setCustomPrograms(prev => prev.filter(x => x.id !== p.id))
    if (activeProgram?.id === p.id) {
      await saveSettings(uid, { activeProgram: null })
      setSettings(prev => ({ ...prev, activeProgram: null }))
    }
  }

  const duplicateProgram = (p) => {
    const { id, ...rest } = p
    setEditingProgram({ ...rest, name: `${p.name} (copy)`, custom: true })
    setBuilding(true)
  }

  const allPrograms = [...PROGRAMS, ...customPrograms]

  if (building || editingProgram) {
    return (
      <ProgramBuilder
        uid={uid}
        initial={editingProgram}
        onSave={handleProgramSaved}
        onCancel={() => { setBuilding(false); setEditingProgram(null) }}
      />
    )
  }

  // ── Active program dashboard ──
  if (activeProgram && activeProgramDef) {
    const weekNum = computeWeekNumber(activeProgram, activeProgramDef)
    const totalWeeks = activeProgramDef.durationWeeks
    const todayWorkoutKey = getTodayWorkout(activeProgramDef, activeProgram)
    const todayWorkout = todayWorkoutKey && todayWorkoutKey !== 'rest'
      ? (activeProgramDef.workouts?.[todayWorkoutKey] || null)
      : null
    const pct = Math.round((weekNum / totalWeeks) * 100)
    const todayStr = format(new Date(), 'yyyy-MM-dd')
    const todayDone = !!(activeProgram.completedSessions || {})[todayStr]
    const schedMode = activeProgram.scheduleMode || 'fixed'
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const completedDays = new Set(Object.keys(activeProgram.completedSessions || {}).filter(d => d >= weekStart))
    const liftDays = new Set(lifts.filter(l => l.date >= weekStart).map(l => l.date))
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

    return (
      <div className="space-y-4">
        {/* Program header */}
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-lg font-bold text-text">{activeProgramDef.name}</div>
              <div className="text-sm text-muted">Week {weekNum} of {totalWeeks}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeProgramDef.difficulty === 'beginner' ? 'chip-ok' : 'bg-warn/20 text-warn'
              }`}>{activeProgramDef.difficulty}</span>
              {activeProgramDef.custom && <span className="text-accent text-xs">Custom</span>}
            </div>
          </div>
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Progress</span><span>{pct}%</span>
            </div>
            <div className="w-full bg-surfaceAlt rounded-full h-2">
              <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${pct}%` }}/>
            </div>
          </div>
          <button onClick={toggleScheduleMode} className="btn-secondary text-xs flex items-center gap-1">
            <Settings2 size={12}/> Mode: {schedMode === 'fixed' ? 'Fixed days' : 'Sequential'}
          </button>
        </div>

        {/* Today */}
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Dumbbell size={16} className="text-accent"/>
            Today
            {todayDone && <span className="chip-ok ml-auto text-xs">Done</span>}
          </div>
          {todayWorkoutKey === 'rest' ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">&#128564;</div>
              <div className="text-base font-semibold text-text">Rest Day</div>
              <p className="text-xs text-muted mt-1">Recovery is progress. Eat well, sleep well.</p>
            </div>
          ) : todayWorkout?.type === 'cardio' ? (
            <div className="mb-3">
              <div className="text-base font-semibold text-text mb-1">{todayWorkout.name}</div>
              <p className="text-sm text-muted mb-2">{todayWorkout.description}</p>
              <div className="text-xs text-muted">Target: {todayWorkout.durationMin} min</div>
            </div>
          ) : todayWorkout?.type === 'mobility' ? (
            <div className="mb-3">
              <div className="text-base font-semibold text-text mb-1">{todayWorkout.name}</div>
              <p className="text-sm text-muted">{todayWorkout.description}</p>
            </div>
          ) : todayWorkout ? (
            <div className="mb-3">
              <div className="text-base font-semibold text-text mb-2">{todayWorkout.name}</div>
              <div className="space-y-1">
                {(todayWorkout.exercises || []).map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Dumbbell size={12} className="text-accent shrink-0"/>
                    <span className="text-text">{ex.name}</span>
                    <span className="text-muted text-xs">{ex.sets}&times;{ex.reps}{ex.notes ? ` — ${ex.notes}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted mb-3">No workout scheduled today.</p>
          )}
          {todayWorkoutKey !== 'rest' && (
            <button
              onClick={markSessionDone}
              disabled={todayDone}
              className={todayDone ? 'btn-secondary text-xs flex items-center gap-1 opacity-60' : 'btn-primary text-xs flex items-center gap-1'}
            >
              <CheckCircle size={13}/> {todayDone ? 'Session marked done' : 'Mark session done'}
            </button>
          )}
        </div>

        {/* This week */}
        <div className="card">
          <div className="card-title">This Week</div>
          <div className="flex gap-1.5 items-end flex-wrap">
            {dayNames.map((d, i) => {
              const date = format(new Date(new Date().setDate(new Date().getDate() - ((new Date().getDay() + 6) % 7) + i)), 'yyyy-MM-dd')
              const done = completedDays.has(date) || liftDays.has(date)
              const isToday = date === todayStr
              const scheduledKey = activeProgramDef.weeklySchedule?.[i]
              const isRest = !scheduledKey || scheduledKey === 'rest'
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                    ${done ? 'bg-success text-bg' : isToday ? 'border-2 border-accent text-accent' : isRest ? 'bg-surfaceAlt/40 text-muted/40' : 'bg-surfaceAlt text-muted'}`}>
                    {d}
                  </div>
                  {!isRest && <div className="text-xs text-muted/60 truncate max-w-[32px] text-center">{scheduledKey?.slice(0, 4)}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Milestones */}
        {activeProgramDef.milestones?.length > 0 && (
          <div className="card">
            <div className="card-title flex items-center gap-2">
              <Trophy size={16} className="text-warn"/> Milestones
            </div>
            {activeProgramDef.milestones.map(m => {
              const { hit, progress, currentKg, targetKg } = computeMilestoneProgress(m, lifts, weights, cardioLogs, mobilityLogs)
              return (
                <MilestoneRow key={m.id} milestone={m} progress={progress} hit={hit} currentKg={currentKg} targetKg={targetKg}/>
              )
            })}
          </div>
        )}

        {/* Working weights tracker */}
        {(() => {
          const workoutKeys = Object.keys(activeProgramDef.workouts || {})
          const allProgramExes = workoutKeys.flatMap(k =>
            (activeProgramDef.workouts[k].exercises || []).map(ex => ex.name)
          ).filter((v, i, a) => a.indexOf(v) === i)
          if (!allProgramExes.length) return null

          // Compute last-used weight per exercise from recent lifts
          const lastUsed = {}
          lifts.slice(0, 50).forEach(l => {
            (l.exercises || []).forEach(ex => {
              if (allProgramExes.includes(ex.name) && !lastUsed[ex.name]) {
                const sets = (ex.sets || []).filter(s => !s.warmup)
                if (sets.length) {
                  const maxWeight = Math.max(...sets.map(s => parseFloat(s.weight) || 0))
                  lastUsed[ex.name] = { weight: maxWeight, date: l.date }
                }
              }
            })
          })

          // Working weights from settings or computed from lifts
          const workingWeights = activeProgram.workingWeights || {}

          return (
            <div className="card">
              <div className="card-title flex items-center gap-2">
                <Dumbbell size={15} className="text-accent"/> Working Weights
              </div>
              <p className="text-xs text-muted mb-3">Your current working weight per exercise. Updates automatically from your sessions, or edit manually.</p>
              <div className="space-y-2">
                {allProgramExes.map(exName => {
                  const manual = workingWeights[exName]
                  const auto = lastUsed[exName]
                  const displayWeight = manual?.weight || auto?.weight || null
                  const displayDate = manual?.date || auto?.date || null
                  const [editing, setEditing] = useState(false)
                  const [editVal, setEditVal] = useState(String(displayWeight || ''))

                  const saveWeight = async () => {
                    const kg = parseFloat(editVal)
                    if (isNaN(kg) || kg <= 0) return
                    const updated = {
                      ...activeProgram,
                      workingWeights: {
                        ...(activeProgram.workingWeights || {}),
                        [exName]: { weight: kg, date: format(new Date(), 'yyyy-MM-dd') }
                      }
                    }
                    await saveSettings(uid, { activeProgram: updated })
                    setSettings(prev => ({ ...prev, activeProgram: updated }))
                    setEditing(false)
                  }

                  return (
                    <div key={exName} className="flex items-center justify-between bg-surfaceAlt rounded-xl px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm text-text font-medium truncate">{exName}</div>
                        {displayDate && <div className="text-xs text-muted">Last: {displayDate}</div>}
                      </div>
                      {editing ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <input type="number" step="0.5" inputMode="decimal"
                            className="input w-20 text-sm text-center"
                            value={editVal} onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveWeight()}
                          />
                          <span className="text-xs text-muted">kg</span>
                          <button onClick={saveWeight} className="btn-primary text-xs px-2">✓</button>
                          <button onClick={() => setEditing(false)} className="btn-ghost text-xs">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-accent font-semibold">
                            {displayWeight ? `${displayWeight} kg` : '—'}
                          </span>
                          <button onClick={() => { setEditVal(String(displayWeight || '')); setEditing(true) }}
                            className="btn-ghost p-1"><Pencil size={12}/></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        <div className="flex gap-2 flex-wrap">
          {activeProgramDef.custom && (
            <button onClick={() => { setEditingProgram(activeProgramDef); setBuilding(true) }} className="btn-secondary text-xs flex items-center gap-1">
              <Pencil size={12}/> Edit program
            </button>
          )}
          <button onClick={exitProgram} className="btn-danger text-xs" disabled={saving}>
            {saving ? 'Saving...' : 'Exit program'}
          </button>
        </div>
      </div>
    )
  }

  // ── Program detail view ──
  if (viewProgram) {
    const isCustom = !!viewProgram.custom
    return (
      <div className="space-y-4">
        <button onClick={() => setViewProgram(null)} className="btn-ghost text-xs flex items-center gap-1">
          <ChevronDown size={14} className="rotate-90"/> Back to programs
        </button>
        <div className="card">
          <div className="flex items-start justify-between mb-1">
            <div className="text-xl font-bold text-text">{viewProgram.name}</div>
            {isCustom && <span className="text-accent text-xs">Custom</span>}
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            <span className="chip-ok">{viewProgram.difficulty}</span>
            <span className="text-xs text-muted">{viewProgram.durationWeeks} weeks · {viewProgram.daysPerWeek} days/wk</span>
          </div>
          <p className="text-sm text-muted mb-4">{viewProgram.description}</p>

          {viewProgram.progressionRule && (
            <div className="bg-surfaceAlt rounded-xl p-3 mb-4">
              <div className="text-xs font-medium text-text mb-1">Progression rule</div>
              <p className="text-xs text-muted">{viewProgram.progressionRule}</p>
            </div>
          )}

          {viewProgram.weeklySchedule?.length === 7 && (
            <div className="mb-4">
              <div className="text-sm font-semibold text-text mb-2">Weekly Schedule</div>
              <div className="grid grid-cols-7 gap-1">
                {DAY_LABELS.map((day, i) => {
                  const slot = viewProgram.weeklySchedule[i]
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5">
                      <div className="text-xs text-muted">{day}</div>
                      <div className={`text-xs px-1 py-0.5 rounded text-center w-full ${slot === 'rest' ? 'text-muted/40' : 'bg-accent/20 text-accent'}`}>
                        {slot === 'rest' ? '-' : slot.slice(0, 4)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {viewProgram.workouts && (
            <div className="mb-4">
              <div className="text-sm font-semibold text-text mb-2">Workouts</div>
              {Object.entries(viewProgram.workouts).map(([key, w]) => (
                <div key={key} className="bg-surfaceAlt rounded-xl p-3 mb-2">
                  <div className="text-sm font-medium text-text mb-1">{w.name || key}</div>
                  {w.exercises?.map((ex, i) => (
                    <div key={i} className="text-xs text-muted flex gap-2 py-0.5">
                      <Dumbbell size={11} className="text-accent shrink-0 mt-0.5"/>
                      <span>{ex.name} — {ex.sets}&times;{ex.reps}{ex.notes ? ` (${ex.notes})` : ''}</span>
                    </div>
                  ))}
                  {w.description && <p className="text-xs text-muted mt-1 italic">{w.description}</p>}
                  {(w.type === 'cardio' || w.type === 'mobility') && w.durationMin > 0 && (
                    <p className="text-xs text-muted mt-1">Target: {w.durationMin} min</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {viewProgram.milestones?.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-semibold text-text mb-2">Milestones</div>
              {viewProgram.milestones.map(m => (
                <div key={m.id} className="flex items-center gap-2 py-1 text-xs">
                  <Trophy size={12} className="text-warn shrink-0"/>
                  <span className="text-text">{m.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 items-end flex-wrap mt-4">
            <div>
              <label className="label text-xs">Start date</label>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)}/>
            </div>
            <button onClick={() => startProgram(viewProgram, startDate)} className="btn-primary flex items-center gap-1" disabled={saving}>
              <Play size={14}/> {saving ? 'Starting...' : 'Start program'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Program gallery ──
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-1">
          <div className="card-title flex items-center gap-2">
            <Zap size={16} className="text-accent"/> Workout Programs
          </div>
          <button onClick={() => { setEditingProgram(null); setBuilding(true) }} className="btn-primary text-xs flex items-center gap-1">
            <Plus size={12}/> New program
          </button>
        </div>
        <p className="text-sm text-muted">Choose a program to follow. You can only run one at a time.</p>
      </div>
      {allPrograms.map(p => (
        <div key={p.id}>
          <ProgramCard program={p} onView={setViewProgram} onStart={(prog) => startProgram(prog, format(new Date(), 'yyyy-MM-dd'))}/>
          <div className="flex gap-2 mt-1 px-1">
            {p.custom && (
              <>
                <button onClick={() => { setEditingProgram(p); setBuilding(true) }} className="btn-ghost text-xs flex items-center gap-1"><Pencil size={11}/> Edit</button>
                <button onClick={() => handleDeleteProgram(p)} className="btn-ghost text-xs text-danger flex items-center gap-1"><Trash2 size={11}/> Delete</button>
              </>
            )}
            <button onClick={() => duplicateProgram(p)} className="btn-ghost text-xs flex items-center gap-1">
              <Copy size={11}/> {p.custom ? 'Duplicate' : 'Fork & customise'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}


// ── History ────────────────────────────────────────────────────────────────────
function HistoryTab({ uid, onEditLift }) {
  const { all: allExercises } = useExerciseList(uid)
  const exerciseNames = allExercises.map(e => e.name)

  const [lifts, setLifts] = useState([])
  const [cardio, setCardio] = useState([])
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState({})
  const [chartExercise, setChartExercise] = useState(exerciseNames[0] || 'Bench Press')

  useEffect(() => {
    const u1 = subscribe(uid, 'lifts', data => setLifts(data.map(normaliseLift)), { limit: 500 })
    const u2 = subscribe(uid, 'cardio', setCardio, { limit: 100 })
    return () => { u1(); u2() }
  }, [uid])

  // Weekly tonnage (last 12 weeks)
  const tonnageByWeek = (() => {
    const result = []
    for (let i = 11; i >= 0; i--) {
      const wkStart = new Date()
      wkStart.setDate(wkStart.getDate() - wkStart.getDay() + 1 - i * 7)
      const wkEnd = new Date(wkStart)
      wkEnd.setDate(wkStart.getDate() + 6)
      const s = format(wkStart, 'yyyy-MM-dd')
      const e = format(wkEnd, 'yyyy-MM-dd')
      const weekLifts = lifts.filter(l => l.date >= s && l.date <= e)
      const tonnes = weekLifts.reduce((acc, l) => {
        const ws = (l.exercises || []).filter(ex => !(ex.warmup)).reduce((a, ex) =>
          a + (ex.sets || []).filter(s => !s.warmup).reduce((b, st) => b + (parseFloat(st.weight) || 0) * (parseInt(st.reps) || 0), 0), 0)
        return acc + ws
      }, 0)
      result.push({ week: format(wkStart, 'dd/MM'), tonnage: Math.round(tonnes / 1000 * 10) / 10 })
    }
    return result
  })()

  const liftItems = lifts.map(l => ({ ...l, _type: 'lift' }))
  const cardioItems = cardio.map(c => ({ ...c, _type: 'cardio' }))
  const allItems = [...liftItems, ...cardioItems].sort((a, b) => b.date.localeCompare(a.date))

  const filteredLifts = filter ? lifts.filter(l => l.exercises.some(ex => ex.name === filter)) : lifts

  const cutoff90 = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const chartData = lifts
    .filter(l => l.exercises.some(ex => ex.name === chartExercise) && l.date >= cutoff90)
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .map(l => {
      const ex = l.exercises.find(ex => ex.name === chartExercise)
      const best = ex?.sets?.length ? Math.max(...ex.sets.map(s => epley(s.weight, s.reps))) : 0
      return { date: l.date.slice(5), e1rm: parseFloat(best.toFixed(1)) }
    }).filter(d => d.e1rm > 0)

  return (
    <div className="space-y-4">
      {tonnageByWeek.some(w => w.tonnage > 0) && (
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Zap size={16} className="text-accent"/> Weekly Training Volume (tonnes)
          </div>
          <p className="text-xs text-muted mb-2">Total tonnage (kg × reps) per week over last 12 weeks. Trend shows progressive overload.</p>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={tonnageByWeek}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
              <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 9 }} interval={1}/>
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} width={32}/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}
                formatter={v => [`${v}t`, 'Tonnage']}/>
              <Bar dataKey="tonnage" fill="#22d3ee" radius={[3, 3, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="card-title">e1RM Trend</div>
        <select className="input mb-3" value={chartExercise} onChange={e => setChartExercise(e.target.value)}>
          {exerciseNames.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        {chartData.length > 1 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd"/>
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto','auto']} width={36}/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}/>
              <Line type="monotone" dataKey="e1rm" name="e1RM kg" stroke="#22d3ee" dot={false} strokeWidth={1.5}/>
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted">Not enough data for this exercise.</p>}
      </div>

      {(() => {
        const prs = {}
        lifts.forEach(l => {
          ;(l.exercises || []).forEach(ex => {
            ;(ex.sets || []).forEach(s => {
              const e1 = epley(s.weight, s.reps)
              if (!prs[ex.name] || e1 > prs[ex.name].e1rm) {
                prs[ex.name] = { weight: s.weight, reps: s.reps, e1rm: e1 }
              }
            })
          })
        })
        const prEntries = Object.entries(prs).sort((a, b) => b[1].e1rm - a[1].e1rm)
        if (!prEntries.length) return null
        return (
          <div className="card">
            <div className="card-title flex items-center gap-2"><Trophy size={16} className="text-warn"/> All-Time PRs</div>
            <div className="space-y-1">
              {prEntries.map(([name, pr]) => (
                <div key={name} className="flex items-center justify-between text-sm py-1 border-b border-border/20 last:border-0">
                  <span className="text-text font-medium">{name}</span>
                  <span className="text-muted text-xs">{pr.weight} kg × {pr.reps} — e1RM <span className="text-accent font-semibold">{pr.e1rm.toFixed(1)}</span></span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      <div className="card">
        <div className="card-title">All Sessions</div>
        <select className="input mb-3" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All types</option>
          {exerciseNames.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>

        {filter
          ? filteredLifts.map(l => <LiftRow key={l.id} lift={l} uid={uid} onEdit={onEditLift} expanded={expanded} setExpanded={setExpanded}/>)
          : (() => {
            if (allItems.length === 0) return <p className="text-sm text-muted">No sessions yet.</p>
            const grouped = {}
            allItems.forEach(item => {
              const month = item.date.slice(0, 7)
              if (!grouped[month]) grouped[month] = []
              grouped[month].push(item)
            })
            const months = Object.keys(grouped).sort().reverse()
            return months.map(month => (
              <div key={month} className="mb-4">
                <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
                  <span>{format(new Date(month + '-02'), 'MMMM yyyy')}</span>
                  <span className="text-muted/50">— {grouped[month].length} session{grouped[month].length !== 1 ? 's' : ''}</span>
                </div>
                {grouped[month].map(item => item._type === 'lift'
                  ? <LiftRow key={item.id} lift={item} uid={uid} onEdit={onEditLift} expanded={expanded} setExpanded={setExpanded}/>
                  : <CardioHistoryRow key={item.id} entry={item} uid={uid}/>
                )}
              </div>
            ))
          })()
        }
      </div>
    </div>
  )
}

function LiftRow({ lift, uid, onEdit, expanded, setExpanded }) {
  const allExNames = lift.exercises.map(ex => ex.name).join(', ')
  return (
    <div className="mb-2 bg-bg rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surfaceAlt transition-colors"
        onClick={() => setExpanded(p => ({ ...p, [lift.id]: !p[lift.id] }))}>
        <span className="font-medium flex items-center gap-2 text-left">
          <Dumbbell size={13} className="text-accent shrink-0"/>
          <span className="truncate max-w-[160px] md:max-w-none">{allExNames}</span>
          {lift.prs?.length > 0 && <Trophy size={13} className="text-warn"/>}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {lift.timeOfDay && <TodChip tod={lift.timeOfDay}/>}
          <span className="text-muted text-xs">{lift.date}</span>
        </div>
      </button>
      {expanded[lift.id] && (
        <div className="px-3 pb-2 space-y-2">
          {lift.exercises.map((ex, i) => (
            <div key={i}>
              <div className="text-xs font-medium text-accent mb-1">{ex.name}</div>
              {(ex.sets || []).map((s, j) => (
                <div key={j} className="text-xs text-muted flex gap-3">
                  <span>Set {j + 1}</span>
                  <span>{s.weight}kg &times; {s.reps} @ RPE {s.rpe}</span>
                  <span className="text-accent">e1RM {epley(s.weight, s.reps).toFixed(1)}</span>
                </div>
              ))}
            </div>
          ))}
          {lift.notes && <p className="text-xs text-muted italic">{lift.notes}</p>}
          <div className="flex gap-2 mt-1">
            <button onClick={() => onEdit && onEdit(lift)} className="btn-secondary py-1 text-xs flex items-center gap-1">
              <Pencil size={11}/> Edit
            </button>
            <button onClick={() => deleteEntry(uid, 'lifts', lift.id)} className="btn-danger py-1 text-xs">Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CardioHistoryRow({ entry, uid }) {
  const [exp, setExp] = useState(false)
  return (
    <div className="mb-2 bg-bg rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surfaceAlt transition-colors"
        onClick={() => setExp(p => !p)}>
        <span className="font-medium flex items-center gap-2">
          <HeartPulse size={13} className="text-success shrink-0"/>
          {entry.type}
          <span className="text-xs text-muted">{entry.durationMin} min</span>
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {entry.timeOfDay && <TodChip tod={entry.timeOfDay}/>}
          <span className="text-muted text-xs">{entry.date}</span>
        </div>
      </button>
      {exp && (
        <div className="px-3 pb-2">
          <div className="text-xs text-muted">
            {entry.distanceKm ? `${entry.distanceKm} km · ` : ''}
            {entry.avgHr ? `Avg HR ${entry.avgHr} bpm · ` : ''}
            {entry.kcal ? `${entry.kcal} kcal · ` : ''}
            {entry.rpe ? `RPE ${entry.rpe}` : ''}
          </div>
          {entry.notes && <p className="text-xs text-muted italic mt-1">{entry.notes}</p>}
          <button onClick={() => deleteEntry(uid, 'cardio', entry.id)} className="btn-danger mt-1 py-1 text-xs">Delete</button>
        </div>
      )}
    </div>
  )
}

// ── Timer ──────────────────────────────────────────────────────────────────────
function TimerTab() {
  const [duration, setDuration] = useState(90)
  const [remaining, setRemaining] = useState(90)
  const [running, setRunning] = useState(false)
  const [flash, setFlash] = useState(false)
  const interval = useRef(null)

  useEffect(() => {
    setRemaining(duration)
    setRunning(false)
  }, [duration])

  useEffect(() => {
    if (running) {
      interval.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(interval.current)
            setRunning(false)
            setFlash(true)
            setTimeout(() => setFlash(false), 2000)
            return 0
          }
          return r - 1
        })
      }, 1000)
    } else {
      clearInterval(interval.current)
    }
    return () => clearInterval(interval.current)
  }, [running])

  const pct = (remaining / duration) * 100
  const mins = Math.floor(remaining / 60).toString().padStart(2, '0')
  const secs = (remaining % 60).toString().padStart(2, '0')

  return (
    <div className="card max-w-xs mx-auto text-center">
      <div className="card-title">Rest Timer</div>
      <div className="flex gap-2 justify-center mb-6">
        {[60, 90, 120, 180].map(s => (
          <button key={s} onClick={() => setDuration(s)}
            className={duration === s ? 'btn-primary text-xs px-3' : 'btn-secondary text-xs px-3'}>
            {s}s
          </button>
        ))}
      </div>
      <div className={`text-5xl font-mono font-bold mb-6 transition-colors ${flash ? 'text-success' : 'text-accent'}`}>
        {mins}:{secs}
      </div>
      <div className="w-full bg-surfaceAlt rounded-full h-2 mb-6">
        <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${pct}%` }}/>
      </div>
      <div className="flex gap-3 justify-center">
        <button onClick={() => setRunning(r => !r)} className="btn-primary">
          {running ? <><Pause size={16}/> Pause</> : <><Play size={16}/> Start</>}
        </button>
        <button onClick={() => { setRunning(false); setRemaining(duration) }} className="btn-secondary">
          <RotateCcw size={16}/>
        </button>
      </div>
    </div>
  )
}

// ── Recovery (Muscle Heatmap + Weekly Volume) ──────────────────────────
// Evidence-based weekly volume targets per muscle group (sets/week)
const VOLUME_TARGETS = {
  Chest:       { min: 10, target: 16 },
  Back:        { min: 10, target: 18 },
  Shoulders:   { min: 8,  target: 14 },
  Biceps:      { min: 8,  target: 14 },
  Triceps:     { min: 8,  target: 14 },
  Forearms:    { min: 4,  target: 8  },
  Quads:       { min: 8,  target: 16 },
  Hamstrings:  { min: 6,  target: 12 },
  Glutes:      { min: 6,  target: 12 },
  Calves:      { min: 8,  target: 14 },
  Core:        { min: 6,  target: 10 },
}

function RecoveryTab({ uid }) {
  const { all: allExercises } = useExerciseList(uid)
  const [lifts, setLifts] = useState([])
  const [cardio, setCardio] = useState([])

  useEffect(() => {
    const u1 = subscribe(uid, 'lifts', data => setLifts(data.map(normaliseLift)), { limit: 500 })
    const u2 = subscribe(uid, 'cardio', setCardio, { limit: 100 })
    return () => { u1(); u2() }
  }, [uid])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const recovery = computeMuscleRecovery(lifts, todayStr, cardio, allExercises)

  // Weekly volume: sets per muscle group since Mon this week
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weeklyVolume = {}
  MUSCLE_REGIONS.forEach(m => { weeklyVolume[m] = 0 })

  lifts.filter(l => l.date >= weekStart).forEach(lift => {
    ;(lift.exercises || []).forEach(ex => {
      const exDef = allExercises.find(e => e.name === ex.name)
      const primaryMuscles = exDef?.primary || []
      const secondaryMuscles = exDef?.secondary || []
      const setCount = (ex.sets || []).length
      primaryMuscles.forEach(m => { if (weeklyVolume[m] !== undefined) weeklyVolume[m] += setCount })
      secondaryMuscles.forEach(m => { if (weeklyVolume[m] !== undefined) weeklyVolume[m] += Math.ceil(setCount * 0.5) })
    })
  })

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Trophy size={16} className="text-accent"/> Muscle Recovery Heatmap
        </div>
        <p className="text-xs text-muted mb-3">
          <span className="text-danger">&#9632;</span> Fatigued (today)
          <span className="ml-2 text-warn">&#9632;</span> 1d
          <span className="ml-2 text-yellow-400">&#9632;</span> 2d
          <span className="ml-2 text-success">&#9632;</span> Recovered (3-5d)
          <span className="ml-2 text-muted">&#9632;</span> Undertrained / no data
        </p>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {MUSCLE_REGIONS.map(muscle => {
            const daysAgo = recovery[muscle]
            const status = muscleStatus(daysAgo)
            const styles = MUSCLE_STATUS_STYLES[status]
            return (
              <div key={muscle} className={`rounded-xl p-3 text-center ${styles.bg}`}>
                <div className={`text-xs font-medium ${styles.text}`}>{muscle}</div>
                <div className="text-xs text-muted mt-0.5">
                  {daysAgo === null ? 'No data' : daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
                </div>
                <div className={`text-xs font-semibold mt-0.5 ${styles.text}`}>{styles.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly volume tracker */}
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Activity size={16} className="text-accent"/> Weekly Volume
        </div>
        <p className="text-xs text-muted mb-3">
          Sets per muscle this week vs evidence-based targets. Secondary muscles counted at 0.5x.
        </p>
        <div className="space-y-2">
          {MUSCLE_REGIONS.map(muscle => {
            const sets = weeklyVolume[muscle] || 0
            const tgt = VOLUME_TARGETS[muscle]
            if (!tgt) return null
            const pct = Math.min(100, (sets / tgt.target) * 100)
            const isOver = sets >= tgt.target
            const isAboveMin = sets >= tgt.min && sets < tgt.target
            const colour = isOver ? 'bg-success' : isAboveMin ? 'bg-accent' : sets > 0 ? 'bg-warn' : 'bg-surfaceAlt/50'
            return (
              <div key={muscle}>
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="text-text font-medium w-24 shrink-0">{muscle}</span>
                  <div className="flex items-center gap-2 text-muted">
                    <span className={isOver ? 'text-success font-semibold' : sets < tgt.min && sets > 0 ? 'text-warn' : ''}>
                      {sets} sets
                    </span>
                    <span className="text-muted/60">min {tgt.min} / goal {tgt.target}</span>
                  </div>
                </div>
                <div className="w-full bg-surfaceAlt rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }}/>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-muted mt-3">
          <span className="text-success">&#9632;</span> At goal
          <span className="ml-3 text-accent">&#9632;</span> Above minimum
          <span className="ml-3 text-warn">&#9632;</span> Below minimum
          <span className="ml-3 text-muted">&#9632;</span> None logged
        </p>
      </div>
    </div>
  )
}

// ── Templates ─────────────────────────────────────────────────────────────────
function TemplatesTab({ uid }) {
  const [templates, setTemplates] = useState([])
  useEffect(() => { getAll(uid, 'workoutTemplates').then(setTemplates) }, [uid])

  if (templates.length === 0) return (
    <div className="card">
      <p className="text-sm text-muted">No templates saved yet. On the Log tab, build a session then click "Save as Template".</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {templates.map(t => (
        <div key={t.id} className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-text">{t.name}</span>
            <button onClick={() => deleteEntry(uid, 'workoutTemplates', t.id)} className="btn-ghost p-1">
              <Trash2 size={14}/>
            </button>
          </div>
          {t.exercises ? (
            <div className="text-xs text-muted">
              {t.exercises.map(ex => ex.name).join(' · ')}
            </div>
          ) : (
            <div className="text-xs text-muted">{t.exercise} · {(t.sets||[]).length} sets</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function Training() {
  const { user } = useAuth()
  const uid = user?.uid
  const [tab, setTab] = useState('Workout')
  const [editLift, setEditLift] = useState(null)

  const handleEditLift = (lift) => {
    setEditLift(lift)
    setTab('Workout')
  }

  return (
    <div>
      <Tabs active={tab} set={setTab}/>
      {tab === 'Workout' && <LogTab uid={uid} initialEditLift={editLift} onEditStart={() => setEditLift(null)}/>}
      {tab === 'Cardio' && <CardioTab uid={uid}/>}
      {tab === 'Mobility' && <MobilityTab uid={uid}/>}
      {tab === 'Programs' && <ProgramsTab uid={uid}/>}
      {tab === 'Templates' && <TemplatesTab uid={uid}/>}
      {tab === 'History' && <HistoryTab uid={uid} onEditLift={handleEditLift}/>}
      {tab === 'Recovery' && <RecoveryTab uid={uid}/>}
      {tab === 'Timer' && <TimerTab/>}
    </div>
  )
}
