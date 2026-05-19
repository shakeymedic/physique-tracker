import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, deleteEntry } from '../data.js'
import { format } from 'date-fns'
import { Plus, Trash2, Edit2, ClipboardList } from 'lucide-react'

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
const DAY_LABELS = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }
const TYPES = ['task', 'habit']

export default function Planner() {
  const { user } = useAuth()
  const uid = user?.uid
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', type: 'task', days: [], specificDate: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!uid) return
    return subscribe(uid, 'planner', setItems, { orderByField: 'createdAt' })
  }, [uid])

  const resetForm = () => {
    setForm({ title: '', type: 'task', days: [], specificDate: '', notes: '' })
    setEditId(null)
    setShowForm(false)
  }

  const toggleDay = (d) => {
    setForm(p => ({
      ...p,
      days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d],
    }))
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    try {
      const data = {
        title: form.title.trim(),
        type: form.type,
        days: form.days,
        specificDate: form.specificDate || null,
        notes: form.notes,
      }
      if (editId) {
        await setEntry(uid, 'planner', editId, data)
      } else {
        await addEntry(uid, 'planner', data)
      }
      resetForm()
    } finally { setSaving(false) }
  }

  const startEdit = (item) => {
    setForm({
      title: item.title || '',
      type: item.type || 'task',
      days: item.days || [],
      specificDate: item.specificDate || '',
      notes: item.notes || '',
    })
    setEditId(item.id)
    setShowForm(true)
  }

  const todayDay = format(new Date(), 'EEE').toLowerCase().slice(0, 3)
  const todayDate = format(new Date(), 'yyyy-MM-dd')
  const todayItems = items.filter(p => {
    if (p.specificDate) return p.specificDate === todayDate
    return Array.isArray(p.days) && p.days.includes(todayDay)
  })

  const recurring = items.filter(p => !p.specificDate && p.days?.length > 0)
  const oneOff = items.filter(p => p.specificDate)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">Planner</h2>
        <button onClick={() => { resetForm(); setShowForm(s => !s) }} className="btn-primary">
          <Plus size={14}/> Add Item
        </button>
      </div>

      {showForm && (
        <div className="card">
          <div className="card-title">{editId ? 'Edit' : 'Add'} Planner Item</div>
          <form onSubmit={save} className="space-y-3">
            <div>
              <label className="label">Title *</label>
              <input type="text" className="input" placeholder="e.g. Morning cardio"
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Specific Date (or use days)</label>
                <input type="date" className="input" value={form.specificDate}
                  onChange={e => setForm(p => ({ ...p, specificDate: e.target.value, days: [] }))}/>
              </div>
            </div>
            {!form.specificDate && (
              <div>
                <label className="label">Repeat on days</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {DAYS.map(d => (
                    <button type="button" key={d}
                      onClick={() => toggleDay(d)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${form.days.includes(d) ? 'bg-accent text-bg' : 'bg-surfaceAlt text-muted'}`}>
                      {DAY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="label">Notes</label>
              <input type="text" className="input" value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}/>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Add'}</button>
              <button type="button" onClick={resetForm} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Today's items */}
      <div className="card">
        <div className="card-title flex items-center gap-2"><ClipboardList size={16} className="text-accent"/>Today — {todayDate}</div>
        {todayItems.length === 0 ? (
          <p className="text-sm text-muted">Nothing scheduled for today.</p>
        ) : (
          <ul className="space-y-1">
            {todayItems.map(item => (
              <li key={item.id} className="flex items-center justify-between bg-bg rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm text-text">{item.title}</span>
                  {item.notes && <span className="text-xs text-muted ml-2">{item.notes}</span>}
                </div>
                <span className={`text-xs ${item.type === 'habit' ? 'text-accent' : 'text-muted'}`}>{item.type}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recurring */}
      {recurring.length > 0 && (
        <div className="card">
          <div className="card-title">Recurring Items</div>
          <div className="space-y-2">
            {recurring.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-bg rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-text">{item.title}</span>
                  <div className="flex gap-1 mt-1">
                    {(item.days || []).map(d => (
                      <span key={d} className="text-xs bg-surfaceAlt text-muted rounded px-1">{DAY_LABELS[d]}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(item)} className="btn-ghost p-1"><Edit2 size={13}/></button>
                  <button onClick={() => deleteEntry(uid, 'planner', item.id)} className="btn-ghost p-1 text-danger"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* One-off */}
      {oneOff.length > 0 && (
        <div className="card">
          <div className="card-title">Specific Dates</div>
          <div className="space-y-2">
            {oneOff.slice().sort((a, b) => (a.specificDate || '').localeCompare(b.specificDate || '')).map(item => (
              <div key={item.id} className="flex items-center justify-between bg-bg rounded-lg px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-text">{item.title}</span>
                  <span className="text-xs text-muted ml-2">{item.specificDate}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(item)} className="btn-ghost p-1"><Edit2 size={13}/></button>
                  <button onClick={() => deleteEntry(uid, 'planner', item.id)} className="btn-ghost p-1 text-danger"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <div className="card text-center py-8">
          <ClipboardList size={36} className="text-muted mx-auto mb-2"/>
          <p className="text-sm text-muted">No planner items yet — add tasks and habits above.</p>
        </div>
      )}
    </div>
  )
}
