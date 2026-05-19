import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, deleteEntry } from '../data.js'
import { format } from 'date-fns'
import { Pill, Plus, Trash2, CheckCircle, Circle, Activity } from 'lucide-react'
import { isMedDueToday, lastTakenDate, computeDrugLevel, steadyStateLevel, DOW_LABELS } from '../clinical/meds.js'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'

const today = () => format(new Date(), 'yyyy-MM-dd')

const FREQUENCIES = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly (every 7 days)' },
  { value: 'specific-days', label: 'Specific days of the week' },
  { value: 'asNeeded', label: 'As needed' },
]
const TIMES = ['morning', 'afternoon', 'evening', 'bedtime', 'withFood', 'asDirected']
const UNITS = ['mg', 'mcg', 'g', 'ml', 'units', 'tablets', 'capsules']

const blankForm = () => ({
  name: '', dose: '', unit: 'mg', frequency: 'daily',
  daysOfWeek: [],
  timeOfDay: 'morning', startDate: today(), endDate: '', notes: '',
  halfLifeHours: '',
})

export default function Medications() {
  const { user } = useAuth()
  const uid = user?.uid
  const [meds, setMeds] = useState([])
  const [logs, setLogs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [tab, setTab] = useState('list') // 'list' | 'levels'

  useEffect(() => {
    if (!uid) return
    const u1 = subscribe(uid, 'medications', setMeds, { orderByField: 'createdAt' })
    const u2 = subscribe(uid, 'medicationLog', setLogs, { limit: 500 })
    return () => { u1(); u2() }
  }, [uid])

  const todayStr = today()

  const isTakenToday = (medId) => logs.some(l => l.date === todayStr && l.medId === medId)

  const markTaken = async (med) => {
    if (isTakenToday(med.id)) return
    await addEntry(uid, 'medicationLog', { date: todayStr, medId: med.id, name: med.name, dose: med.dose, unit: med.unit })
  }

  const resetForm = () => {
    setForm(blankForm())
    setEditId(null)
    setShowForm(false)
  }

  const toggleDow = (dow) => {
    setForm(p => {
      const set = new Set(p.daysOfWeek || [])
      set.has(dow) ? set.delete(dow) : set.add(dow)
      return { ...p, daysOfWeek: [...set].sort() }
    })
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name || !form.dose) return
    if (form.frequency === 'specific-days' && (!form.daysOfWeek || form.daysOfWeek.length === 0)) {
      alert('Please pick at least one day of the week for this medication.')
      return
    }
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        dose: form.dose,
        unit: form.unit,
        frequency: form.frequency,
        daysOfWeek: form.frequency === 'specific-days' ? form.daysOfWeek : [],
        timeOfDay: form.timeOfDay,
        startDate: form.startDate,
        endDate: form.endDate || null,
        notes: form.notes,
        halfLifeHours: form.halfLifeHours ? parseFloat(form.halfLifeHours) : null,
      }
      if (editId) {
        await setEntry(uid, 'medications', editId, data)
      } else {
        await addEntry(uid, 'medications', data)
      }
      resetForm()
    } finally { setSaving(false) }
  }

  const startEdit = (med) => {
    setForm({
      name: med.name || '',
      dose: med.dose || '',
      unit: med.unit || 'mg',
      frequency: med.frequency || 'daily',
      daysOfWeek: med.daysOfWeek || [],
      timeOfDay: med.timeOfDay || 'morning',
      startDate: med.startDate || today(),
      endDate: med.endDate || '',
      notes: med.notes || '',
      halfLifeHours: med.halfLifeHours != null ? String(med.halfLifeHours) : '',
    })
    setEditId(med.id)
    setShowForm(true)
  }

  const daily = meds.filter(m => m.frequency === 'daily')
  const dueToday = meds.filter(m => {
    if (m.frequency === 'daily') return false
    const lt = lastTakenDate(logs, m.id)
    return isMedDueToday(m, todayStr, lt)
  })
  const other = meds.filter(m => m.frequency !== 'daily')

  // Meds eligible for PK levels chart: must have half-life and at least one log
  const trackedMeds = useMemo(() => meds.filter(m => m.halfLifeHours > 0), [meds])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="card-title mb-0">Prescribed Medications</h2>
        <div className="flex gap-2">
          <button onClick={() => setTab(tab === 'list' ? 'levels' : 'list')} className="btn-ghost text-sm">
            {tab === 'list' ? <><Activity size={14}/> Levels</> : 'Back to list'}
          </button>
          {tab === 'list' && (
            <button onClick={() => { resetForm(); setShowForm(s => !s) }} className="btn-primary">
              <Plus size={14}/> Add
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted -mt-2">For prescribed medications only. Always follow your doctor's instructions.</p>

      {tab === 'levels' && <LevelsTab meds={trackedMeds} logs={logs}/>}

      {tab === 'list' && (
        <>
          {showForm && (
            <div className="card">
              <div className="card-title">{editId ? 'Edit' : 'Add'} Medication</div>
              <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="label">Name *</label>
                  <input type="text" className="input" placeholder="e.g. Mounjaro, Metformin"
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">Dose *</label>
                  <input type="text" className="input" placeholder="e.g. 7.5"
                    value={form.dose} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">Unit</label>
                  <select className="input" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Frequency</label>
                  <select className="input" value={form.frequency}
                    onChange={e => setForm(p => ({ ...p, frequency: e.target.value, daysOfWeek: e.target.value === 'specific-days' ? p.daysOfWeek : [] }))}>
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>

                {form.frequency === 'specific-days' && (
                  <div className="md:col-span-2">
                    <label className="label">Days of the week</label>
                    <div className="flex flex-wrap gap-2">
                      {DOW_LABELS.map((label, dow) => {
                        const active = form.daysOfWeek.includes(dow)
                        return (
                          <button key={dow} type="button" onClick={() => toggleDow(dow)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              active ? 'bg-accent text-bg' : 'bg-bg text-muted hover:text-text border border-border/40'
                            }`}>
                            {label}
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-xs text-muted mt-1">e.g. Tick Mon and Thu for twice-weekly.</p>
                  </div>
                )}

                <div>
                  <label className="label">Time of day</label>
                  <select className="input" value={form.timeOfDay} onChange={e => setForm(p => ({ ...p, timeOfDay: e.target.value }))}>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Half-life (hours, optional)</label>
                  <input type="number" step="0.1" min="0" className="input" placeholder="e.g. 120 (Mounjaro ≈ 120h / 5d)"
                    value={form.halfLifeHours} onChange={e => setForm(p => ({ ...p, halfLifeHours: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">Start date</label>
                  <input type="date" className="input" value={form.startDate}
                    onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}/>
                </div>
                <div>
                  <label className="label">End date (optional)</label>
                  <input type="date" className="input" value={form.endDate}
                    onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}/>
                </div>
                <div className="md:col-span-2">
                  <label className="label">Notes</label>
                  <input type="text" className="input" placeholder="e.g. Take with food, rotate injection sites"
                    value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? 'Saving…' : editId ? 'Update' : 'Add medication'}
                  </button>
                  <button type="button" onClick={resetForm} className="btn-ghost">Cancel</button>
                </div>
              </form>
            </div>
          )}

          {meds.length === 0 ? (
            <div className="card text-center">
              <Pill size={32} className="text-muted mx-auto mb-2"/>
              <p className="text-sm text-muted">No medications added yet.</p>
              <p className="text-xs text-muted">Add prescribed medications to track doses, mark them taken, and graph levels over time.</p>
            </div>
          ) : (
            <>
              {daily.length > 0 && (
                <div className="card">
                  <div className="card-title">Daily medications — today</div>
                  <MedList meds={daily} uid={uid} isTakenToday={isTakenToday}
                    markTaken={markTaken} startEdit={startEdit}/>
                </div>
              )}

              {dueToday.length > 0 && (
                <div className="card border-warn/30">
                  <div className="card-title flex items-center gap-2">
                    <span className="chip-warn">Due today</span> Scheduled medications
                  </div>
                  <MedList meds={dueToday} uid={uid} isTakenToday={isTakenToday}
                    markTaken={markTaken} startEdit={startEdit} variant="due"/>
                </div>
              )}

              {other.length > 0 && (
                <div className="card">
                  <div className="card-title">All medications</div>
                  <div className="space-y-2">
                    {other.map(med => (
                      <div key={med.id} className="flex items-center justify-between bg-bg rounded-xl p-3">
                        <div>
                          <div className="text-sm font-medium text-text">{med.name}</div>
                          <div className="text-xs text-muted">
                            {med.dose} {med.unit} · {frequencyDescription(med)} · {med.timeOfDay}
                            {med.halfLifeHours ? ` · t½ ${med.halfLifeHours}h` : ''}
                          </div>
                          {med.notes && <div className="text-xs text-muted italic">{med.notes}</div>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(med)} className="btn-ghost p-1 text-xs">Edit</button>
                          <button onClick={() => deleteEntry(uid, 'medications', med.id)} className="btn-ghost p-1 text-danger">
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function frequencyDescription(med) {
  if (med.frequency === 'specific-days') {
    const days = (med.daysOfWeek || []).map(d => DOW_LABELS[d]).join(', ')
    return days ? `${days}` : 'specific days'
  }
  return med.frequency
}

function MedList({ meds, uid, isTakenToday, markTaken, startEdit, variant }) {
  return (
    <div className="space-y-2">
      {meds.map(med => {
        const taken = isTakenToday(med.id)
        const baseBg = variant === 'due'
          ? (taken ? 'bg-success/10 border border-success/20' : 'bg-warn/10')
          : (taken ? 'bg-success/10 border border-success/20' : 'bg-bg')
        return (
          <div key={med.id} className={`flex items-center justify-between rounded-xl p-3 ${baseBg}`}>
            <div className="flex items-center gap-3">
              {taken
                ? <CheckCircle size={18} className="text-success shrink-0"/>
                : <Circle size={18} className={variant === 'due' ? 'text-warn shrink-0' : 'text-muted shrink-0'}/>}
              <div>
                <div className="text-sm font-medium text-text">{med.name}</div>
                <div className="text-xs text-muted">
                  {med.dose} {med.unit} · {frequencyDescription(med)} · {med.timeOfDay}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!taken && (
                <button onClick={() => markTaken(med)} className="btn-secondary text-xs py-1">Mark taken</button>
              )}
              <button onClick={() => startEdit(med)} className="btn-ghost p-1 text-xs">Edit</button>
              <button onClick={() => deleteEntry(uid, 'medications', med.id)} className="btn-ghost p-1 text-danger">
                <Trash2 size={13}/>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Levels tab — pharmacokinetic estimation
// ──────────────────────────────────────────────────────────────────────────────
function LevelsTab({ meds, logs }) {
  const [selectedMedId, setSelectedMedId] = useState(meds[0]?.id || '')
  const [windowDays, setWindowDays] = useState(60)

  useEffect(() => {
    // If meds list changes and current selection is gone, pick first
    if (meds.length > 0 && !meds.find(m => m.id === selectedMedId)) {
      setSelectedMedId(meds[0].id)
    }
  }, [meds, selectedMedId])

  if (meds.length === 0) {
    return (
      <div className="card text-center">
        <Activity size={32} className="text-muted mx-auto mb-2"/>
        <p className="text-sm text-muted">No medications with a half-life set.</p>
        <p className="text-xs text-muted">Edit a medication and add its half-life (in hours) to plot estimated levels.</p>
      </div>
    )
  }

  const med = meds.find(m => m.id === selectedMedId) || meds[0]
  const medLogs = logs.filter(l => l.medId === med.id)
  const dose = parseFloat(med.dose) || 0

  const today = format(new Date(), 'yyyy-MM-dd')
  const from = format(new Date(Date.now() - windowDays * 86400000), 'yyyy-MM-dd')
  const points = computeDrugLevel(medLogs, dose, med.halfLifeHours, from, today)

  // Steady state reference (assuming the typical interval the med is taken at)
  let intervalHours = null
  if (med.frequency === 'daily') intervalHours = 24
  else if (med.frequency === 'weekly') intervalHours = 168
  else if (med.frequency === 'specific-days' && med.daysOfWeek?.length > 0) {
    intervalHours = (168 / med.daysOfWeek.length) // average
  }
  const ss = intervalHours ? steadyStateLevel(dose, med.halfLifeHours, intervalHours) : null

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div className="md:col-span-2">
            <label className="label">Medication</label>
            <select className="input" value={selectedMedId} onChange={e => setSelectedMedId(e.target.value)}>
              {meds.map(m => <option key={m.id} value={m.id}>{m.name} ({m.dose}{m.unit}, t½ {m.halfLifeHours}h)</option>)}
            </select>
          </div>
          <div>
            <label className="label">Window</label>
            <select className="input" value={windowDays} onChange={e => setWindowDays(parseInt(e.target.value))}>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
              <option value={180}>Last 180 days</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-text mb-2">
          Estimated active level (dose-equivalent {med.unit})
        </div>

        {medLogs.length === 0 ? (
          <div className="text-sm text-muted bg-bg rounded-lg p-4">
            No dose log entries yet for {med.name}. Mark a dose as taken to start populating the curve.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 5, right: 8, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11}
                  tickFormatter={(d) => format(new Date(d), 'd MMM')}/>
                <YAxis stroke="#94a3b8" fontSize={11}/>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }}
                  labelStyle={{ color: '#f1f5f9' }}/>
                <Line type="monotone" dataKey="level" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false}/>
                {ss && <ReferenceLine y={ss} stroke="#10b981" strokeDasharray="4 4" label={{ value: `Est. steady state ≈ ${ss}`, fill: '#10b981', fontSize: 10, position: 'right' }}/>}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="text-xs text-muted mt-2">
          One-compartment first-order elimination model: each logged dose decays as C(t) = C₀ × 0.5^(t/t½).
          The dashed line is the theoretical steady-state trough if you dose at a fixed interval.
          This is a simplified estimate — actual plasma levels vary with absorption, distribution and individual factors.
        </p>
      </div>
    </div>
  )
}
