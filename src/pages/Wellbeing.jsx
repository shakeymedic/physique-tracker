import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, deleteEntry, getSettings } from '../data.js'
import { format, startOfWeek } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Heart, Smile, Activity } from 'lucide-react'
import MoodPicker from '../components/MoodPicker.jsx'
import EditableRow from '../components/EditableRow.jsx'
import { TodChip, TodSelect, detectTimeOfDay } from '../lib/timeOfDay.jsx'
import { saveDraft, loadDraft, clearDraft, draftAgo } from '../lib/draft.js'

const today = () => format(new Date(), 'yyyy-MM-dd')

const PRESET_SYMPTOMS = [
  'Nausea', 'Headache', 'Fatigue', 'Insomnia', 'Anxiety', 'Low mood',
  'Heartburn', 'Dizziness', 'Joint pain', 'GI upset', 'Brain fog',
  'Bloating', 'Cravings', 'Hunger', 'Other',
]

const SELF_CARE_CATEGORIES = [
  'skincare', 'walk', 'meditation', 'stretching', 'reading',
  'sauna', 'massage', 'social', 'hobby', 'sleep-priority', 'other',
]

function WellbeingTabs({ active, set }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {['Log', 'Trends', 'Self-Care'].map(t => (
        <button key={t} onClick={() => set(t)} className={active === t ? 'btn-primary' : 'btn-secondary'}>{t}</button>
      ))}
    </div>
  )
}

// ── Wellbeing Log Tab ──────────────────────────────────────────────────────────
function LogTab({ uid }) {
  const DRAFT_KEY = `pt-draft-wellbeing-${uid}`

  const emptyForm = () => ({
    date: today(),
    timeOfDay: detectTimeOfDay(),
    mood: null,
    energy: null,
    sleep: null,
    stress: null,
    symptoms: [],
    notes: '',
  })

  const [form, setForm] = useState(emptyForm)
  const [entries, setEntries] = useState([])
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [draftPrompt, setDraftPrompt] = useState(null)
  const draftTimer = useRef(null)

  useEffect(() => {
    const unsub = subscribe(uid, 'wellbeing', setEntries, { limit: 90 })
    const draft = loadDraft(DRAFT_KEY)
    if (draft?.data?.mood || draft?.data?.symptoms?.length) setDraftPrompt(draft)
    return unsub
  }, [uid])

  useEffect(() => {
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      if (form.mood !== null || form.symptoms.length > 0 || form.notes) {
        saveDraft(DRAFT_KEY, form)
      }
    }, 500)
  }, [form])

  const toggleSymptom = (s) => {
    setForm(p => ({
      ...p,
      symptoms: p.symptoms.includes(s) ? p.symptoms.filter(x => x !== s) : [...p.symptoms, s]
    }))
  }

  const save = async () => {
    if (form.mood === null) return
    setSaving(true)
    try {
      const data = {
        date: form.date,
        timeOfDay: form.timeOfDay || null,
        mood: form.mood,
        energy: form.energy || null,
        sleep: form.sleep || null,
        stress: form.stress || null,
        symptoms: form.symptoms,
        notes: form.notes,
      }
      if (editId) {
        await setEntry(uid, 'wellbeing', editId, data)
        setEditId(null)
      } else {
        await addEntry(uid, 'wellbeing', data)
      }
      clearDraft(DRAFT_KEY)
      setForm(emptyForm())
    } finally { setSaving(false) }
  }

  const startEdit = (entry) => {
    setForm({
      date: entry.date,
      timeOfDay: entry.timeOfDay || null,
      mood: entry.mood || null,
      energy: entry.energy || null,
      sleep: entry.sleep || null,
      stress: entry.stress || null,
      symptoms: entry.symptoms || [],
      notes: entry.notes || '',
    })
    setEditId(entry.id)
  }

  const cancelEdit = () => { setEditId(null); setForm(emptyForm()) }

  const METRIC_LABELS = [
    { key: 'mood', label: 'Mood' },
    { key: 'energy', label: 'Energy' },
    { key: 'sleep', label: 'Sleep Quality' },
    { key: 'stress', label: 'Stress Level' },
  ]

  return (
    <div className="space-y-4">
      {draftPrompt && (
        <div className="card border-accent/30 bg-accent/5">
          <div className="flex items-center justify-between">
            <p className="text-sm">Unsaved wellbeing entry from <span className="text-accent">{draftAgo(draftPrompt.at)}</span> — restore?</p>
            <div className="flex gap-2">
              <button onClick={() => { setForm(draftPrompt.data); setDraftPrompt(null) }} className="btn-primary text-xs">Restore</button>
              <button onClick={() => { clearDraft(DRAFT_KEY); setDraftPrompt(null) }} className="btn-ghost text-xs">Discard</button>
            </div>
          </div>
        </div>
      )}

      {editId && (
        <div className="card border-warn/30 bg-warn/5">
          <p className="text-sm text-warn">Editing entry. <button onClick={cancelEdit} className="underline">Cancel</button></p>
        </div>
      )}

      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Smile size={16} className="text-accent"/> {editId ? 'Edit Wellbeing Entry' : 'Log Wellbeing'}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Time of day</label>
            <TodSelect value={form.timeOfDay} onChange={v => setForm(p => ({ ...p, timeOfDay: v }))}/>
          </div>
        </div>

        {METRIC_LABELS.map(({ key, label }) => (
          <div key={key} className="mb-4">
            <MoodPicker label={label} value={form[key]} onChange={v => setForm(p => ({ ...p, [key]: v }))}/>
          </div>
        ))}

        <div className="mb-4">
          <div className="label mb-2">Symptoms (tap to select)</div>
          <div className="flex flex-wrap gap-2">
            {PRESET_SYMPTOMS.map(s => (
              <button key={s} type="button" onClick={() => toggleSymptom(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  form.symptoms.includes(s)
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'bg-surfaceAlt border-border/40 text-muted hover:text-text'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="label">Notes</label>
          <input type="text" className="input" placeholder="Optional notes"
            value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
        </div>

        <div className="flex gap-2">
          <button onClick={save} className="btn-primary" disabled={saving || form.mood === null}>
            {saving ? 'Saving…' : editId ? 'Update' : 'Save'}
          </button>
          {editId && <button onClick={cancelEdit} className="btn-secondary">Cancel</button>}
        </div>
      </div>

      {/* History */}
      <div className="card">
        <div className="card-title">Recent Entries</div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No wellbeing entries yet.</p>
        ) : entries.slice(0, 30).map(e => (
          <EditableRow key={e.id}
            onEdit={() => startEdit(e)}
            onDelete={() => deleteEntry(uid, 'wellbeing', e.id)}
            className="mb-2"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">{e.date}</span>
                <TodChip tod={e.timeOfDay}/>
                {e.mood && <span className="text-xs">Mood: {['😞','😐','🙂','😊','🤩'][e.mood - 1]}</span>}
                {e.energy && <span className="text-xs text-muted">Energy: {e.energy}/5</span>}
              </div>
              {e.symptoms?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {e.symptoms.map(s => <span key={s} className="text-xs bg-warn/20 text-warn rounded-full px-1.5 py-0.5">{s}</span>)}
                </div>
              )}
              {e.notes && <p className="text-xs text-muted italic mt-0.5">{e.notes}</p>}
            </div>
          </EditableRow>
        ))}
      </div>
    </div>
  )
}

// ── Trends Tab ────────────────────────────────────────────────────────────────
function TrendsTab({ uid }) {
  const [entries, setEntries] = useState([])
  const [range, setRange] = useState(30)
  const [metric, setMetric] = useState('mood')

  useEffect(() => subscribe(uid, 'wellbeing', setEntries, { limit: 200 }), [uid])

  const sorted = entries
    .filter(e => e[metric] != null)
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .slice(-range)
    .map(e => ({ date: e.date.slice(5), value: e[metric] }))

  const METRICS = ['mood', 'energy', 'sleep', 'stress']
  const LABELS = { mood: 'Mood', energy: 'Energy', sleep: 'Sleep', stress: 'Stress' }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Wellbeing Trends</div>
        <div className="flex gap-2 mb-3 flex-wrap">
          {METRICS.map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={metric === m ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>{LABELS[m]}</button>
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          {[30, 60, 90].map(d => (
            <button key={d} onClick={() => setRange(d)}
              className={range === d ? 'btn-primary text-xs' : 'btn-secondary text-xs'}>{d}d</button>
          ))}
        </div>
        {sorted.length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={sorted}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd"/>
              <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fill: '#94a3b8', fontSize: 10 }} width={20}/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}
                formatter={(v) => [['😞','😐','🙂','😊','🤩'][v - 1] + ' ' + v, LABELS[metric]]}/>
              <Line type="monotone" dataKey="value" stroke="#22d3ee" dot={{ r: 3, fill: '#22d3ee' }} strokeWidth={2}/>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted">Log at least 2 entries to see a trend.</p>
        )}
      </div>

      {/* Symptom timeline */}
      <div className="card">
        <div className="card-title">Symptom Timeline</div>
        {entries.filter(e => e.symptoms?.length).length === 0 ? (
          <p className="text-sm text-muted">No symptoms logged yet.</p>
        ) : entries.filter(e => e.symptoms?.length).slice(0, 20).map(e => (
          <div key={e.id} className="flex items-start gap-3 mb-2 text-sm">
            <span className="text-muted text-xs shrink-0 mt-0.5">{e.date}</span>
            <div className="flex flex-wrap gap-1">
              {e.symptoms.map(s => (
                <span key={s} className="text-xs bg-warn/20 text-warn rounded-full px-2 py-0.5">{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Self-Care Tab ──────────────────────────────────────────────────────────────
function SelfCareTab({ uid }) {
  const DRAFT_KEY = `pt-draft-selfcare-${uid}`

  const emptyForm = () => ({
    date: today(),
    timeOfDay: detectTimeOfDay(),
    category: 'walk',
    durationMin: '',
    notes: '',
  })

  const [form, setForm] = useState(emptyForm)
  const [entries, setEntries] = useState([])
  const [settings, setSettings] = useState({})
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [draftPrompt, setDraftPrompt] = useState(null)
  const draftTimer = useRef(null)

  useEffect(() => {
    const unsub = subscribe(uid, 'selfCareLog', setEntries, { limit: 100 })
    getSettings(uid).then(setSettings)
    const draft = loadDraft(DRAFT_KEY)
    if (draft?.data?.category) setDraftPrompt(draft)
    return unsub
  }, [uid])

  useEffect(() => {
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      if (form.category) saveDraft(DRAFT_KEY, form)
    }, 500)
  }, [form])

  const categories = settings.selfCareCategories || SELF_CARE_CATEGORIES
  const weekGoal = settings.activityGoals?.selfCarePerWeek || 5

  const thisWeekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const thisWeekCount = entries.filter(e => e.date >= thisWeekStart).length

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        date: form.date,
        timeOfDay: form.timeOfDay || null,
        category: form.category,
        durationMin: form.durationMin ? parseFloat(form.durationMin) : null,
        notes: form.notes,
      }
      if (editId) {
        await setEntry(uid, 'selfCareLog', editId, data)
        setEditId(null)
      } else {
        await addEntry(uid, 'selfCareLog', data)
      }
      clearDraft(DRAFT_KEY)
      setForm(emptyForm())
    } finally { setSaving(false) }
  }

  const startEdit = (entry) => {
    setForm({
      date: entry.date,
      timeOfDay: entry.timeOfDay || null,
      category: entry.category || 'walk',
      durationMin: String(entry.durationMin || ''),
      notes: entry.notes || '',
    })
    setEditId(entry.id)
  }

  const cancelEdit = () => { setEditId(null); setForm(emptyForm()) }

  const quickLog = async (cat) => {
    await addEntry(uid, 'selfCareLog', {
      date: today(),
      timeOfDay: detectTimeOfDay(),
      category: cat,
      durationMin: null,
      notes: '',
    })
  }

  const weekPct = Math.min(100, (thisWeekCount / weekGoal) * 100)

  return (
    <div className="space-y-4">
      {draftPrompt && (
        <div className="card border-accent/30 bg-accent/5">
          <div className="flex items-center justify-between">
            <p className="text-sm">Unsaved self-care from <span className="text-accent">{draftAgo(draftPrompt.at)}</span> — restore?</p>
            <div className="flex gap-2">
              <button onClick={() => { setForm(draftPrompt.data); setDraftPrompt(null) }} className="btn-primary text-xs">Restore</button>
              <button onClick={() => { clearDraft(DRAFT_KEY); setDraftPrompt(null) }} className="btn-ghost text-xs">Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Weekly progress */}
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <Heart size={16} className="text-accent"/> This Week
        </div>
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>Self-care sessions</span>
          <span>{thisWeekCount} / {weekGoal}</span>
        </div>
        <div className="w-full bg-surfaceAlt rounded-full h-2 mb-3">
          <div className={`h-2 rounded-full transition-all ${weekPct >= 100 ? 'bg-success' : 'bg-accent'}`} style={{ width: `${weekPct}%` }}/>
        </div>
      </div>

      {/* Quick log chips */}
      <div className="card">
        <div className="card-title">Quick Log</div>
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button key={cat} onClick={() => quickLog(cat)}
              className="btn-secondary text-xs capitalize">{cat.replace('-', ' ')}</button>
          ))}
        </div>
      </div>

      {editId && (
        <div className="card border-warn/30 bg-warn/5">
          <p className="text-sm text-warn">Editing entry. <button onClick={cancelEdit} className="underline">Cancel</button></p>
        </div>
      )}

      {/* Detailed log form */}
      <div className="card">
        <div className="card-title">{editId ? 'Edit Entry' : 'Log Self-Care'}</div>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
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
            <label className="label">Category</label>
            <select className="input" value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {categories.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Duration (min)</label>
            <input type="number" min="1" step="1" className="input" placeholder="optional"
              value={form.durationMin} onChange={e => setForm(p => ({ ...p, durationMin: e.target.value }))}/>
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <input type="text" className="input" placeholder="Optional notes"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
          </div>
          <div className="col-span-2 flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Update' : 'Log'}
            </button>
            {editId && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      {/* History */}
      <div className="card">
        <div className="card-title">History</div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No self-care logged yet.</p>
        ) : entries.slice(0, 30).map(e => (
          <EditableRow key={e.id}
            onEdit={() => startEdit(e)}
            onDelete={() => deleteEntry(uid, 'selfCareLog', e.id)}
            className="mb-1"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium capitalize">{(e.category || '').replace('-', ' ')}</span>
                <TodChip tod={e.timeOfDay}/>
                <span className="text-xs text-muted">{e.date}</span>
                {e.durationMin && <span className="text-xs text-muted">{e.durationMin} min</span>}
              </div>
              {e.notes && <p className="text-xs text-muted italic mt-0.5">{e.notes}</p>}
            </div>
          </EditableRow>
        ))}
      </div>
    </div>
  )
}

// ── Root ───────────────────────────────────────────────────────────────────────
export default function Wellbeing() {
  const { user } = useAuth()
  const uid = user?.uid
  const [tab, setTab] = useState('Log')
  return (
    <div>
      <WellbeingTabs active={tab} set={setTab}/>
      {tab === 'Log' && <LogTab uid={uid}/>}
      {tab === 'Trends' && <TrendsTab uid={uid}/>}
      {tab === 'Self-Care' && <SelfCareTab uid={uid}/>}
    </div>
  )
}
