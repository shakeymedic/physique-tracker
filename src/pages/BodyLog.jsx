import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, deleteEntry } from '../data.js'
import { format } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { Trash2 } from 'lucide-react'

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
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribe(uid, 'weights', setEntries, { limit: 180 }), [uid])

  const save = async (e) => {
    e.preventDefault()
    if (!form.weight) return
    setSaving(true)
    try {
      await addEntry(uid, 'weights', {
        date: form.date,
        weight: parseFloat(form.weight),
        bodyFat: form.bodyFat ? parseFloat(form.bodyFat) : null,
        notes: form.notes,
      })
      setForm({ date: today(), weight: '', bodyFat: '', notes: '' })
    } finally { setSaving(false) }
  }

  const sorted = entries.slice().sort((a, b) => a.date.localeCompare(b.date))
  const chartData = sorted.slice(-90).map(w => ({
    date: w.date.slice(5),
    weight: parseFloat(w.weight),
    bf: w.bodyFat ? parseFloat(w.bodyFat) : undefined,
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
              value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Body Fat % (optional)</label>
            <input type="number" step="0.1" min="0" max="60" className="input" placeholder="e.g. 18"
              value={form.bodyFat} onChange={e => setForm(p => ({ ...p, bodyFat: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Notes</label>
            <input type="text" className="input" placeholder="e.g. morning fasted"
              value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Entry'}</button>
          </div>
        </form>
      </div>

      {chartData.length > 1 && (
        <div className="card">
          <div className="card-title">90-Day Trend</div>
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
              <div key={e.id} className="flex items-center justify-between bg-bg rounded-lg px-3 py-2">
                <span className="text-sm text-muted">{e.date}</span>
                <span className="text-sm font-medium text-text">{e.weight} kg{e.bodyFat ? ` · ${e.bodyFat}% BF` : ''}</span>
                {e.notes && <span className="text-xs text-muted hidden md:block">{e.notes}</span>}
                <button onClick={() => deleteEntry(uid, 'weights', e.id)} className="btn-ghost p-1" title="Delete">
                  <Trash2 size={14}/>
                </button>
              </div>
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
  const [form, setForm] = useState({ date: today(), ...Object.fromEntries(MEAS_FIELDS.map(f => [f, ''])) })
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribe(uid, 'measurements', setEntries, { limit: 100 }), [uid])

  const save = async (e) => {
    e.preventDefault()
    const data = { date: form.date }
    MEAS_FIELDS.forEach(f => { if (form[f]) data[f] = parseFloat(form[f]) })
    setSaving(true)
    try {
      await addEntry(uid, 'measurements', data)
      setForm({ date: today(), ...Object.fromEntries(MEAS_FIELDS.map(f => [f, ''])) })
    } finally { setSaving(false) }
  }

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
                value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}/>
            </div>
          ))}
          <div className="col-span-2 md:col-span-4">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Measurements'}</button>
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
              <div key={e.id} className="flex items-start justify-between bg-bg rounded-lg px-3 py-2 gap-2">
                <span className="text-sm text-muted shrink-0">{e.date}</span>
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  {MEAS_FIELDS.filter(f => e[f]).map(f => (
                    <span key={f}>{MEAS_LABELS[f]}: <span className="text-text">{e[f]}cm</span></span>
                  ))}
                </div>
                <button onClick={() => deleteEntry(uid, 'measurements', e.id)} className="btn-ghost p-1 shrink-0">
                  <Trash2 size={14}/>
                </button>
              </div>
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
