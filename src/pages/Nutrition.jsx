import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, deleteEntry, setEntry, getSettings, saveSettings, getAll } from '../data.js'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Trash2, Plus, Scan, Coffee, Pencil, ChevronDown, ChevronRight, Copy } from 'lucide-react'
import BarcodeScanner from '../components/BarcodeScanner.jsx'
import { searchFoodByName, scaleMacros } from '../lib/openfoodfacts.js'
import MicButton from '../components/MicButton.jsx'
import EditableRow from '../components/EditableRow.jsx'
import { TodChip, TodSelect, detectTimeOfDay } from '../lib/timeOfDay.jsx'
import { saveDraft, loadDraft, clearDraft, draftAgo } from '../lib/draft.js'

const today = () => format(new Date(), 'yyyy-MM-dd')

function Tabs({ active, set }) {
  return (
    <div className="flex gap-2 mb-4 flex-wrap">
      {['Today','Macros','Meals','Planner'].map(t => (
        <button key={t} onClick={() => set(t)} className={active === t ? 'btn-primary' : 'btn-secondary'}>{t}</button>
      ))}
    </div>
  )
}

const ACTIVITY = [
  { label: 'Sedentary (1.2)', value: 1.2 },
  { label: 'Lightly active (1.375)', value: 1.375 },
  { label: 'Moderately active (1.55)', value: 1.55 },
  { label: 'Very active (1.725)', value: 1.725 },
  { label: 'Athlete (1.9)', value: 1.9 },
]

// ── Today ─────────────────────────────────────────────────────────────────────
function TodayTab({ uid }) {
  const DRAFT_KEY = `pt-draft-nutrition-${uid}`
  const [log, setLog] = useState([])
  const [templates, setTemplates] = useState([])
  const [settings, setSettings] = useState({})
  const [cardioLog, setCardioLog] = useState([])
  const [liftsLog, setLiftsLog] = useState([])
  const [form, setForm] = useState({ date: today(), timeOfDay: detectTimeOfDay(), name: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '' })
  const [saving, setSaving] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [saveScannedAsTemplate, setSaveScannedAsTemplate] = useState(false)
  const [foodSearch, setFoodSearch] = useState('')
  const [foodResults, setFoodResults] = useState([])
  const [foodSearching, setFoodSearching] = useState(false)
  const [dietBreaks, setDietBreaks] = useState({})
  const [dbSaving, setDbSaving] = useState(false)
  const [editId, setEditId] = useState(null)
  const [draftPrompt, setDraftPrompt] = useState(null)
  const [showTimingBreakdown, setShowTimingBreakdown] = useState(false)
  const [netMode, setNetMode] = useState(false) // subtract cardio kcal from net
  const draftTimer = useRef(null)

  useEffect(() => {
    const u1 = subscribe(uid, 'nutritionLog', setLog, { limit: 200 })
    const u2 = subscribe(uid, 'mealTemplates', setTemplates, { orderByField: 'createdAt', limit: 50 })
    const u3 = subscribe(uid, 'cardio', setCardioLog, { limit: 100 })
    const u4 = subscribe(uid, 'lifts', data => setLiftsLog(data), { limit: 100 })
    getSettings(uid).then(setSettings)
    getAll(uid, 'dietBreaks').then(docs => {
      const map = {}; docs.forEach(d => { map[d.id] = d }); setDietBreaks(map)
    })
    const draft = loadDraft(DRAFT_KEY)
    if (draft?.data?.name) setDraftPrompt(draft)
    return () => { u1(); u2(); u3(); u4() }
  }, [uid])

  useEffect(() => {
    clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      if (form.name) saveDraft(DRAFT_KEY, form)
    }, 500)
  }, [form])

  // Configurable day-end time: if hour < dayEndHour, 'today' is still yesterday
  const dayEndHour = settings.nutritionDayEndHour ?? 0
  const todayStr = (() => {
    const now = new Date()
    if (dayEndHour > 0 && now.getHours() < dayEndHour) {
      const yest = new Date(now)
      yest.setDate(yest.getDate() - 1)
      return format(yest, 'yyyy-MM-dd')
    }
    return today()
  })()
  const todayLog = log.filter(l => l.date === todayStr)
  const totals = todayLog.reduce((acc, n) => ({
    kcal: acc.kcal + (parseFloat(n.kcal) || 0),
    protein: acc.protein + (parseFloat(n.protein) || 0),
    carbs: acc.carbs + (parseFloat(n.carbs) || 0),
    fat: acc.fat + (parseFloat(n.fat) || 0),
    fibre: acc.fibre + (parseFloat(n.fibre) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 })

  // Cardio kcal burned today (from both standalone cardio log and cardio blocks in lifts)
  const todayCardioKcal = (() => {
    const fromCardio = cardioLog
      .filter(c => c.date === todayStr && c.kcal)
      .reduce((acc, c) => acc + (parseFloat(c.kcal) || 0), 0)
    const fromLifts = liftsLog
      .filter(l => l.date === todayStr && l.cardioBlocks?.length)
      .reduce((acc, l) => acc + (l.cardioBlocks || []).reduce((a, cb) => a + (parseFloat(cb.kcal) || 0), 0), 0)
    return fromCardio + fromLifts
  })()

  const activeDietBreak = dietBreaks[todayStr]
  const rawTargets = settings.nutritionTargets || {}
  const targets = activeDietBreak
    ? { kcal: settings.goal?.tdee || rawTargets.kcal || 2000, protein: rawTargets.protein || 160, carbs: rawTargets.carbs || 200, fat: rawTargets.fat || 70, fibre: rawTargets.fibre || 30 }
    : { ...rawTargets, fibre: rawTargets.fibre || 30 }

  const netKcal = netMode ? Math.max(0, totals.kcal - todayCardioKcal) : totals.kcal
  const effectiveKcalTarget = netMode ? targets.kcal : targets.kcal

  // Body weight for protein/kg display
  const bodyWeightKg = settings.profile?.weight || null

  const setRefeed = async (type) => {
    setDbSaving(true)
    try {
      await setEntry(uid, 'dietBreaks', todayStr, { date: todayStr, type })
      setDietBreaks(prev => ({ ...prev, [todayStr]: { date: todayStr, type } }))
    } finally { setDbSaving(false) }
  }

  const setDietBreakWeek = async () => {
    setDbSaving(true)
    try {
      for (let i = 0; i < 7; i++) {
        const d = new Date(); d.setDate(d.getDate() + i)
        const ds = format(d, 'yyyy-MM-dd')
        await setEntry(uid, 'dietBreaks', ds, { date: ds, type: 'break' })
      }
      const refreshed = await getAll(uid, 'dietBreaks')
      const map = {}; refreshed.forEach(d => { map[d.id] = d }); setDietBreaks(map)
    } finally { setDbSaving(false) }
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    try {
      const data = {
        date: form.date,
        timeOfDay: form.timeOfDay || null,
        name: form.name,
        kcal: parseFloat(form.kcal) || 0,
        protein: parseFloat(form.protein) || 0,
        carbs: parseFloat(form.carbs) || 0,
        fat: parseFloat(form.fat) || 0,
        fibre: parseFloat(form.fibre) || 0,
      }
      if (editId) {
        await setEntry(uid, 'nutritionLog', editId, data)
        setEditId(null)
      } else {
        await addEntry(uid, 'nutritionLog', data)
      }
      if (saveScannedAsTemplate && form.name && form.kcal) {
        await addEntry(uid, 'mealTemplates', {
          name: form.name,
          kcal: parseFloat(form.kcal) || 0,
          protein: parseFloat(form.protein) || 0,
          carbs: parseFloat(form.carbs) || 0,
          fat: parseFloat(form.fat) || 0,
          fibre: parseFloat(form.fibre) || 0,
        })
        setSaveScannedAsTemplate(false)
      }
      clearDraft(DRAFT_KEY)
      setForm({ date: today(), timeOfDay: detectTimeOfDay(), name: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '' })
    } finally { setSaving(false) }
  }

  const startEdit = (entry) => {
    setForm({
      date: entry.date,
      timeOfDay: entry.timeOfDay || null,
      name: entry.name || '',
      kcal: String(entry.kcal || ''),
      protein: String(entry.protein || ''),
      carbs: String(entry.carbs || ''),
      fat: String(entry.fat || ''),
      fibre: String(entry.fibre || ''),
    })
    setEditId(entry.id)
  }

  const cancelEdit = () => {
    setEditId(null)
    setForm({ date: today(), timeOfDay: detectTimeOfDay(), name: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '' })
  }

  const quickLog = async (t) => {
    await addEntry(uid, 'nutritionLog', {
      date: today(), timeOfDay: detectTimeOfDay(),
      name: t.name, kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat, fibre: t.fibre || 0,
    })
  }

  const copyYesterday = async () => {
    const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd')
    const yesterdayMeals = log.filter(l => l.date === yesterday)
    if (!yesterdayMeals.length) return
    for (const meal of yesterdayMeals) {
      const { id, createdAt, updatedAt, ...rest } = meal
      await addEntry(uid, 'nutritionLog', { ...rest, date: todayStr, timeOfDay: meal.timeOfDay || null })
    }
  }

  const handleFoodSearch = async (q) => {
    setFoodSearch(q)
    if (q.trim().length < 3) { setFoodResults([]); return }
    setFoodSearching(true)
    try {
      const results = await searchFoodByName(q, 8)
      setFoodResults(results)
    } catch (e) { setFoodResults([]) }
    finally { setFoodSearching(false) }
  }

  const applyFoodResult = (product, portionG = 100) => {
    const scaled = scaleMacros(product, portionG)
    setForm(p => ({
      ...p,
      name: product.name,
      kcal: String(Math.round(scaled.kcal)),
      protein: String(Math.round(scaled.protein * 10) / 10),
      carbs: String(Math.round(scaled.carbs * 10) / 10),
      fat: String(Math.round(scaled.fat * 10) / 10),
    }))
    setFoodResults([])
    setFoodSearch('')
  }

  const handleScanResult = ({ name, kcal, protein, carbs, fat }) => {
    setForm(p => ({ ...p, name, kcal: String(kcal), protein: String(protein), carbs: String(carbs), fat: String(fat) }))
  }

  const hasTargets = !!(rawTargets.kcal && rawTargets.protein)

  // Macro bars config
  const macros = [
    {
      key: 'kcal',
      name: netMode ? 'Net Kcal' : 'Kcal',
      actual: Math.round(netMode ? netKcal : totals.kcal),
      target: effectiveKcalTarget || 2000,
      extra: netMode && todayCardioKcal > 0
        ? `${totals.kcal.toFixed(0)} eaten − ${todayCardioKcal.toFixed(0)} burned`
        : null,
    },
    {
      key: 'protein',
      name: 'Protein',
      actual: Math.round(totals.protein),
      target: targets.protein || 160,
      unit: 'g',
      perKg: bodyWeightKg ? (totals.protein / bodyWeightKg).toFixed(1) : null,
    },
    { key: 'carbs', name: 'Carbs', actual: Math.round(totals.carbs), target: targets.carbs || 200, unit: 'g' },
    { key: 'fat',   name: 'Fat',   actual: Math.round(totals.fat),   target: targets.fat   || 70,  unit: 'g' },
    { key: 'fibre', name: 'Fibre', actual: Math.round(totals.fibre), target: targets.fibre || 30,  unit: 'g' },
  ]

  // Time-of-day breakdown
  const TOD_SLOTS = ['Morning', 'Afternoon', 'Evening', 'Night']
  const timingTotals = TOD_SLOTS.map(slot => {
    const meals = todayLog.filter(l => (l.timeOfDay || 'Morning') === slot)
    return {
      slot,
      kcal: Math.round(meals.reduce((a, m) => a + (parseFloat(m.kcal) || 0), 0)),
      protein: Math.round(meals.reduce((a, m) => a + (parseFloat(m.protein) || 0), 0)),
      count: meals.length,
    }
  }).filter(s => s.count > 0)

  return (
    <div className="space-y-4">
      <BarcodeScanner open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScanResult}/>

      {draftPrompt && (
        <div className="card border-accent/30 bg-accent/5">
          <div className="flex items-center justify-between">
            <p className="text-sm">Unsaved meal from <span className="text-accent">{draftAgo(draftPrompt.at)}</span> — restore?</p>
            <div className="flex gap-2">
              <button onClick={() => { setForm(draftPrompt.data); setDraftPrompt(null) }} className="btn-primary text-xs">Restore</button>
              <button onClick={() => { clearDraft(DRAFT_KEY); setDraftPrompt(null) }} className="btn-ghost text-xs">Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Diet adherence panel */}
      <div className="card">
        <div className="card-title flex items-center gap-2"><Coffee size={16} className="text-accent"/>Diet Adherence</div>
        {activeDietBreak ? (
          <div className="flex items-center gap-3">
            <span className="chip-warn">{activeDietBreak.type === 'refeed' ? 'Refeed day' : 'Diet break'}</span>
            <span className="text-xs text-muted">Maintenance calories active today</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setRefeed('refeed')} disabled={dbSaving} className="btn-secondary text-xs">Today is a refeed day</button>
            <button onClick={setDietBreakWeek} disabled={dbSaving} className="btn-secondary text-xs">Diet break (1 week)</button>
          </div>
        )}
      </div>

      {/* Macro progress bars */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <span className="card-title">Today's Macros</span>
          <div className="flex gap-2 items-center">
            {todayCardioKcal > 0 && (
              <button
                onClick={() => setNetMode(n => !n)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${netMode ? 'bg-success/20 text-success border-success/40' : 'bg-surfaceAlt text-muted border-border/30'}`}
              >
                Net {netMode ? 'on' : 'off'}
              </button>
            )}
            <button onClick={() => setScanOpen(true)} className="btn-secondary text-xs flex items-center gap-1">
              <Scan size={13}/> Scan
            </button>
          </div>
        </div>

        {!hasTargets ? (
          <p className="text-sm text-muted">Set your macro targets in <span className="text-accent">Nutrition → Macros</span> to see progress bars.</p>
        ) : macros.map(m => {
          const rawPct = (m.actual / m.target) * 100
          const isOver = rawPct > 100
          const displayPct = Math.min(100, rawPct) // bar caps at 100%, over shown by colour
          const colour = isOver ? 'bg-danger' : rawPct >= 90 ? 'bg-success' : 'bg-accent'
          return (
            <div key={m.key} className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted">{m.name}</span>
                  {m.key === 'protein' && m.perKg && (
                    <span className="text-accent/70">{m.perKg} g/kg</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {isOver && <span className="text-danger font-semibold">+{Math.round(m.actual - m.target)}{m.unit || ''} over</span>}
                  <span className={`font-medium ${isOver ? 'text-danger' : 'text-text'}`}>{m.actual}{m.unit || ''} / {m.target}{m.unit || ''}</span>
                </div>
              </div>
              {m.extra && <p className="text-xs text-muted mb-1">{m.extra}</p>}
              <div className="w-full bg-surfaceAlt rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${colour}`} style={{ width: `${displayPct}%` }}/>
              </div>
            </div>
          )
        })}

        {netMode && todayCardioKcal > 0 && (
          <p className="text-xs text-muted mt-1">Cardio burn today: <span className="text-success">{todayCardioKcal.toFixed(0)} kcal</span></p>
        )}
      </div>

      {/* H: Sticky macro mini-bar */}
      {hasTargets && (
        <div className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border/20 -mx-4 px-4 py-2 flex gap-4 text-xs">
          <span className={totals.kcal > (targets.kcal || 2000) ? 'text-danger font-semibold' : 'text-muted'}>
            Kcal: <span className="text-text font-medium">{Math.round(totals.kcal)}</span>/{targets.kcal || 2000}
          </span>
          <span className={totals.protein >= (targets.protein || 160) ? 'text-success font-semibold' : 'text-muted'}>
            P: <span className="text-text font-medium">{Math.round(totals.protein)}</span>g/{targets.protein || 160}g
          </span>
          <span className="text-muted ml-auto">
            {Math.max(0, (targets.kcal || 2000) - Math.round(totals.kcal))} kcal remaining
          </span>
        </div>
      )}

      {/* Meal timing breakdown */}
      {todayLog.length > 1 && (
        <div className="card">
          <button
            onClick={() => setShowTimingBreakdown(s => !s)}
            className="text-xs text-muted hover:text-text flex items-center gap-1 w-full text-left"
          >
            {showTimingBreakdown ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
            Meal timing breakdown
          </button>
          {showTimingBreakdown && timingTotals.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {timingTotals.map(s => (
                <div key={s.slot} className="bg-surfaceAlt rounded-xl p-3">
                  <div className="text-xs text-muted mb-1">{s.slot}</div>
                  <div className="text-sm font-semibold text-text">{s.kcal} kcal</div>
                  <div className="text-xs text-muted">{s.protein}g protein · {s.count} meal{s.count !== 1 ? 's' : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick log templates */}
      {templates.length > 0 && (
        <div className="card">
          <div className="card-title">Quick Log</div>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => quickLog(t)} className="btn-secondary text-xs">{t.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* I: Frequently logged meals */}
      {(() => {
        const freq = {}
        log.forEach(l => { if (l.name) freq[l.name] = (freq[l.name] || 0) + 1 })
        const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5)
        if (!top.length) return null
        return (
          <div className="card">
            <div className="card-title text-sm">Frequently logged</div>
            <div className="flex flex-wrap gap-2">
              {top.map(([name]) => {
                const tpl = templates.find(t => t.name === name)
                return (
                  <button key={name} onClick={() => tpl && quickLog(tpl)} disabled={!tpl}
                    className="btn-secondary text-xs" title={tpl ? 'Quick-log' : 'No template found'}>
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {editId && (
        <div className="card border-warn/30 bg-warn/5">
          <p className="text-sm text-warn">Editing meal. <button onClick={cancelEdit} className="underline">Cancel</button></p>
        </div>
      )}

      {/* Log meal form */}
      {/* Food name search */}
      <div className="card">
        <div className="card-title flex items-center gap-2">
          <span className="text-accent">&#x1F50D;</span> Search Food Database
        </div>
        <p className="text-xs text-muted mb-2">Search Open Food Facts by name — fills the log form automatically.</p>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="e.g. chicken breast, protein bar..."
            value={foodSearch}
            onChange={e => handleFoodSearch(e.target.value)}
          />
          {foodSearching && <span className="text-xs text-muted self-center">Searching...</span>}
        </div>
        {foodResults.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {foodResults.map((r, i) => (
              <button key={i} onClick={() => applyFoodResult(r, 100)}
                className="w-full text-left bg-surfaceAlt hover:bg-accent/10 rounded-xl px-3 py-2 transition-colors">
                <div className="text-sm text-text font-medium truncate">{r.name}</div>
                <div className="text-xs text-muted">per 100g: {Math.round(r.kcalPer100g)} kcal · {r.proteinPer100g?.toFixed(1)}P · {r.carbsPer100g?.toFixed(1)}C · {r.fatPer100g?.toFixed(1)}F</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">{editId ? 'Edit Meal' : 'Log Meal'}</div>
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
          <div className="col-span-2 md:col-span-1">
            <label className="label">Meal name *</label>
            <div className="flex gap-2">
              <input type="text" className="input" placeholder="e.g. Chicken & rice"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
              <MicButton onTranscript={t => setForm(p => ({ ...p, name: t }))}/>
            </div>
          </div>
          {form.name && form.kcal && (
            <div className="col-span-2 md:col-span-3 flex items-center gap-2">
              <input type="checkbox" id="saveTemplate" className="w-4 h-4 accent-accent"
                checked={saveScannedAsTemplate}
                onChange={e => setSaveScannedAsTemplate(e.target.checked)}/>
              <label htmlFor="saveTemplate" className="text-xs text-muted">Save as quick-log template</label>
            </div>
          )}
          {[
            { key: 'kcal', label: 'Kcal' },
            { key: 'protein', label: 'Protein (g)' },
            { key: 'carbs', label: 'Carbs (g)' },
            { key: 'fat', label: 'Fat (g)' },
            { key: 'fibre', label: 'Fibre (g)' },
          ].map(f => (
            <div key={f.key}>
              <label className="label">{f.label}</label>
              <input type="number" min="0" step="1" className="input" placeholder="0"
                value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}/>
            </div>
          ))}
          <div className="col-span-2 md:col-span-3 flex gap-2 flex-wrap">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : editId ? 'Update Meal' : 'Add Meal'}</button>
            {editId && <button type="button" onClick={cancelEdit} className="btn-secondary">Cancel</button>}
          </div>
        </form>
      </div>

      {/* Today's log */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="card-title">Today's Log</div>
          <button onClick={copyYesterday} className="btn-ghost text-xs flex items-center gap-1">
            <Copy size={12}/> Copy yesterday
          </button>
        </div>
        {todayLog.length === 0 ? (
          <p className="text-sm text-muted">No meals logged today yet.</p>
        ) : todayLog.map(l => {
          const mealProtein = parseFloat(l.protein) || 0
          const proteinPerKg = bodyWeightKg ? (mealProtein / bodyWeightKg).toFixed(2) : null
          return (
            <EditableRow key={l.id}
              onEdit={() => startEdit(l)}
              onDelete={() => deleteEntry(uid, 'nutritionLog', l.id)}
              className="mb-1"
            >
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{l.name}</span>
                  <TodChip tod={l.timeOfDay}/>
                </div>
                <div className="text-xs text-muted">
                  {l.kcal} kcal · {l.protein}g P
                  {proteinPerKg && <span className="text-accent/70 ml-1">({proteinPerKg} g/kg)</span>}
                  {' '}· {l.carbs}g C · {l.fat}g F
                  {l.fibre > 0 && <span> · {l.fibre}g fibre</span>}
                </div>
              </div>
            </EditableRow>
          )
        })}
      </div>
    </div>
  )
}

// ── Macros calculator ─────────────────────────────────────────────────────────
// Goal-driven: user picks a target rate of weight change (kg/week) and we work out
// the daily kcal delta from the 7700 kcal-per-kg-of-fat heuristic, capping the
// rate to safe ranges (≤1% bodyweight/week loss; ≤0.5% gain). Macros are
// computed from user-customisable preferences: protein g/kg bodyweight,
// fat % of total kcal, with carbs filling the remainder. Kcal floor is user-set.
const DEFAULT_PROTEIN_BASIS = 'bodyweight' // 'bodyweight' | 'lbm'
const DEFAULT_PROTEIN_PER_KG = 2.0
const DEFAULT_FAT_PCT = 25
const DEFAULT_KCAL_FLOOR = 1500

function MacrosTab({ uid }) {
  const [form, setForm] = useState({
    weight: '', bodyfat: '', activity: 1.55,
    goalType: 'lose', // 'lose' | 'maintain' | 'gain'
    rateKgPerWeek: 0.5,
    targetWeight: '',
    // Personalisation
    proteinBasis: DEFAULT_PROTEIN_BASIS,
    proteinPerKg: DEFAULT_PROTEIN_PER_KG,
    fatPct: DEFAULT_FAT_PCT,
    kcalFloor: DEFAULT_KCAL_FLOOR,
  })
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // pre-fill from latest weight + saved macro prefs on mount
  useEffect(() => {
    let alive = true
    ;(async () => {
      const { getAll } = await import('../data.js')
      const [rows, settings] = await Promise.all([
        getAll(uid, 'weights', { orderByField: 'date', dir: 'desc' }),
        getSettings(uid),
      ])
      if (!alive) return
      const prefs = settings.macroPrefs || {}
      setForm(p => ({
        ...p,
        weight: p.weight || (rows[0]?.weight != null ? String(rows[0].weight) : ''),
        bodyfat: p.bodyfat || (rows[0]?.bodyfat ? String(rows[0].bodyfat) : ''),
        proteinBasis: prefs.proteinBasis ?? DEFAULT_PROTEIN_BASIS,
        proteinPerKg: prefs.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG,
        fatPct: prefs.fatPct ?? DEFAULT_FAT_PCT,
        kcalFloor: prefs.kcalFloor ?? DEFAULT_KCAL_FLOOR,
      }))
    })()
    return () => { alive = false }
  }, [uid])

  const calc = () => {
    const w = parseFloat(form.weight)
    const bf = parseFloat(form.bodyfat)
    if (!w || !bf) return

    const lbm = w * (1 - bf / 100)
    const bmr = 370 + 21.6 * lbm // Katch-McArdle
    const tdee = bmr * parseFloat(form.activity)

    // Cap rates to safe limits and derive daily kcal delta from 7700 kcal/kg fat.
    let rate = parseFloat(form.rateKgPerWeek) || 0
    let cappedRate = rate
    let warning = ''
    if (form.goalType === 'lose') {
      const safeMax = +(w * 0.01).toFixed(2) // 1%/week
      if (rate > safeMax) { cappedRate = safeMax; warning = `Capped to safe max of ${safeMax} kg/week (1% of bodyweight).` }
    } else if (form.goalType === 'gain') {
      const safeMax = +(w * 0.005).toFixed(2) // 0.5%/week to limit fat gain
      if (rate > safeMax) { cappedRate = safeMax; warning = `Capped to ${safeMax} kg/week to limit fat gain (0.5% of bodyweight).` }
    } else {
      cappedRate = 0
    }

    const dailyDelta = (form.goalType === 'lose' ? -1 : form.goalType === 'gain' ? 1 : 0) * (cappedRate * 7700 / 7)
    let kcal = Math.round(tdee + dailyDelta)

    // Floor: lower of (user's kcal floor, BMR). This intentionally lets kcal
    // dip below BMR if the user has set a lower kcal floor — the user's setting
    // wins. Note: prolonged intake below BMR is not recommended; the calculator
    // surfaces a soft warning instead of overriding the value.
    const userFloor = parseFloat(form.kcalFloor) || DEFAULT_KCAL_FLOOR
    const bmrFloor = Math.round(bmr)
    const effectiveFloor = Math.min(userFloor, bmrFloor)
    if (kcal < effectiveFloor) {
      kcal = effectiveFloor
      const reason = effectiveFloor === userFloor
        ? `Kcal floored at your minimum (${userFloor}).`
        : `Kcal floored at BMR (${bmrFloor}).`
      warning = (warning ? warning + ' ' : '') + reason
    }
    if (kcal < bmrFloor) {
      warning = (warning ? warning + ' ' : '') + `Note: ${kcal} kcal is below your BMR (${bmrFloor}). Prolonged intake below BMR is generally not advised.`
    }

    // Protein: based on bodyweight or LBM, multiplied by g/kg preference
    const proteinPerKg = parseFloat(form.proteinPerKg) || DEFAULT_PROTEIN_PER_KG
    const proteinBase = form.proteinBasis === 'lbm' ? lbm : w
    const protein = Math.round(proteinBase * proteinPerKg)

    // Fat: percentage of total kcal
    const fatPct = parseFloat(form.fatPct) || DEFAULT_FAT_PCT
    const fat = Math.round((kcal * (fatPct / 100)) / 9)

    // Carbs fill the remainder
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))

    // Sanity: if protein + fat alone exceed kcal target, flag it
    if (protein * 4 + fat * 9 > kcal) {
      warning = (warning ? warning + ' ' : '') + `Protein + fat alone exceed your kcal target — carbs set to 0. Consider lowering protein g/kg or fat %.`
    }

    // Time to target (if set)
    let timeToTarget = null
    const tw = parseFloat(form.targetWeight)
    if (tw && cappedRate > 0 && form.goalType !== 'maintain') {
      const diff = Math.abs(w - tw)
      const weeks = diff / cappedRate
      timeToTarget = { weeks: Math.round(weeks), eta: addWeeksISO(weeks) }
    }

    setResult({
      bmr: Math.round(bmr), tdee: Math.round(tdee), kcal,
      protein, carbs, fat,
      proteinBase: form.proteinBasis, proteinPerKg, fatPct,
      cappedRate, dailyDelta: Math.round(dailyDelta), warning, timeToTarget,
    })
  }

  const saveTargets = async () => {
    if (!result) return
    setSaving(true)
    try {
      await saveSettings(uid, {
        nutritionTargets: { kcal: result.kcal, protein: result.protein, carbs: result.carbs, fat: result.fat, fibre: 30 },
        goal: {
          type: form.goalType,
          rateKgPerWeek: result.cappedRate,
          targetWeight: form.targetWeight ? parseFloat(form.targetWeight) : null,
          updatedAt: new Date().toISOString(),
        },
        macroPrefs: {
          proteinBasis: form.proteinBasis,
          proteinPerKg: parseFloat(form.proteinPerKg) || DEFAULT_PROTEIN_PER_KG,
          fatPct: parseFloat(form.fatPct) || DEFAULT_FAT_PCT,
          kcalFloor: parseFloat(form.kcalFloor) || DEFAULT_KCAL_FLOOR,
        },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Goal-Driven Macros</div>
        <p className="text-xs text-muted mb-3">Uses the Katch-McArdle formula. Set a goal type and target rate — we'll work out the daily calorie delta and macros, capped to safe limits.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="label">Weight (kg)</label>
            <input type="number" step="0.1" className="input" value={form.weight}
              inputMode="decimal" onChange={e => setForm(p => ({ ...p, weight: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Body Fat %</label>
            <input type="number" step="0.1" className="input" value={form.bodyfat}
              inputMode="decimal" onChange={e => setForm(p => ({ ...p, bodyfat: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Activity</label>
            <select className="input" value={form.activity}
              onChange={e => setForm(p => ({ ...p, activity: e.target.value }))}>
              {ACTIVITY.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Goal</label>
            <select className="input" value={form.goalType}
              onChange={e => setForm(p => ({ ...p, goalType: e.target.value }))}>
              <option value="lose">Lose fat</option>
              <option value="maintain">Maintain</option>
              <option value="gain">Lean gain</option>
            </select>
          </div>
          {form.goalType !== 'maintain' && (
            <>
              <div>
                <label className="label">Rate (kg/week)</label>
                <input type="number" step="0.1" min="0" className="input" value={form.rateKgPerWeek}
                  inputMode="decimal" onChange={e => setForm(p => ({ ...p, rateKgPerWeek: e.target.value }))}/>
              </div>
              <div>
                <label className="label">Target weight (kg, optional)</label>
                <input type="number" step="0.1" className="input" placeholder="e.g. 90" value={form.targetWeight}
                  inputMode="decimal" onChange={e => setForm(p => ({ ...p, targetWeight: e.target.value }))}/>
              </div>
            </>
          )}
        </div>

        {/* Advanced personalisation — collapsible */}
        <button type="button" onClick={() => setShowAdvanced(s => !s)}
          className="text-xs text-muted hover:text-text mb-3 flex items-center gap-1">
          {showAdvanced ? '▾' : '▸'} Advanced preferences (protein/fat targets, kcal floor)
        </button>
        {showAdvanced && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 p-3 bg-bg rounded-lg">
            <div>
              <label className="label">Protein basis</label>
              <select className="input" value={form.proteinBasis}
                onChange={e => setForm(p => ({ ...p, proteinBasis: e.target.value }))}>
                <option value="bodyweight">Per kg bodyweight</option>
                <option value="lbm">Per kg lean mass</option>
              </select>
            </div>
            <div>
              <label className="label">Protein (g/kg)</label>
              <input type="number" step="0.1" min="0.5" max="4" className="input" value={form.proteinPerKg}
                inputMode="decimal" onChange={e => setForm(p => ({ ...p, proteinPerKg: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Fat (% of kcal)</label>
              <input type="number" step="1" min="15" max="50" className="input" value={form.fatPct}
                onChange={e => setForm(p => ({ ...p, fatPct: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Kcal floor</label>
              <input type="number" step="50" min="1000" max="3000" className="input" value={form.kcalFloor}
                onChange={e => setForm(p => ({ ...p, kcalFloor: e.target.value }))}/>
            </div>
            <p className="col-span-2 md:col-span-4 text-xs text-muted">
              Defaults: 2.0 g/kg bodyweight protein, 25% fat, 1500 kcal floor. Saved with your targets.
            </p>
          </div>
        )}

        <button onClick={calc} className="btn-primary">Calculate</button>

        {result && (
          <div className="mt-4 space-y-3">
            {result.warning && (
              <div className="text-xs text-warn bg-warn/10 rounded-lg px-3 py-2">⚠ {result.warning}</div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">BMR</div>
                <div className="text-accent font-semibold">{result.bmr} kcal</div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">TDEE (maintenance)</div>
                <div className="text-accent font-semibold">{result.tdee} kcal</div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">Daily {result.dailyDelta < 0 ? 'deficit' : result.dailyDelta > 0 ? 'surplus' : 'delta'}</div>
                <div className="font-semibold" style={{ color: result.dailyDelta < 0 ? '#ef4444' : result.dailyDelta > 0 ? '#10b981' : '#94a3b8' }}>
                  {result.dailyDelta > 0 ? '+' : ''}{result.dailyDelta} kcal/day
                </div>
              </div>
              <div className="bg-bg rounded-lg p-3 col-span-2 md:col-span-3">
                <div className="text-muted text-xs mb-1">Daily kcal target</div>
                <div className="text-accent font-bold text-2xl">{result.kcal}</div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">Protein <span className="text-[10px]">({result.proteinPerKg}g/kg {result.proteinBase === 'lbm' ? 'LBM' : 'BW'})</span></div>
                <div className="text-text font-semibold">{result.protein}g <span className="text-xs text-muted">({result.protein*4} kcal)</span></div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">Carbs</div>
                <div className="text-text font-semibold">{result.carbs}g <span className="text-xs text-muted">({result.carbs*4} kcal)</span></div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">Fat <span className="text-[10px]">({result.fatPct}%)</span></div>
                <div className="text-text font-semibold">{result.fat}g <span className="text-xs text-muted">({result.fat*9} kcal)</span></div>
              </div>
            </div>

            {result.timeToTarget && (
              <div className="text-sm text-muted bg-bg rounded-lg px-3 py-2">
                At {result.cappedRate} kg/week → ~{result.timeToTarget.weeks} weeks to target. ETA <span className="text-text">{result.timeToTarget.eta}</span>.
              </div>
            )}

            <button onClick={saveTargets} className="btn-primary" disabled={saving}>
              {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save as my targets'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function addWeeksISO(weeks) {
  const d = new Date()
  d.setDate(d.getDate() + Math.round(weeks * 7))
  return format(d, 'd MMM yyyy')
}

// ── Meal Templates ────────────────────────────────────────────────────────────
function MealsTab({ uid }) {
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => subscribe(uid, 'mealTemplates', setTemplates, { orderByField: 'createdAt', limit: 100 }), [uid])

  const save = async (e) => {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    try {
      await addEntry(uid, 'mealTemplates', {
        name: form.name,
        kcal: parseFloat(form.kcal) || 0,
        protein: parseFloat(form.protein) || 0,
        carbs: parseFloat(form.carbs) || 0,
        fat: parseFloat(form.fat) || 0,
        fibre: parseFloat(form.fibre) || 0,
      })
      setForm({ name: '', kcal: '', protein: '', carbs: '', fat: '', fibre: '' })
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Add Meal Template</div>
        <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2 md:col-span-3">
            <label className="label">Name *</label>
            <input type="text" className="input" value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
          </div>
          {['kcal','protein','carbs','fat','fibre'].map(f => (
            <div key={f}>
              <label className="label">{f}</label>
              <input type="number" min="0" className="input" value={form[f]}
                onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}/>
            </div>
          ))}
          <div className="col-span-2 md:col-span-3">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Template'}</button>
          </div>
        </form>
      </div>
      <div className="card">
        <div className="card-title">Saved Templates</div>
        {templates.length === 0 ? <p className="text-sm text-muted">No meal templates yet.</p> :
          templates.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-bg rounded-lg px-3 py-2 mb-1">
              <span className="text-sm font-medium">{t.name}</span>
              <span className="text-xs text-muted">{t.kcal} kcal · {t.protein}P · {t.carbs}C · {t.fat}F{t.fibre > 0 ? ` · ${t.fibre}g fibre` : ''}</span>
              <button onClick={() => deleteEntry(uid, 'mealTemplates', t.id)} className="btn-ghost p-1"><Trash2 size={13}/></button>
            </div>
          ))
        }
      </div>
    </div>
  )
}

// ── Meal Planner (Spoonacular) ────────────────────────────────────────────────
function MealPlannerTab({ uid }) {
  const [settings, setSettings] = useState({})
  const [plan, setPlan] = useState(null)
  const [grocery, setGrocery] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getSettings(uid).then(setSettings) }, [uid])

  const generate = async () => {
    const key = settings.spoonacularKey
    if (!key) return
    const target = settings.nutritionTargets?.kcal || 2000
    setLoading(true); setError('')
    try {
      const url = `https://api.spoonacular.com/mealplanner/generate?timeFrame=day&targetCalories=${target}&apiKey=${key}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data = await res.json()
      setPlan(data)
      setGrocery(null)
    } catch (e) {
      setError(e.message)
    } finally { setLoading(false) }
  }

  const buildGrocery = () => {
    if (!plan?.meals) return
    const ingredients = []
    plan.meals.forEach(m => {
      if (m.sourceUrl) ingredients.push(`${m.title} — see: ${m.sourceUrl}`)
    })
    setGrocery(ingredients)
  }

  if (!settings.spoonacularKey) return (
    <div className="card">
      <div className="card-title">Meal Planner</div>
      <p className="text-sm text-muted mb-3">Connect a Spoonacular API key to auto-generate daily meal plans based on your calorie target.</p>
      <p className="text-sm text-muted">Add your key in <span className="text-accent">Settings → Spoonacular API Key</span>.</p>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Generate Day Plan</div>
        <p className="text-sm text-muted mb-3">Target: {settings.nutritionTargets?.kcal || 2000} kcal</p>
        <button onClick={generate} className="btn-primary" disabled={loading}>{loading ? 'Generating…' : 'Generate Plan'}</button>
        {error && <p className="text-sm text-danger mt-2">{error}</p>}
      </div>
      {plan?.meals && (
        <div className="card">
          <div className="card-title">Today's Meals</div>
          {plan.meals.map((m, i) => (
            <div key={i} className="bg-bg rounded-lg p-3 mb-2">
              <div className="font-medium text-sm mb-1">{m.title}</div>
              {m.readyInMinutes && <div className="text-xs text-muted">Ready in {m.readyInMinutes} min · {m.servings} serving(s)</div>}
              {m.sourceUrl && <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline">View recipe</a>}
            </div>
          ))}
          {plan.nutrients && (
            <div className="text-xs text-muted mt-2">
              ~{Math.round(plan.nutrients.calories)} kcal · P: {Math.round(plan.nutrients.protein)}g · C: {Math.round(plan.nutrients.carbohydrates)}g · F: {Math.round(plan.nutrients.fat)}g
            </div>
          )}
          <button onClick={buildGrocery} className="btn-secondary mt-3">Build Grocery List</button>
        </div>
      )}
      {grocery && (
        <div className="card">
          <div className="card-title">Grocery List</div>
          <ul className="space-y-1">
            {grocery.map((g, i) => <li key={i} className="text-sm text-muted">• {g}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function Nutrition() {
  const { user } = useAuth()
  const uid = user?.uid
  const [tab, setTab] = useState('Today')
  return (
    <div>
      <Tabs active={tab} set={setTab}/>
      {tab === 'Today' && <TodayTab uid={uid}/>}
      {tab === 'Macros' && <MacrosTab uid={uid}/>}
      {tab === 'Meals' && <MealsTab uid={uid}/>}
      {tab === 'Planner' && <MealPlannerTab uid={uid}/>}
    </div>
  )
}
