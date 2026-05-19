import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, getAll, getSettings, setEntry } from '../data.js'
import { format, subDays, isToday, parseISO } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'
import { CheckSquare, Square, TrendingUp, Dumbbell, Droplets, Activity } from 'lucide-react'
import { flag } from '../clinical/ranges.js'

function FlagChip({ name, value, sex }) {
  const f = flag(name, value, sex)
  if (!f) return <span className="text-sm text-muted">{value ?? '—'}</span>
  const cls = { ok: 'chip-ok', warn: 'chip-warn', bad: 'chip-bad' }[f]
  return <span className={cls}>{value}</span>
}

export default function Dashboard() {
  const { user } = useAuth()
  const uid = user?.uid
  const [weights, setWeights] = useState([])
  const [lifts, setLifts] = useState([])
  const [bloods, setBloods] = useState([])
  const [nutrition, setNutrition] = useState([])
  const [planner, setPlanner] = useState([])
  const [completions, setCompletions] = useState({})
  const [settings, setSettings] = useState({})

  useEffect(() => {
    if (!uid) return
    const today = format(new Date(), 'yyyy-MM-dd')
    const u1 = subscribe(uid, 'weights', setWeights, { limit: 90 })
    const u2 = subscribe(uid, 'lifts', setLifts, { limit: 200 })
    const u3 = subscribe(uid, 'bloods', setBloods, { limit: 50 })
    const u4 = subscribe(uid, 'nutritionLog', setNutrition, { limit: 50 })
    const u5 = subscribe(uid, 'planner', setPlanner, { orderByField: 'createdAt' })
    getAll(uid, 'checklistCompletions').then(docs => {
      const map = {}
      docs.forEach(d => { map[d.id] = d })
      setCompletions(map)
    })
    getSettings(uid).then(setSettings)
    return () => { u1(); u2(); u3(); u4(); u5() }
  }, [uid])

  // --- Weight trend (last 30d) ---
  const today = format(new Date(), 'yyyy-MM-dd')
  const w30 = weights.filter(w => w.date >= format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    .slice().sort((a, b) => a.date.localeCompare(b.date))
  // 7-day rolling avg
  const weightData = w30.map((w, i) => {
    const slice = w30.slice(Math.max(0, i - 6), i + 1)
    const avg = slice.reduce((s, x) => s + parseFloat(x.weight || 0), 0) / slice.length
    return { date: w.date.slice(5), weight: parseFloat(w.weight), avg: parseFloat(avg.toFixed(1)) }
  })

  // --- Planner checklist (today) ---
  const dayName = format(new Date(), 'EEE').toLowerCase().slice(0, 3)
  const todayItems = planner.filter(p => {
    if (!p.days && !p.specificDate) return false
    if (p.specificDate) return p.specificDate === today
    return Array.isArray(p.days) && p.days.includes(dayName)
  })

  const toggleItem = async (item) => {
    const key = `${today}_${item.id}`
    const done = completions[key]?.done
    await setEntry(uid, 'checklistCompletions', key, { date: today, itemId: item.id, done: !done })
    setCompletions(prev => ({ ...prev, [key]: { ...prev[key], done: !done } }))
  }

  // --- Macro adherence today ---
  const todayNutrition = nutrition.filter(n => n.date === today)
  const totals = todayNutrition.reduce((acc, n) => ({
    kcal: acc.kcal + (parseFloat(n.kcal) || 0),
    protein: acc.protein + (parseFloat(n.protein) || 0),
    carbs: acc.carbs + (parseFloat(n.carbs) || 0),
    fat: acc.fat + (parseFloat(n.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
  const targets = settings.nutritionTargets || {}
  const macroData = [
    { name: 'Kcal', actual: Math.round(totals.kcal), target: targets.kcal || 2000 },
    { name: 'Protein', actual: Math.round(totals.protein), target: targets.protein || 160 },
    { name: 'Carbs', actual: Math.round(totals.carbs), target: targets.carbs || 200 },
    { name: 'Fat', actual: Math.round(totals.fat), target: targets.fat || 70 },
  ]

  // --- Latest lifts e1RM ---
  const keyLifts = ['Bench Press', 'Squat', 'Deadlift']
  const cutoff90 = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const liftSummary = keyLifts.map(ex => {
    const sessions = lifts.filter(l => l.exercise === ex && l.date >= cutoff90)
    let best = 0
    sessions.forEach(s => {
      (s.sets || []).forEach(set => {
        const e = parseFloat(set.weight || 0) * (1 + parseFloat(set.reps || 0) / 30)
        if (e > best) best = e
      })
    })
    return { exercise: ex, e1rm: best > 0 ? best.toFixed(1) : null }
  })

  // --- Latest BP ---
  const latestBP = bloods.find(b => b.systolic || b.diastolic)
  const bpTrend = bloods.filter(b => b.systolic).slice(0, 10).reverse()
    .map(b => ({ date: b.date?.slice(5), s: b.systolic, d: b.diastolic }))

  // --- Latest HbA1c ---
  const latestHba1c = bloods.find(b => b.hba1c)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Weight trend */}
        <div className="card">
          <div className="card-title flex items-center gap-2"><TrendingUp size={16} className="text-accent"/>Weight Trend</div>
          {weightData.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={weightData}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd"/>
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={['auto', 'auto']} width={36}/>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}/>
                <Line type="monotone" dataKey="weight" stroke="#22d3ee" dot={false} strokeWidth={1.5}/>
                <Line type="monotone" dataKey="avg" stroke="#f59e0b" dot={false} strokeWidth={1.5} strokeDasharray="4 2"/>
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted py-8 text-center">No weight data yet — log your first entry in Body.</p>
          )}
        </div>

        {/* Today's Checklist */}
        <div className="card">
          <div className="card-title flex items-center gap-2"><CheckSquare size={16} className="text-accent"/>Today's Checklist</div>
          {todayItems.length === 0 ? (
            <p className="text-sm text-muted">No items scheduled for today. Add them in Planner.</p>
          ) : (
            <ul className="space-y-2">
              {todayItems.map(item => {
                const key = `${today}_${item.id}`
                const done = completions[key]?.done
                return (
                  <li key={item.id} className="flex items-center gap-3 cursor-pointer" onClick={() => toggleItem(item)}>
                    {done ? <CheckSquare size={18} className="text-success shrink-0"/> : <Square size={18} className="text-muted shrink-0"/>}
                    <span className={`text-sm ${done ? 'line-through text-muted' : 'text-text'}`}>{item.title}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Macro adherence */}
        <div className="card">
          <div className="card-title flex items-center gap-2"><Activity size={16} className="text-accent"/>Macros Today</div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={macroData} layout="vertical">
              <CartesianGrid stroke="#334155" strokeDasharray="3 3"/>
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }}/>
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={48}/>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}/>
              <Bar dataKey="actual" name="Actual" fill="#22d3ee" radius={[0,4,4,0]}/>
              <Bar dataKey="target" name="Target" fill="#334155" radius={[0,4,4,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Latest lifts */}
        <div className="card">
          <div className="card-title flex items-center gap-2"><Dumbbell size={16} className="text-accent"/>Best e1RM (90d)</div>
          {liftSummary.every(l => !l.e1rm) ? (
            <p className="text-sm text-muted">No lifts logged yet. Head to Training.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {liftSummary.map(l => (
                <div key={l.exercise} className="bg-bg rounded-xl p-3 text-center">
                  <div className="text-xs text-muted mb-1">{l.exercise.split(' ')[0]}</div>
                  <div className="text-lg font-semibold text-accent">{l.e1rm ? `${l.e1rm}` : '—'}</div>
                  {l.e1rm && <div className="text-xs text-muted">kg e1RM</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest BP */}
        <div className="card">
          <div className="card-title flex items-center gap-2"><Droplets size={16} className="text-accent"/>Blood Pressure</div>
          {latestBP ? (
            <>
              <div className="flex gap-3 mb-3">
                <span className="text-2xl font-bold text-accent">{latestBP.systolic}</span>
                <span className="text-2xl text-muted">/</span>
                <span className="text-2xl font-bold text-text">{latestBP.diastolic}</span>
                <span className="text-sm text-muted self-end mb-1">mmHg</span>
                {latestBP.hr && <span className="text-sm text-muted self-end mb-1">• {latestBP.hr} bpm</span>}
              </div>
              {bpTrend.length > 1 && (
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={bpTrend}>
                    <Line type="monotone" dataKey="s" stroke="#22d3ee" dot={false} strokeWidth={1.5}/>
                    <Line type="monotone" dataKey="d" stroke="#94a3b8" dot={false} strokeWidth={1.5}/>
                    <XAxis dataKey="date" hide/>
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}/>
                  </LineChart>
                </ResponsiveContainer>
              )}
            </>
          ) : (
            <p className="text-sm text-muted">No BP readings yet. Log in Bloods.</p>
          )}
        </div>

        {/* Latest HbA1c */}
        <div className="card">
          <div className="card-title">Latest HbA1c</div>
          {latestHba1c ? (
            <div className="flex items-center gap-3">
              <FlagChip name="hba1c" value={latestHba1c.hba1c} sex={settings.sex}/>
              <span className="text-sm text-muted">mmol/mol · {latestHba1c.date}</span>
            </div>
          ) : (
            <p className="text-sm text-muted">No HbA1c logged yet.</p>
          )}
        </div>

      </div>
    </div>
  )
}
