import { useEffect, useState, useRef, useCallback } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, deleteEntry, getAll } from '../data.js'
import { format, subDays, startOfWeek } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Plus, Trash2, Play, Pause, RotateCcw, Trophy, Pencil, HeartPulse, Dumbbell, X } from 'lucide-react'
import MicButton from '../components/MicButton.jsx'
import EditableRow from '../components/EditableRow.jsx'
import { EXERCISES as EX_LIST, CARDIO_TYPES, computeMuscleRecovery, muscleStatus, MUSCLE_REGIONS, MUSCLE_STATUS_STYLES } from '../training/exercises.js'
import { TodChip, TodSelect, detectTimeOfDay } from '../lib/timeOfDay.jsx'
import { saveDraft, loadDraft, clearDraft, draftAgo } from '../lib/draft.js'

const EXERCISES = EX_LIST.map(e => e.name)
const RPE_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const today = () => format(new Date(), 'yyyy-MM-dd')
const epley = (w, r) => parseFloat(w) * (1 + parseFloat(r) / 30)

// Normalise a lift doc to the new multi-exercise shape
function normaliseLift(lift) {
  if (lift.exercises && Array.isArray(lift.exercises)) return lift
  if (lift.exercise) {
    return {
      ...lift,
      exercises: [{ name: lift.exercise, sets: lift.sets || [] }],
    }
  }
  return { ...lift, exercises: [] }
}

function Tabs({ active, set }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {['Log', 'Cardio', 'Templates', 'History', 'Recovery', 'Timer'].map(t => (
        <button key={t} onClick={() => set(t)} className={active === t ? 'btn-primary' : 'btn-secondary'}>{t}</button>
      ))}
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
  const [activeExIdx, setActiveExIdx] = useState(null) // which exercise card is open for set input
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null) // existing doc id if editing
  const [liftsAll, setLiftsAll] = useState([])
  const [templates, setTemplates] = useState([])
  const [draftPrompt, setDraftPrompt] = useState(null)

  const draftTimer = useRef(null)

  useEffect(() => {
    getAll(uid, 'workoutTemplates').then(setTemplates)
    getAll(uid, 'lifts').then(data => setLiftsAll(data.map(normaliseLift)))

    // Check for draft
    const draft = loadDraft(DRAFT_KEY)
    if (draft && draft.data?.exercises?.length) {
      setDraftPrompt(draft)
    }
  }, [uid])

  // pendingEditRef used below after startEdit is defined
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
    setActiveExIdx(session.exercises.length) // open the new card
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
      // PR detection per exercise
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
        alert(`🏆 New PRs: ${prs.join(', ')}!`)
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

  // Handle incoming edit request from History tab
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

        {/* Exercise cards */}
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
        <AddExercisePicker onAdd={addExercise}/>

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

function AddExercisePicker({ onAdd }) {
  const [query, setQuery] = useState('')
  const filtered = query.trim()
    ? EXERCISES.filter(e => e.toLowerCase().includes(query.toLowerCase()))
    : EXERCISES

  return (
    <div className="mt-2">
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          className="input"
          placeholder="Search exercise…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
        {filtered.slice(0, 30).map(ex => (
          <button
            key={ex}
            onClick={() => { onAdd(ex); setQuery('') }}
            className="btn-secondary text-xs py-1"
          >
            <Plus size={11}/> {ex}
          </button>
        ))}
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

      {/* History */}
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

// ── History ────────────────────────────────────────────────────────────────────
function HistoryTab({ uid, onEditLift }) {
  const [lifts, setLifts] = useState([])
  const [cardio, setCardio] = useState([])
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState({})
  const [chartExercise, setChartExercise] = useState(EXERCISES[0])

  useEffect(() => {
    const u1 = subscribe(uid, 'lifts', data => setLifts(data.map(normaliseLift)), { limit: 500 })
    const u2 = subscribe(uid, 'cardio', setCardio, { limit: 100 })
    return () => { u1(); u2() }
  }, [uid])

  // Merge lifts + cardio, sorted by date desc
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
          {EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
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
          {EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
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
  const totalSets = lift.exercises.reduce((a, ex) => a + ex.sets.length, 0)
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
                  <span>{s.weight}kg × {s.reps} @ RPE {s.rpe}</span>
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
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="mb-2 bg-bg rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surfaceAlt transition-colors"
        onClick={() => setExpanded(p => !p)}>
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
      {expanded && (
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
  const [lifts, setLifts] = useState([])
  const [cardio, setCardio] = useState([])

  useEffect(() => {
    const u1 = subscribe(uid, 'lifts', data => setLifts(data.map(normaliseLift)), { limit: 500 })
    const u2 = subscribe(uid, 'cardio', setCardio, { limit: 100 })
    return () => { u1(); u2() }
  }, [uid])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const recovery = computeMuscleRecovery(lifts, todayStr, cardio)

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
      {tab === 'Templates' && <TemplatesTab uid={uid}/>}
      {tab === 'History' && <HistoryTab uid={uid} onEditLift={handleEditLift}/>}
      {tab === 'Recovery' && <RecoveryTab uid={uid}/>}
      {tab === 'Timer' && <TimerTab/>}
    </div>
  )
}
