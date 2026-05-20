import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, deleteEntry, getAll } from '../data.js'
import { format, startOfWeek } from 'date-fns'
import { Plus, Trash2, Edit2, ClipboardList, CheckSquare, Square } from 'lucide-react'

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']
const DAY_LABELS = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' }
const TYPES = ['task', 'habit']

export default function Planner() {
  const { user } = useAuth()
  const uid = user?.uid
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ title: '', type: 'task', days: [], specificDate: '', time: '', notes: '' })
  const [completions, setCompletions] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!uid) return
    const unsub = subscribe(uid, 'planner', setItems, { orderByField: 'createdAt' })
    getAll(uid, 'checklistCompletions').then(docs => {
      const map = {}; docs.forEach(d => { map[d.id] = d }); setCompletions(map)
    })
    return unsub
  }, [uid])

  const resetForm = () => {
    setForm({ title: '', type: 'task', days: [], specificDate: '', time: '', notes: '' })
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
        time: form.time || null,
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

  const toggleCompletion = async (item) => {
    const key = `${todayDate}_${item.id}`
    const done = completions[key]?.done
    await setEntry(uid, 'checklistCompletions', key, { date: todayDate, itemId: item.id, done: !done })
    setCompletions(prev => ({ ...prev, [key]: { ...prev[key], done: !done } }))
  }

  const startEdit = (item) => {
    setForm({
      title: item.title || '',
      type: item.type || 'task',
      days: item.days || [],
      specificDate: item.specificDate || '',
      time: item.time || '',
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
                <label className="label">Time (optional)</label>
                <input type="time" className="input" value={form.time || ''}
                  onChange={e => setForm(p => ({ ...p, time: e.target.value }))}/>
              </div>
            </div>
            <div>
              <label className="label">Specific Date (or use recurring days)</label>
              <input type="date" className="input" value={form.specificDate}
                onChange={e => setForm(p => ({ ...p, specificDate: e.target.value, days: [] }))}/>
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
              <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : editId ? 'Update' : 'Add'}</button>
              <button type="button" onClick={resetForm} className="btn-ghost">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Today's items — with completion ticks */}
      <div className="card">
        <div className="card-title flex items-center gap-2"><ClipboardList size={16} className="text-accent"/>Today — {todayDate}</div>
        {todayItems.length === 0 ? (
          <div className="text-center py-6">
            <ClipboardList size={32} className="text-muted/40 mx-auto mb-2"/>
            <p className="text-sm text-muted">Nothing scheduled for today.</p>
            <button onClick={() => setShowForm(true)} className="btn-secondary text-xs mt-2">Add an item</button>
          </div>
        ) : (
          <ul className="space-y-1">
            {todayItems.map(item => {
              const key = `${todayDate}_${item.id}`
              const done = completions[key]?.done
              return (
                <li key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleCompletion(item)}
                  onKeyDown={e => { if (e.key === 'Enter') toggleCompletion(item) }}
                  className="flex items-center gap-3 bg-bg rounded-lg px-3 py-2 cursor-pointer hover:bg-surfaceAlt/60 transition-colors">
                  {done
                    ? <CheckSquare size={16} className="text-success shrink-0"/>
                    : <Square size={16} className="text-muted shrink-0"/>}
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm ${done ? 'line-through text-muted' : 'text-text'}`}>{item.title}</span>
                    {item.time && <span className="text-xs text-accent ml-2">{item.time}</span>}
                    {item.notes && <span className="text-xs text-muted ml-2">{item.notes}</span>}
                  </div>
                  <span className={`text-xs shrink-0 ${item.type === 'habit' ? 'text-accent' : 'text-muted'}`}>{item.type}</span>
                </li>
              )
            })}
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text truncate">{item.title}</span>
                    {item.time && <span className="text-xs text-accent">{item.time}</span>}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {(item.days || []).map(d => (
                      <span key={d} className="text-xs bg-surfaceAlt text-muted rounded px-1">{DAY_LABELS[d]}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{item.title}</span>
                    {item.time && <span className="text-xs text-accent">{item.time}</span>}
                  </div>
                  <span className="text-xs text-muted">{item.specificDate}</span>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button onClick={() => startEdit(item)} className="btn-ghost p-1"><Edit2 size={13}/></button>
                  <button onClick={() => deleteEntry(uid, 'planner', item.id)} className="btn-ghost p-1 text-danger"><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 && !showForm && (
        <div className="card text-center py-10">
          <ClipboardList size={40} className="text-muted/30 mx-auto mb-3"/>
          <p className="text-sm font-medium text-text mb-1">No planner items yet</p>
          <p className="text-xs text-muted mb-3">Add tasks and habits to see them on your Today page checklist.</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm mx-auto">Add your first item</button>
        </div>
      )}
    </div>
  )
}
