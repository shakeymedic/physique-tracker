import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, deleteEntry, getSettings, saveSettings } from '../data.js'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { Trash2, Plus } from 'lucide-react'

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
  const [log, setLog] = useState([])
  const [templates, setTemplates] = useState([])
  const [settings, setSettings] = useState({})
  const [form, setForm] = useState({ date: today(), name: '', kcal: '', protein: '', carbs: '', fat: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const u1 = subscribe(uid, 'nutritionLog', setLog, { limit: 100 })
    const u2 = subscribe(uid, 'mealTemplates', setTemplates, { orderByField: 'createdAt', limit: 50 })
    getSettings(uid).then(setSettings)
    return () => { u1(); u2() }
  }, [uid])

  const todayLog = log.filter(l => l.date === today())
  const totals = todayLog.reduce((acc, n) => ({
    kcal: acc.kcal + (parseFloat(n.kcal) || 0),
    protein: acc.protein + (parseFloat(n.protein) || 0),
    carbs: acc.carbs + (parseFloat(n.carbs) || 0),
    fat: acc.fat + (parseFloat(n.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  const targets = settings.nutritionTargets || {}

  const save = async (e) => {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    try {
      await addEntry(uid, 'nutritionLog', {
        date: form.date,
        name: form.name,
        kcal: parseFloat(form.kcal) || 0,
        protein: parseFloat(form.protein) || 0,
        carbs: parseFloat(form.carbs) || 0,
        fat: parseFloat(form.fat) || 0,
      })
      setForm({ date: today(), name: '', kcal: '', protein: '', carbs: '', fat: '' })
    } finally { setSaving(false) }
  }

  const quickLog = async (t) => {
    await addEntry(uid, 'nutritionLog', { date: today(), name: t.name, kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat })
  }

  const macros = [
    { name: 'Kcal', actual: Math.round(totals.kcal), target: targets.kcal || 2000 },
    { name: 'Protein g', actual: Math.round(totals.protein), target: targets.protein || 160 },
    { name: 'Carbs g', actual: Math.round(totals.carbs), target: targets.carbs || 200 },
    { name: 'Fat g', actual: Math.round(totals.fat), target: targets.fat || 70 },
  ]

  return (
    <div className="space-y-4">
      {/* progress bars */}
      <div className="card">
        <div className="card-title">Today's Macros</div>
        {macros.map(m => {
          const pct = Math.min(100, targets[m.name.split(' ')[0].toLowerCase()] ? (m.actual / m.target) * 100 : 0)
          const colour = pct > 105 ? 'bg-danger' : pct > 80 ? 'bg-success' : 'bg-accent'
          return (
            <div key={m.name} className="mb-3">
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>{m.name}</span>
                <span>{m.actual} / {m.target}</span>
              </div>
              <div className="w-full bg-surfaceAlt rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }}/>
              </div>
            </div>
          )
        })}
      </div>

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

      <div className="card">
        <div className="card-title">Log Meal</div>
        <form onSubmit={save} className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="col-span-2 md:col-span-3">
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}/>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="label">Meal name *</label>
            <input type="text" className="input" placeholder="e.g. Chicken & rice"
              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}/>
          </div>
          {['kcal','protein','carbs','fat'].map(f => (
            <div key={f}>
              <label className="label">{f.charAt(0).toUpperCase() + f.slice(1)}{f !== 'kcal' ? ' (g)' : ''}</label>
              <input type="number" min="0" step="1" className="input" placeholder="0"
                value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}/>
            </div>
          ))}
          <div className="col-span-2 md:col-span-3">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Meal'}</button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-title">Today's Log</div>
        {todayLog.length === 0 ? (
          <p className="text-sm text-muted">No meals logged today yet.</p>
        ) : todayLog.map(l => (
          <div key={l.id} className="flex items-center justify-between bg-bg rounded-lg px-3 py-2 mb-1">
            <span className="text-sm font-medium">{l.name}</span>
            <span className="text-xs text-muted">{l.kcal} kcal · {l.protein}P · {l.carbs}C · {l.fat}F</span>
            <button onClick={() => deleteEntry(uid, 'nutritionLog', l.id)} className="btn-ghost p-1"><Trash2 size={13}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Macros calculator ─────────────────────────────────────────────────────────
function MacrosTab({ uid }) {
  const [form, setForm] = useState({ weight: '', bodyfat: '', activity: 1.55, goal: 0 })
  const [result, setResult] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const calc = () => {
    const w = parseFloat(form.weight)
    const bf = parseFloat(form.bodyfat)
    if (!w || !bf) return
    const lbm = w * (1 - bf / 100)
    const bmr = 370 + 21.6 * lbm // Katch-McArdle
    const tdee = bmr * parseFloat(form.activity)
    const goalAdj = parseFloat(form.goal)
    const kcal = Math.round(tdee * (1 + goalAdj / 100))
    const protein = Math.round(lbm * 2.2)
    const fat = Math.round((kcal * 0.25) / 9)
    const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4)
    setResult({ bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbs, fat })
  }

  const saveTargets = async () => {
    if (!result) return
    setSaving(true)
    try {
      await saveSettings(uid, { nutritionTargets: { kcal: result.kcal, protein: result.protein, carbs: result.carbs, fat: result.fat } })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="card-title">Katch-McArdle Calculator</div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">Weight (kg)</label>
            <input type="number" step="0.1" className="input" value={form.weight}
              onChange={e => setForm(p => ({ ...p, weight: e.target.value }))}/>
          </div>
          <div>
            <label className="label">Body Fat %</label>
            <input type="number" step="0.1" className="input" value={form.bodyfat}
              onChange={e => setForm(p => ({ ...p, bodyfat: e.target.value }))}/>
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
            <select className="input" value={form.goal}
              onChange={e => setForm(p => ({ ...p, goal: e.target.value }))}>
              <option value={-20}>Cut (−20%)</option>
              <option value={0}>Maintain</option>
              <option value={10}>Lean Bulk (+10%)</option>
            </select>
          </div>
        </div>
        <button onClick={calc} className="btn-primary">Calculate</button>

        {result && (
          <div className="mt-4 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">BMR</div>
                <div className="text-accent font-semibold">{result.bmr} kcal</div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">TDEE</div>
                <div className="text-accent font-semibold">{result.tdee} kcal</div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">Target kcal</div>
                <div className="text-accent font-bold text-lg">{result.kcal}</div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">Protein</div>
                <div className="text-text font-semibold">{result.protein}g <span className="text-xs text-muted">({result.protein*4} kcal)</span></div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">Carbs</div>
                <div className="text-text font-semibold">{result.carbs}g <span className="text-xs text-muted">({result.carbs*4} kcal)</span></div>
              </div>
              <div className="bg-bg rounded-lg p-3">
                <div className="text-muted text-xs mb-1">Fat</div>
                <div className="text-text font-semibold">{result.fat}g <span className="text-xs text-muted">({result.fat*9} kcal)</span></div>
              </div>
            </div>
            <button onClick={saveTargets} className="btn-secondary" disabled={saving}>
              {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save as my targets'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Meal Templates ────────────────────────────────────────────────────────────
function MealsTab({ uid }) {
  const [templates, setTemplates] = useState([])
  const [form, setForm] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
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
      })
      setForm({ name: '', kcal: '', protein: '', carbs: '', fat: '' })
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
          {['kcal','protein','carbs','fat'].map(f => (
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
              <span className="text-xs text-muted">{t.kcal} kcal · {t.protein}P · {t.carbs}C · {t.fat}F</span>
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
