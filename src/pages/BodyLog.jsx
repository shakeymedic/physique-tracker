import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, deleteEntry, setEntry } from '../data.js'
import { format } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Trash2 } from 'lucide-react'
import EditableRow from '../components/EditableRow.jsx'

const today = () => format(new Date(), 'yyyy-MM-dd')

function SubTabs({ active, set }) {
  return (
    <div className="flex gap-2 mb-4">
      {['Weight', 'Measurements'].map(t => (
        <button key={t} onClick={() => set(t)}
          className={active === t ? 'btn-primary' : 'btn-secondary'}>
          {t}
        </button>
      ))}
    </div>
  )
}

// ── Weight section ────────────────────────────────────────────────────────────
function WeightSection({ uid }) {
  const [entries, setEntries] = useState([])
  const [form, setForm] = useState({ date: today(), weight: '', bodyFat: '', notes: '' })
  const [chartRange, setChartRange] = useState(90)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => subscribe(uid, 'weights', setEntries, { limit: 180 }), [uid])

  const save = async (e) => {
    e.preventDefault()
    if (!form.weight) return
    setSaving(true)
    try {
      const data = {
        date: form.date,
        weight: parseFloat(form.weight),
        bodyFat: form.bodyFat ? parseFloat(form.bodyFat) : null,
        notes: form.notes,
      }
      if (editId) {
        await setEntry(uid, 'weights', editId, data)
        setEditId(null)
      } else {
        await addEntry(uid, 'weights', data)
      }
      setForm({ date: today(), weight: '', bodyFat: '', notes: '' })
    } finally { setSaving(false) }
  }

  const startEdit = (entry) => {
    setForm({ date: entry.date, weight: String(entry.weight || ''), bodyFat: String(entry.bodyFat || ''), notes: entry.notes || '' })
    setEditId(entry.id)
  }
  const cancelEdit = () => { setEditId(null); setForm({ date: today(), weight: '', bodyFat: '', notes: '' }) }

  const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date))
  const chartData = sorted.slice(chartRange === 999 ? 0 : -chartRange).map(w => ({
    date: w.date.slice(5),
    weight: parseFloat(w.weight),
    bf: w.bodyFat ? parseFloat(w.bodyFat) : undefined,
    lbm: (w.weight && w.bodyFat) ? parseFloat((parseFloat(w.weight) * (1 - parseFloat(w.bodyFat) / 100)).toFixed(1)) : undefined,
  }))

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Log Weight</div>
        <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Weight (kg) *</label>
            <input type="number" step="0.1" min="0" className="input" placeholder="e.g. 82.5"
              value={form.weight} inputMode="decimal" onChange={e => setForm(p => ({ ...p, weight: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Body Fat % (optional)</label>
            <input type="number" step="0.1" min="0" max="60" className="input" placeholder="e.g. 18"
              value={form.bodyFat} inputMode="decimal" onChange={e => setForm(p => ({ ...p, bodyFat: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" placeholder="e.g. morning fasted"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Entry' : 'Save Entry'}</button>
            {editId && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      {/* Body composition change summary */}
      {entries.length >= 2 && (() => {
        const sorted90 = entries.slice().sort((a, b) => a.date.localeCompare(b.date))
        const earliest = sorted90[0]
        const latest = sorted90[sorted90.length - 1]
        const weightChange = (parseFloat(latest.weight) - parseFloat(earliest.weight)).toFixed(1)
        const bfChange = (earliest.bodyFat && latest.bodyFat)
          ? (parseFloat(latest.bodyFat) - parseFloat(earliest.bodyFat)).toFixed(1)
          : null
        const lbmEarly = (earliest.weight && earliest.bodyFat) ? parseFloat(earliest.weight) * (1 - parseFloat(earliest.bodyFat) / 100) : null
        const lbmLatest = (latest.weight && latest.bodyFat) ? parseFloat(latest.weight) * (1 - parseFloat(latest.bodyFat) / 100) : null
        const lbmChange = lbmEarly && lbmLatest ? (lbmLatest - lbmEarly).toFixed(1) : null
        const sign = v => parseFloat(v) >= 0 ? `+${v}` : String(v)
        const color = (v, positive) => {
          const n = parseFloat(v)
          if (n === 0) return 'text-text'
          return (n > 0) === positive ? 'text-success' : 'text-danger'
        }
        return (
          <div className="card">
            <div className="card-title">Change Since First Entry</div>
            <p className="text-xs text-muted mb-3">Comparing {earliest.date} → {latest.date}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-bg rounded-xl p-3">
                <div className="text-xs text-muted mb-1">Weight</div>
                <div className={`font-bold text-lg ${color(weightChange, false)}`}>{sign(weightChange)} kg</div>
                <div className="text-xs text-muted">{earliest.weight} → {latest.weight} kg</div>
              </div>
              {bfChange !== null && (
                <div className="bg-bg rounded-xl p-3">
                  <div className="text-xs text-muted mb-1">Body Fat</div>
                  <div className={`font-bold text-lg ${color(bfChange, false)}`}>{sign(bfChange)}%</div>
                  <div className="text-xs text-muted">{earliest.bodyFat} → {latest.bodyFat}%</div>
                </div>
              )}
              {lbmChange !== null && (
                <div className="bg-bg rounded-xl p-3">
                  <div className="text-xs text-muted mb-1">Lean Body Mass</div>
                  <div className={`font-bold text-lg ${color(lbmChange, true)}`}>{sign(lbmChange)} kg</div>
                  <div className="text-xs text-muted">{lbmEarly?.toFixed(1)} → {lbmLatest?.toFixed(1)} kg</div>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {chartData.length > 1 && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <div className="card-title">Weight Trend</div>
            <div className="flex gap-1">
              {[['90d', 90], ['6m', 180], ['1y', 365], ['All', 999]].map(([label, days]) => (
                <button key={label} onClick={() => setChartRange(days)}
                  className={chartRange === days ? 'btn-primary text-xs px-2 py-0.5' : 'btn-ghost text-xs px-2 py-0.5'}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd"/>
              <YAxis yAxisId="w" tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto','auto']} width={36}/>
              <YAxis yAxisId="bf" orientation="right" tick={{ fill: '#94a3b8', fontSize: 10 }} width={30}/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}/>
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}/>
              <Line yAxisId="w" type="monotone" dataKey="weight" name="kg" stroke="#22d3ee" dot={false} strokeWidth={1.5}/>
              <Line yAxisId="bf" type="monotone" dataKey="bf" name="BF%" stroke="#f59e0b" dot={false} strokeWidth={1.5}/>
              <Line yAxisId="w" type="monotone" dataKey="lbm" name="LBM kg" stroke="#10b981" dot={false} strokeWidth={1.5} strokeDasharray="4 2" connectNulls/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="card-title">History</div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No entries yet — log your first weight above.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(e => (
              <EditableRow key={e.id}
                onEdit={() => startEdit(e)}
                onDelete={() => deleteEntry(uid, 'weights', e.id)}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted">{e.date}</span>
                  <span className="text-sm font-medium text-text">{e.weight} kg{e.bodyFat ? ` · ${e.bodyFat}% BF` : ''}</span>
                  {e.notes && <span className="text-xs text-muted hidden md:block">{e.notes}</span>}
                </div>
              </EditableRow>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Measurements section ───────────────────────────────────────────────────────
const MEAS_FIELDS = ['waist','chest','armsL','armsR','thighsL','thighsR','neck','hips']
const MEAS_LABELS = { waist:'Waist', chest:'Chest', armsL:'Arms L', armsR:'Arms R',
  thighsL:'Thighs L', thighsR:'Thighs R', neck:'Neck', hips:'Hips' }

function MeasurementsSection({ uid }) {
  const [entries, setEntries] = useState([])
  const emptyForm = () => ({ date: today(), ...Object.fromEntries(MEAS_FIELDS.map(f => [f, ''])) })
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => subscribe(uid, 'measurements', setEntries, { limit: 100 }), [uid])

  const save = async (e) => {
    e.preventDefault()
    const data = { date: form.date }
    MEAS_FIELDS.forEach(f => { if (form[f]) data[f] = parseFloat(form[f]) })
    setSaving(true)
    try {
      if (editId) {
        await setEntry(uid, 'measurements', editId, data)
        setEditId(null)
      } else {
        await addEntry(uid, 'measurements', data)
      }
      setForm(emptyForm())
    } finally { setSaving(false) }
  }

  const startEdit = (entry) => {
    setForm({ date: entry.date, ...Object.fromEntries(MEAS_FIELDS.map(f => [f, entry[f] ? String(entry[f]) : ''])) })
    setEditId(entry.id)
  }
  const cancelEdit = () => { setEditId(null); setForm(emptyForm()) }

  const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date))
  const chartData = sorted.slice(-60).map(m => ({
    date: m.date.slice(5),
    ...Object.fromEntries(MEAS_FIELDS.map(f => [f, m[f] ? parseFloat(m[f]) : undefined]))
  }))

  const COLORS = ['#22d3ee','#f59e0b','#10b981','#ef4444','#a78bfa','#fb923c','#34d399','#60a5fa']

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Log Measurements (cm)</div>
        <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2 md:col-span-4">
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
          </div>
          {MEAS_FIELDS.map(f => (
            <div key={f}>
              <label className="label">{MEAS_LABELS[f]}</label>
              <input type="number" step="0.1" min="0" className="input" placeholder="cm"
                value={form[f]} inputMode="decimal" onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}/>
            </div>
          ))}
          <div className="col-span-2 md:col-span-4 flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Save Measurements'}</button>
            {editId && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      {chartData.length > 1 && (
        <div className="card">
          <div className="card-title">Measurement Trends</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd"/>
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto','auto']} width={30}/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}/>
              <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }}/>
              {MEAS_FIELDS.map((f, i) => (
                <Line key={f} type="monotone" dataKey={f} name={MEAS_LABELS[f]}
                  stroke={COLORS[i % COLORS.length]} dot={false} strokeWidth={1.5}
                  connectNulls/>
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="card">
        <div className="card-title">History</div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No measurements yet.</p>
        ) : (
          <div className="space-y-2">
            {entries.map(e => (
              <EditableRow key={e.id}
                onEdit={() => startEdit(e)}
                onDelete={() => deleteEntry(uid, 'measurements', e.id)}
              >
                <div>
                  <div className="text-sm text-muted">{e.date}</div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    {MEAS_FIELDS.filter(f => e[f]).map(f => (
                      <span key={f}>{MEAS_LABELS[f]}: <span className="text-text">{e[f]}cm</span></span>
                    ))}
                  </div>
                </div>
              </EditableRow>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function BodyLog() {
  const { user } = useAuth()
  const uid = user?.uid
  const [tab, setTab] = useState('Weight')
  return (
    <div>
      <SubTabs active={tab} set={setTab}/>
      {tab === 'Weight' ? <WeightSection uid={uid}/> : <MeasurementsSection uid={uid}/>}
    </div>
  )
}
