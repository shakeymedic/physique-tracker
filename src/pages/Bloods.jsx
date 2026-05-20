import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, deleteEntry, setEntry, getSettings, saveSettings } from '../data.js'
import { format } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { AlertTriangle, Pencil } from 'lucide-react'
import { flag, RANGES } from '../clinical/ranges.js'
import EditableRow from '../components/EditableRow.jsx'

const today = () => format(new Date(), 'yyyy-MM-dd')

function FlagChip({ name, value, sex }) {
  const f = flag(name, value, sex)
  if (!f || value === '' || value === null || value === undefined) return null
  const cls = { ok: 'chip-ok', warn: 'chip-warn', bad: 'chip-bad' }[f]
  const label = { ok: '✓', warn: '!', bad: '✗' }[f]
  return <span className={cls}>{label}</span>
}

function Tabs({ active, set }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {['Log','Trends','Reference'].map(t => (
        <button key={t} onClick={() => set(t)} className={active === t ? 'btn-primary' : 'btn-secondary'}>{t}</button>
      ))}
    </div>
  )
}

function DisclaimerBanner() {
  return (
    <div className="flex items-start gap-3 bg-warn/10 border border-warn/30 rounded-xl p-3 mb-4">
      <AlertTriangle size={18} className="text-warn shrink-0 mt-0.5"/>
      <p className="text-sm text-warn">
        Reference ranges are general guidance only — interpret with your doctor. This tool does not provide medical advice.
      </p>
    </div>
  )
}

const BLOOD_FIELDS = [
  { key: 'systolic',      label: 'Systolic BP',       unit: 'mmHg',         group: 'BP' },
  { key: 'diastolic',     label: 'Diastolic BP',       unit: 'mmHg',         group: 'BP' },
  { key: 'hr',            label: 'Heart Rate',         unit: 'bpm',          group: 'BP' },
  { key: 'totalChol',     label: 'Total Cholesterol',  unit: 'mmol/L',       group: 'Lipids' },
  { key: 'hdl',           label: 'HDL',                unit: 'mmol/L',       group: 'Lipids' },
  { key: 'ldl',           label: 'LDL',                unit: 'mmol/L',       group: 'Lipids' },
  { key: 'triglycerides', label: 'Triglycerides',      unit: 'mmol/L',       group: 'Lipids' },
  { key: 'ast',           label: 'AST',                unit: 'U/L',          group: 'Liver' },
  { key: 'alt',           label: 'ALT',                unit: 'U/L',          group: 'Liver' },
  { key: 'ggt',           label: 'GGT',                unit: 'U/L',          group: 'Liver' },
  { key: 'alp',           label: 'ALP',                unit: 'U/L',          group: 'Liver' },
  { key: 'bilirubin',     label: 'Bilirubin',          unit: 'µmol/L',       group: 'Liver' },
  { key: 'haemoglobin',   label: 'Haemoglobin',        unit: 'g/L',          group: 'Haem' },
  { key: 'haematocrit',   label: 'Haematocrit',        unit: '%',            group: 'Haem' },
  { key: 'hba1c',         label: 'HbA1c',              unit: 'mmol/mol',     group: 'Glucose' },
  { key: 'fastingGlucose',label: 'Fasting Glucose',    unit: 'mmol/L',       group: 'Glucose' },
  { key: 'egfr',          label: 'eGFR',               unit: 'mL/min/1.73m²',group: 'Renal' },
  { key: 'creatinine',    label: 'Creatinine',         unit: 'µmol/L',       group: 'Renal' },
]

// ── Log ───────────────────────────────────────────────────────────────────────
function LogTab({ uid, sex }) {
  const [entries, setEntries] = useState([])
  const emptyForm = () => ({ date: today(), ...Object.fromEntries(BLOOD_FIELDS.map(f => [f.key, ''])) })
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => subscribe(uid, 'bloods', setEntries, { limit: 100 }), [uid])

  const save = async (e) => {
    e.preventDefault()
    const data = { date: form.date }
    BLOOD_FIELDS.forEach(f => { if (form[f.key] !== '') data[f.key] = parseFloat(form[f.key]) })
    setSaving(true)
    try {
      if (editId) {
        await setEntry(uid, 'bloods', editId, data)
        setEditId(null)
      } else {
        await addEntry(uid, 'bloods', data)
      }
      setForm(emptyForm())
    } finally { setSaving(false) }
  }

  const startEdit = (entry) => {
    setForm({
      date: entry.date,
      ...Object.fromEntries(BLOOD_FIELDS.map(f => [f.key, entry[f.key] !== undefined && entry[f.key] !== null ? String(entry[f.key]) : '']))
    })
    setEditId(entry.id)
  }
  const cancelEdit = () => { setEditId(null); setForm(emptyForm()) }

  const groups = [...new Set(BLOOD_FIELDS.map(f => f.group))]

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Log Blood Results</div>
        <form onSubmit={save}>
          <div className="mb-4">
            <label className="label">Date</label>
            <input type="date" className="input max-w-xs" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
          </div>
          {groups.map(grp => (
            <div key={grp} className="mb-4">
              <div className="text-xs font-semibold text-accent uppercase tracking-wide mb-2">{grp}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {BLOOD_FIELDS.filter(f => f.group === grp).map(f => (
                  <div key={f.key}>
                    <label className="label">{f.label} <span className="text-muted normal-case font-normal">({f.unit})</span></label>
                    <input type="number" step="any" min="0" className="input"
                      value={form[f.key]} inputMode="decimal" onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}/>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update Results' : 'Save Results'}</button>
            {editId && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">History</div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted">No blood results logged yet.</p>
        ) : entries.map((e, idx) => {
          const prev = entries[idx + 1] // entries sorted desc so next = older
          return (
            <EditableRow key={e.id}
              onEdit={() => startEdit(e)}
              onDelete={() => deleteEntry(uid, 'bloods', e.id)}
              className="mb-2 items-start"
            >
              <div>
                <div className="text-sm font-medium mb-1">{e.date}</div>
                <div className="flex flex-wrap gap-2">
                  {BLOOD_FIELDS.filter(f => e[f.key] !== undefined && e[f.key] !== null).map(f => {
                    const delta = prev && prev[f.key] != null ? (parseFloat(e[f.key]) - parseFloat(prev[f.key])) : null
                    return (
                      <div key={f.key} className="flex items-center gap-1 text-xs">
                        <span className="text-muted">{f.label}:</span>
                        <span className="text-text">{e[f.key]}</span>
                        <FlagChip name={f.key} value={e[f.key]} sex={sex}/>
                        {delta !== null && Math.abs(delta) > 0.01 && (
                          <span className={`text-[10px] ${delta < 0 ? 'text-success' : 'text-danger'}`}>
                            {delta > 0 ? '↑' : '↓'}{Math.abs(delta).toFixed(1)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </EditableRow>
          )
        })}
      </div>
    </div>
  )
}

// ── Trends ────────────────────────────────────────────────────────────────────
function TrendsTab({ uid, sex }) {
  const [entries, setEntries] = useState([])
  const [param, setParam] = useState('systolic')
  const [settings, setSettings] = useState({})
  const [targetInput, setTargetInput] = useState('')

  useEffect(() => { getSettings(uid).then(s => {
    setSettings(s)
    const t = s.bloodTargets?.[param]
    setTargetInput(t != null ? String(t) : '')
  }) }, [uid, param])

  const saveTarget = async () => {
    const val = parseFloat(targetInput)
    if (isNaN(val)) return
    const targets = { ...(settings.bloodTargets || {}), [param]: val }
    await saveSettings(uid, { bloodTargets: targets })
    setSettings(prev => ({ ...prev, bloodTargets: targets }))
  }

  useEffect(() => subscribe(uid, 'bloods', setEntries, { limit: 200 }), [uid])

  const sorted = entries.filter(e => e[param] !== undefined && e[param] !== null)
    .slice().sort((a, b) => a.date.localeCompare(b.date))
  const chartData = sorted.map(e => ({ date: e.date.slice(5), value: parseFloat(e[param]) }))

  const r = RANGES[param]
  const rs = r ? (r['M'] || r[sex === 'F' ? 'F' : 'M']) : null

  const refLines = []
  if (rs) {
    if (rs.ok) { refLines.push({ v: rs.ok[0], c: '#10b981' }); refLines.push({ v: rs.ok[1], c: '#10b981' }) }
    if (rs.okMax) refLines.push({ v: rs.okMax, c: '#10b981' })
    if (rs.okMin) refLines.push({ v: rs.okMin, c: '#10b981' })
    if (rs.warnMax) refLines.push({ v: rs.warnMax, c: '#f59e0b' })
    if (rs.warnMin) refLines.push({ v: rs.warnMin, c: '#f59e0b' })
  }

  const fieldInfo = BLOOD_FIELDS.find(f => f.key === param)

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Parameter</div>
        <select className="input max-w-xs" value={param} onChange={e => setParam(e.target.value)}>
          {BLOOD_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label} ({f.unit})</option>)}
        </select>
      </div>
      <div className="card">
        <div className="card-title">{fieldInfo?.label} Trend</div>
        {chartData.length < 2 ? (
          <p className="text-sm text-muted">Not enough data for this parameter.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
              <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd"/>
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto','auto']} width={36}/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}
                formatter={(v) => [`${v} ${fieldInfo?.unit || ''}`, fieldInfo?.label]}/>
              {refLines.map((rl, i) => (
                <ReferenceLine key={i} y={rl.v} stroke={rl.c} strokeDasharray="4 2" strokeWidth={1}/>
              ))}
              {settings.bloodTargets?.[param] && (
                <ReferenceLine y={settings.bloodTargets[param]} stroke="#a78bfa" strokeDasharray="6 3" strokeWidth={2} label={{ value: 'Target', fill: '#a78bfa', fontSize: 10 }}/>
              )}
              <Line type="monotone" dataKey="value" stroke="#22d3ee" dot={{ r: 3, fill: '#22d3ee' }} strokeWidth={2}/>
            </LineChart>
          </ResponsiveContainer>
        )}
        <div className="flex gap-2 items-end mt-3 pt-3 border-t border-border/20">
          <div className="flex-1">
            <label className="label text-xs">Personal target for {fieldInfo?.label} ({fieldInfo?.unit})</label>
            <input type="number" step="any" className="input" placeholder="e.g. 130" value={targetInput}
              inputMode="decimal"
              onChange={e => setTargetInput(e.target.value)}/>
          </div>
          <button onClick={saveTarget} className="btn-secondary text-sm">Set target</button>
        </div>
      </div>
    </div>
  )
}

// ── Reference ─────────────────────────────────────────────────────────────────
function ReferenceTab() {
  return (
    <div className="card overflow-x-auto">
      <div className="card-title">UK Reference Ranges</div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b border-border/40">
            <th className="pb-2 text-muted font-medium">Marker</th>
            <th className="pb-2 text-muted font-medium">Unit</th>
            <th className="pb-2 text-success font-medium">OK</th>
            <th className="pb-2 text-warn font-medium">Warn</th>
            <th className="pb-2 text-danger font-medium">Bad</th>
          </tr>
        </thead>
        <tbody>
          {BLOOD_FIELDS.map(f => {
            const rm = RANGES[f.key]?.['M']
            if (!rm) return null
            let ok = '—', warn = '—', bad = '—'
            if (rm.ok) { ok = `${rm.ok[0]}–${rm.ok[1]}`; bad = `<${rm.ok[0]} or >${rm.ok[1]}` }
            if (rm.okMax) { ok = `<${rm.okMax}`; bad = `>${rm.warnMax ?? rm.okMax}` }
            if (rm.okMin) { ok = `>${rm.okMin}`; bad = `<${rm.warnMin ?? rm.okMin}` }
            if (rm.warn) warn = `${rm.warn[0]}–${rm.warn[1]}`
            if (rm.warnMax) warn = `${rm.okMax}–${rm.warnMax}`
            if (rm.warnMin) warn = `${rm.warnMin}–${rm.okMin}`
            return (
              <tr key={f.key} className="border-b border-border/20">
                <td className="py-2 text-text">{f.label}</td>
                <td className="py-2 text-muted">{f.unit}</td>
                <td className="py-2 text-success">{ok}</td>
                <td className="py-2 text-warn">{warn}</td>
                <td className="py-2 text-danger">{bad}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="text-xs text-muted mt-3">Male ranges shown. Values may differ slightly between labs.</p>
    </div>
  )
}

export default function Bloods() {
  const { user } = useAuth()
  const uid = user?.uid
  const [tab, setTab] = useState('Log')
  const [sex, setSex] = useState('M')

  useEffect(() => {
    if (!uid) return
    getSettings(uid).then(s => { if (s.sex) setSex(s.sex) })
  }, [uid])

  return (
    <div>
      <DisclaimerBanner/>
      <Tabs active={tab} set={setTab}/>
      {tab === 'Log' && <LogTab uid={uid} sex={sex}/>}
      {tab === 'Trends' && <TrendsTab uid={uid} sex={sex}/>}
      {tab === 'Reference' && <ReferenceTab/>}
    </div>
  )
}
