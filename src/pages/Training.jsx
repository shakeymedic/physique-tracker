import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, deleteEntry, getAll } from '../data.js'
import { format, subDays } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Plus, Trash2, Timer as TimerIcon, Play, Pause, RotateCcw } from 'lucide-react'

const EXERCISES = [
  'Bench Press','Squat','Deadlift','Overhead Press','Barbell Row','Pull-Up',
  'Romanian Deadlift','Front Squat','Incline Bench','Dumbbell Bench','Lat Pulldown',
  'Bicep Curl','Tricep Extension','Leg Press','Leg Curl','Leg Extension',
  'Calf Raise','Lateral Raise','Face Pull','Hip Thrust','Dip','Push-Up',
]

const RPE_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]
const today = () => format(new Date(), 'yyyy-MM-dd')
const epley = (w, r) => parseFloat(w) * (1 + parseFloat(r) / 30)

function Tabs({ active, set }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {['Log','Templates','History','Timer'].map(t => (
        <button key={t} onClick={() => set(t)} className={active === t ? 'btn-primary' : 'btn-secondary'}>{t}</button>
      ))}
    </div>
  )
}

// ── Log ───────────────────────────────────────────────────────────────────────
function LogTab({ uid }) {
  const [exercise, setExercise] = useState(EXERCISES[0])
  const [sets, setSets] = useState([])
  const [setForm, setSetForm] = useState({ weight: '', reps: '', rpe: '7' })
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState([])

  useEffect(() => { getAll(uid, 'workoutTemplates').then(setTemplates) }, [uid])

  const addSet = () => {
    if (!setForm.weight || !setForm.reps) return
    setSets(prev => [...prev, { weight: parseFloat(setForm.weight), reps: parseInt(setForm.reps), rpe: parseFloat(setForm.rpe) }])
    setSetForm(prev => ({ ...prev, weight: '', reps: '' }))
  }

  const saveSession = async () => {
    if (!sets.length) return
    setSaving(true)
    try {
      await addEntry(uid, 'lifts', { date, exercise, sets, notes })
      setSets([])
      setNotes('')
    } finally { setSaving(false) }
  }

  const loadTemplate = (t) => {
    setExercise(t.exercise || EXERCISES[0])
    setSets(t.sets || [])
  }

  const bestE1rm = sets.length ? Math.max(...sets.map(s => epley(s.weight, s.reps))).toFixed(1) : null
  const tonnage = sets.reduce((a, s) => a + s.weight * s.reps, 0)

  return (
    <div className="space-y-4">
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
        <div className="card-title">Log Session</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)}/>
          </div>
          <div>
            <label className="label">Exercise</label>
            <select className="input" value={exercise} onChange={e => setExercise(e.target.value)}>
              {EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2">
          <div>
            <label className="label">Weight (kg)</label>
            <input type="number" step="0.5" min="0" className="input" placeholder="kg"
              value={setForm.weight} onChange={e => setSetForm(p => ({ ...p, weight: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Reps</label>
            <input type="number" min="1" max="100" className="input" placeholder="reps"
              value={setForm.reps} onChange={e => setSetForm(p => ({ ...p, reps: e.target.value }))}/>
          </div>
          <div>
            <label className="label">RPE</label>
            <select className="input" value={setForm.rpe} onChange={e => setSetForm(p => ({ ...p, rpe: e.target.value }))}>
              {RPE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <button onClick={addSet} className="btn-secondary mb-4"><Plus size={14}/>Add Set</button>

        {sets.length > 0 && (
          <div className="space-y-1 mb-4">
            <div className="grid grid-cols-4 text-xs text-muted px-2 mb-1">
              <span>#</span><span>kg</span><span>Reps</span><span>RPE / e1RM</span>
            </div>
            {sets.map((s, i) => (
              <div key={i} className="grid grid-cols-4 bg-bg rounded-lg px-2 py-1.5 text-sm items-center">
                <span className="text-muted">{i + 1}</span>
                <span>{s.weight}</span>
                <span>{s.reps}</span>
                <span className="text-accent">{epley(s.weight, s.reps).toFixed(1)} kg</span>
                <button onClick={() => setSets(prev => prev.filter((_, j) => j !== i))}
                  className="btn-ghost p-1 col-start-5 col-span-1 justify-self-end" title="Remove">
                  <Trash2 size={12}/>
                </button>
              </div>
            ))}
            <div className="flex gap-4 text-xs text-muted pt-1 px-2">
              <span>Best e1RM: <span className="text-accent">{bestE1rm} kg</span></span>
              <span>Tonnage: <span className="text-accent">{tonnage.toFixed(0)} kg</span></span>
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="label">Notes</label>
          <input type="text" className="input" placeholder="Optional notes"
            value={notes} onChange={e => setNotes(e.target.value)}/>
        </div>

        <div className="flex gap-2">
          <button onClick={saveSession} className="btn-primary" disabled={saving || !sets.length}>
            {saving ? 'Saving…' : 'Save Session'}
          </button>
          {sets.length > 0 && (
            <SaveTemplateButton uid={uid} exercise={exercise} sets={sets}/>
          )}
        </div>
      </div>
    </div>
  )
}

function SaveTemplateButton({ uid, exercise, sets }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const save = async () => {
    if (!name) return
    setSaving(true)
    try {
      await addEntry(uid, 'workoutTemplates', { name, exercise, sets })
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

// ── History ───────────────────────────────────────────────────────────────────
function HistoryTab({ uid }) {
  const [lifts, setLifts] = useState([])
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState({})
  const [chartExercise, setChartExercise] = useState(EXERCISES[0])

  useEffect(() => subscribe(uid, 'lifts', setLifts, { limit: 500 }), [uid])

  const displayed = filter ? lifts.filter(l => l.exercise === filter) : lifts
  const cutoff90 = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const chartData = lifts
    .filter(l => l.exercise === chartExercise && l.date >= cutoff90)
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .map(l => {
      const best = Math.max(...(l.sets || []).map(s => epley(s.weight, s.reps)))
      return { date: l.date.slice(5), e1rm: parseFloat(best.toFixed(1)) }
    })

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
        <div className="card-title">Sessions</div>
        <select className="input mb-3" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All exercises</option>
          {EXERCISES.map(ex => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted">No sessions yet.</p>
        ) : displayed.map(l => (
          <div key={l.id} className="mb-2 bg-bg rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-surfaceAlt transition-colors"
              onClick={() => setExpanded(p => ({ ...p, [l.id]: !p[l.id] }))}>
              <span className="font-medium">{l.exercise}</span>
              <span className="text-muted">{l.date}</span>
            </button>
            {expanded[l.id] && (
              <div className="px-3 pb-2 space-y-1">
                {(l.sets || []).map((s, i) => (
                  <div key={i} className="text-xs text-muted flex gap-3">
                    <span>Set {i + 1}</span>
                    <span>{s.weight}kg × {s.reps} @ RPE {s.rpe}</span>
                    <span className="text-accent">e1RM {epley(s.weight, s.reps).toFixed(1)}</span>
                  </div>
                ))}
                {l.notes && <p className="text-xs text-muted italic">{l.notes}</p>}
                <button onClick={() => deleteEntry(uid, 'lifts', l.id)} className="btn-danger mt-1 py-1 text-xs">Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Timer ─────────────────────────────────────────────────────────────────────
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

export default function Training() {
  const { user } = useAuth()
  const uid = user?.uid
  const [tab, setTab] = useState('Log')
  return (
    <div>
      <Tabs active={tab} set={setTab}/>
      {tab === 'Log' && <LogTab uid={uid}/>}
      {tab === 'Templates' && <TemplatesTab uid={uid}/>}
      {tab === 'History' && <HistoryTab uid={uid}/>}
      {tab === 'Timer' && <TimerTab/>}
    </div>
  )
}

function TemplatesTab({ uid }) {
  const [templates, setTemplates] = useState([])
  useEffect(() => {
    getAll(uid, 'workoutTemplates').then(setTemplates)
  }, [uid])
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
            <span className="text-xs text-muted">{t.exercise}</span>
            <button onClick={() => deleteEntry(uid, 'workoutTemplates', t.id)} className="btn-ghost p-1">
              <Trash2 size={14}/>
            </button>
          </div>
          <div className="text-xs text-muted">{(t.sets||[]).length} sets saved</div>
        </div>
      ))}
    </div>
  )
}
