import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, deleteEntry, getAll } from '../data.js'
import { format } from 'date-fns'
import { Pill, Plus, Trash2, CheckCircle, Circle } from 'lucide-react'

const today = () => format(new Date(), 'yyyy-MM-dd')

const FREQUENCIES = ['daily', 'weekly', 'asNeeded']
const TIMES = ['morning', 'afternoon', 'evening', 'bedtime', 'withFood', 'asDirected']
const UNITS = ['mg', 'mcg', 'g', 'ml', 'units', 'tablets', 'capsules']

export default function Medications() {
  const { user } = useAuth()
  const uid = user?.uid
  const [meds, setMeds] = useState([])
  const [logs, setLogs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', dose: '', unit: 'mg', frequency: 'daily',
    timeOfDay: 'morning', startDate: today(), endDate: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    if (!uid) return
    const u1 = subscribe(uid, 'medications', setMeds, { orderByField: 'createdAt' })
    const u2 = subscribe(uid, 'medicationLog', setLogs, { limit: 200 })
    return () => { u1(); u2() }
  }, [uid])

  const todayStr = today()

  const isTakenToday = (medId) => logs.some(l => l.date === todayStr && l.medId === medId)

  const markTaken = async (med) => {
    const already = isTakenToday(med.id)
    if (already) return
    await addEntry(uid, 'medicationLog', { date: todayStr, medId: med.id, name: med.name })
  }

  const resetForm = () => {
    setForm({ name: '', dose: '', unit: 'mg', frequency: 'daily', timeOfDay: 'morning', startDate: today(), endDate: '', notes: '' })
    setEditId(null)
    setShowForm(false)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name || !form.dose) return
    setSaving(true)
    try {
      const data = {
        name: form.name.trim(),
        dose: form.dose,
        unit: form.unit,
        frequency: form.frequency,
        timeOfDay: form.timeOfDay,
        startDate: form.startDate,
        endDate: form.endDate || null,
        notes: form.notes,
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
      timeOfDay: med.timeOfDay || 'morning',
      startDate: med.startDate || today(),
      endDate: med.endDate || '',
      notes: med.notes || '',
    })
    setEditId(med.id)
    setShowForm(true)
  }

  const daily = meds.filter(m => m.frequency === 'daily')
  const other = meds.filter(m => m.frequency !== 'daily')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="card-title mb-0">Prescribed Medications</h2>
        <button onClick={() => { resetForm(); setShowForm(s => !s) }} className="btn-primary">
          <Plus size={14}/> Add
        </button>
      </div>

      <p className="text-xs text-muted -mt-2">For prescribed medications only. Always follow your doctor's instructions.</p>

      {showForm && (
        <div className="card">
          <div className="card-title">{editId ? 'Edit' : 'Add'} Medication</div>
          <form onSubmit={save} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="label">Generic Name *</label>
              <input type="text" className="input" placeholder="e.g. Metformin"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Dose *</label>
              <input type="text" className="input" placeholder="e.g. 500"
                value={form.dose} onChange={e => setForm(p => ({ ...p, dose: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Unit</label>
              <select className="input" value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Frequency</label>
              <select className="input" value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}>
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Time of Day</label>
              <select className="input" value={form.timeOfDay} onChange={e => setForm(p => ({ ...p, timeOfDay: e.target.value }))}>
                {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input type="date" className="input" value={form.startDate}
                onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}/>
            </div>
            <div>
              <label className="label">End Date (optional)</label>
              <input type="date" className="input" value={form.endDate}
                onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))}/>
            </div>
            <div className="md:col-span-2">
              <label className="label">Notes</label>
              <input type="text" className="input" placeholder="e.g. Take with food"
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Add Medication'}</button>
              <button type="button" onClick={resetForm} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {meds.length === 0 ? (
        <div className="card text-center">
          <Pill size={32} className="text-muted mx-auto mb-2"/>
          <p className="text-sm text-muted">No medications added yet.</p>
          <p className="text-xs text-muted">Add prescribed medications to track doses and mark them taken each day.</p>
        </div>
      ) : (
        <>
          {daily.length > 0 && (
            <div className="card">
              <div className="card-title">Daily Medications — Today</div>
              <div className="space-y-2">
                {daily.map(med => {
                  const taken = isTakenToday(med.id)
                  return (
                    <div key={med.id} className={`flex items-center justify-between rounded-xl p-3 ${taken ? 'bg-success/10 border border-success/20' : 'bg-bg'}`}>
                      <div className="flex items-center gap-3">
                        {taken
                          ? <CheckCircle size={18} className="text-success shrink-0"/>
                          : <Circle size={18} className="text-muted shrink-0"/>}
                        <div>
                          <div className="text-sm font-medium text-text">{med.name}</div>
                          <div className="text-xs text-muted">{med.dose} {med.unit} · {med.timeOfDay}</div>
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
            </div>
          )}

          {other.length > 0 && (
            <div className="card">
              <div className="card-title">Other Medications</div>
              <div className="space-y-2">
                {other.map(med => (
                  <div key={med.id} className="flex items-center justify-between bg-bg rounded-xl p-3">
                    <div>
                      <div className="text-sm font-medium text-text">{med.name}</div>
                      <div className="text-xs text-muted">{med.dose} {med.unit} · {med.frequency} · {med.timeOfDay}</div>
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
    </div>
  )
}
