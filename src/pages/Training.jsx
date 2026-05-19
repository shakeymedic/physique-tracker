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
import { PROGRAMS, getProgramById, getTodayWorkout, computeWeekNumber } from '../training/programs.js'
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
function computeMilestoneProgress(milestone, lifts, weights) {
  if (!milestone) return { hit: false, progress: 0, currentKg: null, targetKg: null }

  // Non-lift milestones
  if (milestone.type === 'cardio-count') return { hit: false, progress: 0, currentKg: null, targetKg: null }
  if (milestone.type === 'mobility-streak') return { hit: false, progress: 0, currentKg: null, targetKg: null }

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
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {['Log', 'Cardio', 'Mobility', 'Programs', 'Templates', 'History', 'Recovery', 'Timer'].map(t => (
        <button
          key={t}
          onClick={() => set(t)}
          className={active === t ? 'btn-primary text-xs px-3 py-1.5' : 'btn-secondary text-xs px-3 py-1.5'}
        >{t}</button>
      ))}
    </div>
  )
}

// ── Searchable Exercise Picker ─────────────────────────────────────────────────
function AddExercisePicker({ uid, onAdd }) {
  const { all: allExercises, loading } = useExerciseList(uid)
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({
    name: '', category: 'strength', primary: '', secondary: '', notes: ''
  })
  const [addSaving, setAddSaving] = useState(false)

  const categories = ['All', 'strength', 'cardio', 'mobility', 'other', 'Custom']

  const filtered = allExercises.filter(e => {
    const matchQuery = !query.trim() || e.name.toLowerCase().includes(query.toLowerCase())
    let matchCat = true
    if (categoryFilter === 'Custom') matchCat = !!e.isCustom
    else if (categoryFilter !== 'All') matchCat = (e.category || 'strength') === categoryFilter
    return matchQuery && matchCat
  })

  const saveCustom = async () => {
    if (!addForm.name.trim() || !uid) return
    setAddSaving(true)
    try {
      const data = {
        name: addForm.name.trim(),
        category: addForm.category,
        primary: addForm.primary ? addForm.primary.split(',').map(s => s.trim()).filter(Boolean) : [],
        secondary: addForm.secondary ? addForm.secondary.split(',').map(s => s.trim()).filter(Boolean) : [],
        notes: addForm.notes,
        isMobility: addForm.category === 'mobility',
        defaultDurationSec: null,
        defaultSets: null,
      }
      await addEntry(uid, 'customExercises', data)
      // Immediately add to session
      onAdd(addForm.name.trim())
      setAddForm({ name: '', category: 'strength', primary: '', secondary: '', notes: '' })
      setShowAddForm(false)
      setQuery('')
    } finally { setAddSaving(false) }
  }

  if (loading) return <div className="text-xs text-muted mt-2">Loading exercises…</div>

  return (
    <div className="mt-2">
      {/* Search input */}
      <div className="mb-2">
        <input
          type="text"
          className="input w-full"
          placeholder="Search exercises…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoComplete="off"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
              categoryFilter === cat
                ? 'bg-accent text-bg border-accent'
                : 'bg-surfaceAlt text-muted border-border/30'
            }`}
          >{cat === 'strength' ? 'Strength' : cat === 'cardio' ? 'Cardio' : cat === 'mobility' ? 'Mobility' : cat === 'other' ? 'Other' : cat}</button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto mb-2">
        {filtered.slice(0, 40).map(ex => (
          <button
            key={ex.name}
            onClick={() => { onAdd(ex.name); setQuery('') }}
            className="btn-secondary text-xs py-1 flex items-center gap-1"
          >
            <Plus size={11}/>
            {ex.name}
            {ex.isCustom && <span className="text-accent text-[10px] font-medium ml-0.5">Custom</span>}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted py-1">No exercises found{query ? ` for "${query}"` : ''}</p>
        )}
      </div>

      {/* Add custom exercise */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-ghost text-xs flex items-center gap-1 text-accent"
        >
          <Plus size={12}/> Add custom exercise
        </button>
      ) : (
        <div className="bg-surfaceAlt rounded-xl p-3 mt-2 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-text">New custom exercise</span>
            <button onClick={() => setShowAddForm(false)} className="btn-ghost p-0.5"><X size={14}/></button>
          </div>
          <input
            type="text"
            className="input text-sm"
            placeholder="Exercise name *"
            value={addForm.name}
            onChange={e => setAddForm(p => ({ ...p, name: e.target.value }))}
          />
          <select
            className="input text-sm"
            value={addForm.category}
            onChange={e => setAddForm(p => ({ ...p, category: e.target.value }))}
          >
            <option value="strength">Strength</option>
            <option value="cardio">Cardio</option>
            <option value="mobility">Mobility</option>
            <option value="other">Other</option>
          </select>
          <input
            type="text"
            className="input text-sm"
            placeholder="Primary muscles (comma separated)"
            value={addForm.primary}
            onChange={e => setAddForm(p => ({ ...p, primary: e.target.value }))}
          />
          <input
            type="text"
            className="input text-sm"
            placeholder="Secondary muscles (optional)"
            value={addForm.secondary}
            onChange={e => setAddForm(p => ({ ...p, secondary: e.target.value }))}
          />
          <input
            type="text"
            className="input text-sm"
            placeholder="Notes (optional)"
            value={addForm.notes}
            onChange={e => setAddForm(p => ({ ...p, notes: e.target.value }))}
          />
          <div className="flex gap-2">
            <button
              onClick={saveCustom}
              className="btn-primary text-xs"
              disabled={addSaving || !addForm.name.trim()}
            >
              {addSaving ? 'Saving…' : 'Save & Add'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="btn-ghost text-xs">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Log (multi-exercise session) ──────────────────────────────────────────────
function LogTab({ uid, initialEditLift, onEditStart }) {
  const DRAFT_KEY = `pt-draft-training-${uid}`

  const emptySession = () => ({
    date: today(),
    timeOfDay: detectTimeOfDay(),
    exercises: [],
    notes: '',
  })

  const [session, setSession] = useState(emptySession)
  const [setForm, setSetForm] = useState({ weight: '', reps: '', rpe: '7' })
  const [activeExIdx, setActiveExIdx] = useState(null)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [liftsAll, setLiftsAll] = useState([])
  const [templates, setTemplates] = useState([])
  const [draftPrompt, setDraftPrompt] = useState(null)

  const draftTimer = useRef(null)

  useEffect(() => {
    getAll(uid, 'workoutTemplates').then(setTemplates)
    getAll(uid, 'lifts').then(data => setLiftsAll(data.map(normaliseLift)))

    const draft = loadDraft(DRAFT_KEY)
    if (draft && draft.data?.exercises?.length) {
      setDraftPrompt(draft)
    }
  }, [uid])

  const pendingEditRef = useRef(initialEditLift)

  const debouncedSaveDraft = useCallback((data) => {
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => saveDraft(DRAFT_KEY, data), 500)
  }, [DRAFT_KEY])

  useEffect(() => {
    if (session.exercises.length > 0) {
      debouncedSaveDraft(session)
    }
  }, [session, debouncedSaveDraft])

  const restoreDraft = () => {
    if (draftPrompt?.data) {
      setSession(draftPrompt.data)
      setDraftPrompt(null)
    }
  }

  const addExercise = (name) => {
    setSession(prev => ({
      ...prev,
      exercises: [...prev.exercises, { name, sets: [] }],
    }))
    setActiveExIdx(session.exercises.length)
  }

  const removeExercise = (idx) => {
    setSession(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== idx),
    }))
    if (activeExIdx === idx) setActiveExIdx(null)
  }

  const addSet = (exIdx) => {
    if (!setForm.weight || !setForm.reps) return
    const newSet = { weight: parseFloat(setForm.weight), reps: parseInt(setForm.reps), rpe: parseFloat(setForm.rpe) }
    setSession(prev => {
      const exercises = prev.exercises.map((ex, i) =>
        i === exIdx ? { ...ex, sets: [...ex.sets, newSet] } : ex
      )
      return { ...prev, exercises }
    })
    setSetForm(prev => ({ ...prev, weight: '', reps: '' }))
  }

  const removeSet = (exIdx, setIdx) => {
    setSession(prev => {
      const exercises = prev.exercises.map((ex, i) =>
        i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex
      )
      return { ...prev, exercises }
    })
  }

  const saveSession = async () => {
    if (!session.exercises.some(ex => ex.sets.length > 0)) return
    setSaving(true)
    try {
      const prs = []
      session.exercises.forEach(ex => {
        if (!ex.sets.length) return
        const newBest = Math.max(...ex.sets.map(s => epley(s.weight, s.reps)))
        let allTimeBest = 0
        liftsAll.forEach(l => {
          ;(l.exercises || []).filter(e => e.name === ex.name).forEach(e => {
            ;(e.sets || []).forEach(s => {
              const e1 = epley(s.weight, s.reps)
              if (e1 > allTimeBest) allTimeBest = e1
            })
          })
        })
        if (newBest > allTimeBest && allTimeBest > 0) prs.push(ex.name)
      })

      const totalTonnage = session.exercises.reduce((acc, ex) =>
        acc + ex.sets.reduce((a, s) => a + s.weight * s.reps, 0), 0
      )

      const docData = {
        date: session.date,
        timeOfDay: session.timeOfDay || null,
        exercises: session.exercises.map(ex => ({
          name: ex.name,
          sets: ex.sets,
          e1RM: ex.sets.length ? Math.max(...ex.sets.map(s => epley(s.weight, s.reps))) : 0,
          tonnage: ex.sets.reduce((a, s) => a + s.weight * s.reps, 0),
        })),
        totalTonnage,
        notes: session.notes,
        prs,
      }

      if (editId) {
        await setEntry(uid, 'lifts', editId, docData)
        setEditId(null)
      } else {
        await addEntry(uid, 'lifts', docData)
      }

      clearDraft(DRAFT_KEY)
      setSession(emptySession())
      setActiveExIdx(null)

      if (prs.length) {
        alert(`\uD83C\uDFC6 New PRs: ${prs.join(', ')}!`)
      }
    } finally { setSaving(false) }
  }

  const loadTemplate = (t) => {
    if (t.exercises) {
      setSession(prev => ({ ...prev, exercises: t.exercises.map(ex => ({ name: ex.name, sets: ex.sets || [] })) }))
    } else if (t.exercise) {
      setSession(prev => ({ ...prev, exercises: [{ name: t.exercise, sets: t.sets || [] }] }))
    }
  }

  const startEdit = (lift) => {
    const norm = normaliseLift(lift)
    setSession({
      date: norm.date,
      timeOfDay: norm.timeOfDay || null,
      exercises: norm.exercises,
      notes: norm.notes || '',
    })
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

  const cancelEdit = () => {
    setEditId(null)
    setSession(emptySession())
  }

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
          <div className="card-title">Load Template</div>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => loadTemplate(t)} className="btn-secondary text-xs">{t.name}</button>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">{editId ? 'Edit Session' : 'Log Session'}</div>
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

        {session.exercises.map((ex, exIdx) => {
          const bestE1rm = ex.sets.length ? Math.max(...ex.sets.map(s => epley(s.weight, s.reps))).toFixed(1) : null
          const tonnage = ex.sets.reduce((a, s) => a + s.weight * s.reps, 0)
          const isOpen = activeExIdx === exIdx

          return (
            <div key={exIdx} className="bg-bg rounded-xl mb-3 overflow-hidden border border-border/30">
              <div className="flex items-center justify-between px-3 py-2 bg-surfaceAlt">
                <button
                  className="flex items-center gap-2 text-sm font-medium text-text flex-1 text-left"
                  onClick={() => setActiveExIdx(isOpen ? null : exIdx)}
                >
                  <Dumbbell size={14} className="text-accent shrink-0"/>
                  {ex.name}
                  {ex.sets.length > 0 && (
                    <span className="text-xs text-muted ml-2">{ex.sets.length} sets · {tonnage.toFixed(0)} kg</span>
                  )}
                </button>
                <button onClick={() => removeExercise(exIdx)} className="btn-ghost p-1 text-danger">
                  <X size={14}/>
                </button>
              </div>

              {isOpen && (
                <div className="px-3 py-2">
                  {ex.sets.length > 0 && (
                    <div className="space-y-1 mb-3">
                      <div className="grid grid-cols-5 text-xs text-muted px-1 mb-1">
                        <span>#</span><span>kg</span><span>Reps</span><span>RPE</span><span>e1RM</span>
                      </div>
                      {ex.sets.map((s, si) => (
                        <div key={si} className="grid grid-cols-5 text-sm items-center px-1 gap-1">
                          <span className="text-muted">{si + 1}</span>
                          <span>{s.weight}</span>
                          <span>{s.reps}</span>
                          <span>{s.rpe}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-accent">{epley(s.weight, s.reps).toFixed(1)}</span>
                            <button onClick={() => removeSet(exIdx, si)} className="btn-ghost p-0.5 ml-1">
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        </div>
                      ))}
                      {bestE1rm && (
                        <div className="flex gap-4 text-xs text-muted pt-1 px-1">
                          <span>Best e1RM: <span className="text-accent">{bestE1rm} kg</span></span>
                          <span>Tonnage: <span className="text-accent">{tonnage.toFixed(0)} kg</span></span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <label className="label text-xs">Weight (kg)</label>
                      <input type="number" step="0.5" min="0" className="input text-sm" placeholder="kg"
                        value={setForm.weight} onChange={e => setSetForm(p => ({ ...p, weight: e.target.value }))}/>
                    </div>
                    <div>
                      <label className="label text-xs">Reps</label>
                      <input type="number" min="1" max="100" className="input text-sm" placeholder="reps"
                        value={setForm.reps} onChange={e => setSetForm(p => ({ ...p, reps: e.target.value }))}/>
                    </div>
                    <div>
                      <label className="label text-xs">RPE</label>
                      <select className="input text-sm" value={setForm.rpe}
                        onChange={e => setSetForm(p => ({ ...p, rpe: e.target.value }))}>
                        {RPE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={() => addSet(exIdx)} className="btn-secondary text-xs mb-2">
                    <Plus size={12}/> Add Set
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Add exercise picker */}
        <AddExercisePicker uid={uid} onAdd={addExercise}/>

        {/* Notes */}
        <div className="mt-3 mb-3">
          <label className="label">Session Notes</label>
          <div className="flex gap-2">
            <input type="text" className="input" placeholder="Optional notes"
              value={session.notes} onChange={e => setSession(p => ({ ...p, notes: e.target.value }))}/>
            <MicButton onTranscript={t => setSession(p => ({ ...p, notes: p.notes ? p.notes + ' ' + t : t }))}/>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={saveSession} className="btn-primary"
            disabled={saving || !session.exercises.some(ex => ex.sets.length > 0)}>
            {saving ? 'Saving…' : editId ? 'Update Session' : 'Save Session'}
          </button>
          {session.exercises.length > 0 && (
            <SaveTemplateButton uid={uid} session={session}/>
          )}
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
        exercises: session.exercises.map(ex => ({ name: ex.name, sets: ex.sets })),
      })
      setName(''); setOpen(false)
    } finally { setSaving(false) }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="btn-secondary">Save as Template</button>
  return (
    <div className="flex gap-2 items-center">
      <input className="input w-32" placeholder="Template name" value={name} onChange={e => setName(e.target.value)}/>
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
              value={form.distanceKm} onChange={e => setForm(p => ({ ...p, distanceKm: e.target.value }))}/>
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
              value={form.rpe} onChange={e => setForm(p => ({ ...p, rpe: e.target.value }))}/>
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

// ── Mobility Tab ──────────────────────────────────────────────────────────────
function MobilityTab({ uid }) {
  const [activeTimer, setActiveTimer] = useState(null)
  const [mobilityLogs, setMobilityLogs] = useState([])
  const [customRoutines, setCustomRoutines] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  useEffect(() => {
    subscribe(uid, 'mobilityLog', setMobilityLogs, { limit: 50 })
    getAll(uid, 'customRoutines').then(setCustomRoutines)
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
        <div className="card-title flex items-center gap-2">
          <Activity size={16} className="text-accent"/> Mobility Routines
        </div>
        <p className="text-xs text-muted mb-3">
          Start a routine — the timer will guide you through each stretch automatically.
        </p>
        <div className="space-y-3">
          {allRoutines.map(r => (
            <div key={r.id} className="bg-surfaceAlt rounded-xl p-3">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <span className="font-medium text-text text-sm">{r.name}</span>
                  {r.id && !ROUTINES.find(br => br.id === r.id) && (
                    <span className="text-accent text-xs ml-2">Custom</span>
                  )}
                </div>
                <button
                  onClick={() => setActiveTimer(r)}
                  className="btn-primary text-xs flex items-center gap-1 ml-2 shrink-0"
                >
                  <Play size={12}/> Start
                </button>
              </div>
              <p className="text-xs text-muted mb-1">{r.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted">
                <span><Timer size={11} className="inline mr-0.5"/>{r.durationMin} min</span>
                <span>{r.stretches?.length} stretches</span>
              </div>
            </div>
          ))}
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

// ── Programs Tab ──────────────────────────────────────────────────────────────
function ProgramsTab({ uid }) {
  const [settings, setSettings] = useState({})
  const [lifts, setLifts] = useState([])
  const [weights, setWeights] = useState([])
  const [cardioLogs, setCardioLogs] = useState([])
  const [mobilityLogs, setMobilityLogs] = useState([])
  const [customPrograms, setCustomPrograms] = useState([])
  const [viewProgram, setViewProgram] = useState(null)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings(uid).then(setSettings)
    subscribe(uid, 'lifts', data => setLifts(data.map(normaliseLift)), { limit: 500 })
    subscribe(uid, 'weights', setWeights, { limit: 90 })
    subscribe(uid, 'cardio', setCardioLogs, { limit: 200 })
    subscribe(uid, 'mobilityLog', setMobilityLogs, { limit: 200 })
    getAll(uid, 'customPrograms').then(setCustomPrograms)
  }, [uid])

  const activeProgram = settings.activeProgram || null
  const activeProgramDef = activeProgram ? getProgramById(activeProgram.id) : null

  const startProgram = async (program, startDate) => {
    setSaving(true)
    try {
      const newActive = {
        id: program.id,
        startDate: startDate || format(new Date(), 'yyyy-MM-dd'),
        weekNumber: 1,
        customisations: {},
        completedSessions: {},
        customMilestones: [],
      }
      await saveSettings(uid, { activeProgram: newActive })
      setSettings(prev => ({ ...prev, activeProgram: newActive }))
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

  const allPrograms = [...PROGRAMS, ...customPrograms]

  // ── Active program dashboard ──
  if (activeProgram && activeProgramDef) {
    const weekNum = computeWeekNumber(activeProgram)
    const totalWeeks = activeProgramDef.durationWeeks
    const todayWorkoutKey = getTodayWorkout(activeProgramDef, activeProgram)
    const todayWorkout = todayWorkoutKey !== 'rest'
      ? (activeProgramDef.workouts?.[todayWorkoutKey] || null)
      : null
    const pct = Math.round((weekNum / totalWeeks) * 100)

    // Week dot indicators (Mon–Sun)
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
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
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              activeProgramDef.difficulty === 'beginner' ? 'chip-ok' : 'bg-warn/20 text-warn'
            }`}>{activeProgramDef.difficulty}</span>
          </div>
          {/* Progress bar */}
          <div className="mb-2">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>Progress</span><span>{pct}%</span>
            </div>
            <div className="w-full bg-surfaceAlt rounded-full h-2">
              <div className="bg-accent h-2 rounded-full transition-all" style={{ width: `${pct}%` }}/>
            </div>
          </div>
        </div>

        {/* Today's workout panel */}
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Dumbbell size={16} className="text-accent"/>
            Today
          </div>
          {todayWorkoutKey === 'rest' ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-2">😴</div>
              <div className="text-base font-semibold text-text">Rest Day</div>
              <p className="text-xs text-muted mt-1">Recovery is progress. Eat well, sleep well.</p>
            </div>
          ) : todayWorkout?.type === 'cardio' ? (
            <div>
              <div className="text-base font-semibold text-text mb-1">{todayWorkout.name}</div>
              <p className="text-sm text-muted mb-3">{todayWorkout.description}</p>
              <div className="text-xs text-muted">Target: {todayWorkout.durationMin} min</div>
            </div>
          ) : todayWorkout?.type === 'mobility' ? (
            <div>
              <div className="text-base font-semibold text-text mb-1">{todayWorkout.name}</div>
              <p className="text-sm text-muted">{todayWorkout.description}</p>
            </div>
          ) : todayWorkout ? (
            <div>
              <div className="text-base font-semibold text-text mb-2">{todayWorkout.name}</div>
              <div className="space-y-1 mb-3">
                {(todayWorkout.exercises || []).map((ex, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Dumbbell size={12} className="text-accent shrink-0"/>
                    <span className="text-text">{ex.name}</span>
                    <span className="text-muted text-xs">
                      {ex.sets}&times;{ex.reps}
                      {ex.notes ? ` — ${ex.notes}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No workout scheduled today.</p>
          )}
        </div>

        {/* This week */}
        <div className="card">
          <div className="card-title">This Week</div>
          <div className="flex gap-2 items-center">
            {dayNames.map((d, i) => {
              const date = format(new Date(new Date().setDate(new Date().getDate() - ((new Date().getDay() + 6) % 7) + i)), 'yyyy-MM-dd')
              const done = liftDays.has(date)
              const isToday = date === format(new Date(), 'yyyy-MM-dd')
              return (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                    ${done ? 'bg-success text-bg' : isToday ? 'border-2 border-accent text-accent' : 'bg-surfaceAlt text-muted'}`}>
                    {d}
                  </div>
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
              const { hit, progress, currentKg, targetKg } = computeMilestoneProgress(m, lifts, weights)
              return (
                <MilestoneRow
                  key={m.id}
                  milestone={m}
                  progress={progress}
                  hit={hit}
                  currentKg={currentKg}
                  targetKg={targetKg}
                />
              )
            })}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={exitProgram} className="btn-danger text-xs" disabled={saving}>
            {saving ? 'Saving…' : 'Exit program'}
          </button>
        </div>
      </div>
    )
  }

  // ── Program detail view ──
  if (viewProgram) {
    return (
      <div className="space-y-4">
        <button onClick={() => setViewProgram(null)} className="btn-ghost text-xs flex items-center gap-1">
          <ChevronDown size={14} className="rotate-90"/> Back to programs
        </button>
        <div className="card">
          <div className="text-xl font-bold text-text mb-1">{viewProgram.name}</div>
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

          {/* Workouts */}
          {viewProgram.workouts && (
            <div className="mb-4">
              <div className="text-sm font-semibold text-text mb-2">Workouts</div>
              {Object.entries(viewProgram.workouts).map(([key, w]) => (
                <div key={key} className="bg-surfaceAlt rounded-xl p-3 mb-2">
                  <div className="text-sm font-medium text-text mb-1">{w.name}</div>
                  {w.exercises?.map((ex, i) => (
                    <div key={i} className="text-xs text-muted flex gap-2 py-0.5">
                      <Dumbbell size={11} className="text-accent shrink-0 mt-0.5"/>
                      <span>{ex.name} — {ex.sets}&times;{ex.reps}{ex.notes ? ` (${ex.notes})` : ''}</span>
                    </div>
                  ))}
                  {w.description && <p className="text-xs text-muted mt-1 italic">{w.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Milestones */}
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

          {/* Start form */}
          <div className="flex gap-3 items-end flex-wrap mt-4">
            <div>
              <label className="label text-xs">Start date</label>
              <input type="date" className="input" value={startDate}
                onChange={e => setStartDate(e.target.value)}/>
            </div>
            <button
              onClick={() => startProgram(viewProgram, startDate)}
              className="btn-primary flex items-center gap-1"
              disabled={saving}
            >
              <Play size={14}/> {saving ? 'Starting…' : 'Start program'}
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
        <div className="card-title flex items-center gap-2">
          <Zap size={16} className="text-accent"/> Workout Programs
        </div>
        <p className="text-sm text-muted">Choose a program to follow. You can only have one active program at a time.</p>
      </div>
      {allPrograms.map(p => (
        <ProgramCard
          key={p.id}
          program={p}
          onView={setViewProgram}
          onStart={(prog) => startProgram(prog, format(new Date(), 'yyyy-MM-dd'))}
        />
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

      <div className="card">
        <div className="card-title">All Sessions</div>
        <select className="input mb-3" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All types</option>
          {exerciseNames.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>

        {filter
          ? filteredLifts.map(l => <LiftRow key={l.id} lift={l} uid={uid} onEdit={onEditLift} expanded={expanded} setExpanded={setExpanded}/>)
          : allItems.map(item => item._type === 'lift'
            ? <LiftRow key={item.id} lift={item} uid={uid} onEdit={onEditLift} expanded={expanded} setExpanded={setExpanded}/>
            : <CardioHistoryRow key={item.id} entry={item} uid={uid}/>
          )
        }
        {allItems.length === 0 && <p className="text-sm text-muted">No sessions yet.</p>}
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

// ── Recovery (Muscle Heatmap) ──────────────────────────────────────────────────
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

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Trophy size={16} className="text-accent"/> Muscle Recovery Heatmap
        </div>
        <p className="text-xs text-muted mb-3">
          <span className="text-danger">■</span> Fatigued (today)
          <span className="ml-2 text-warn">■</span> 1d
          <span className="ml-2 text-yellow-400">■</span> 2d
          <span className="ml-2 text-success">■</span> Recovered (3-5d)
          <span className="ml-2 text-muted">■</span> Undertrained / no data
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
  const [tab, setTab] = useState('Log')
  const [editLift, setEditLift] = useState(null)

  const handleEditLift = (lift) => {
    setEditLift(lift)
    setTab('Log')
  }

  return (
    <div>
      <Tabs active={tab} set={setTab}/>
      {tab === 'Log' && <LogTab uid={uid} initialEditLift={editLift} onEditStart={() => setEditLift(null)}/>}
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
