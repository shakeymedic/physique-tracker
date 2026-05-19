import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, getAll, getSettings, setEntry } from '../data.js'
import { format, subDays, addWeeks } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { CheckSquare, Square, TrendingUp, Dumbbell, Droplets, Activity, Target } from 'lucide-react'
import { flag } from '../clinical/ranges.js'
import WeightChart, { computeWeeklyRate } from '../components/WeightChart.jsx'

function FlagChip({ name, value, sex }) {
  const f = flag(name, value, sex)
  if (!f) return <span className="text-sm text-muted">{value ?? '—'}</span>
  const cls = { ok: 'chip-ok', warn: 'chip-warn', bad: 'chip-bad' }[f]
  return <span className={cls}>{value}</span>
}

export default function Insights() {
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

  // --- Latest BP ---
  const latestBP = bloods.find(b => b.systolic || b.diastolic)
  const bpTrend = bloods.filter(b => b.systolic).slice(0, 10).reverse()
    .map(b => ({ date: b.date?.slice(5), s: b.systolic, d: b.diastolic }))

  // --- Latest HbA1c ---
  const latestHba1c = bloods.find(b => b.hba1c)

  // ── Goal panel ──
  const goal = settings.goal || {}
  const latestWeight = weights.length > 0 ? parseFloat(weights[0].weight) : null
  const cutoff90 = format(subDays(new Date(), 90), 'yyyy-MM-dd')
  const w90 = weights.filter(w => w.date >= cutoff90).sort((a, b) => a.date.localeCompare(b.date))
  const startWeight = goal.startWeight || (w90.length > 0 ? parseFloat(w90[0].weight) : null)
  const weeklyRate = computeWeeklyRate(weights)
  const targetWeightGoal = goal.targetWeight
  const rateKgPerWeek = goal.rateKgPerWeek
  const goalType = goal.type

  let projectedETA = null
  if (latestWeight && targetWeightGoal && rateKgPerWeek) {
    const diff = Math.abs(latestWeight - targetWeightGoal)
    const weeks = diff / rateKgPerWeek
    if (weeks < 200) projectedETA = format(addWeeks(new Date(), weeks), 'd MMM yyyy')
  }

  // Actual vs target weekly rate comparison
  let rateStatus = null
  if (weeklyRate !== null && rateKgPerWeek) {
    const actual = goalType === 'lose' ? -weeklyRate : weeklyRate
    if (actual >= rateKgPerWeek * 0.8 && actual <= rateKgPerWeek * 1.3) rateStatus = 'on'
    else if (actual < rateKgPerWeek * 0.8) rateStatus = 'behind'
    else rateStatus = 'ahead'
  }

  // All-time PR per exercise
  const allPRs = {}
  const epleyCalc = (w, r) => parseFloat(w) * (1 + parseFloat(r) / 30)
  ;['Bench Press','Squat','Deadlift','Overhead Press','Barbell Row','Pull-Up'].forEach(ex => {
    let best = 0
    lifts.filter(l => l.exercise === ex).forEach(s => {
      ;(s.sets || []).forEach(set => {
        const e = epleyCalc(set.weight, set.reps)
        if (e > best) best = e
      })
    })
    if (best > 0) allPRs[ex] = best.toFixed(1)
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Goal Tracker */}
        {(targetWeightGoal || latestWeight) && (
          <div className="card md:col-span-2">
            <div className="card-title flex items-center gap-2"><Target size={16} className="text-accent"/>Goal Tracker</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
              {latestWeight && (
                <div className="bg-bg rounded-xl p-3">
                  <div className="text-xs text-muted mb-1">Current</div>
                  <div className="text-accent font-semibold">{latestWeight} kg</div>
                </div>
              )}
              {startWeight && (
                <div className="bg-bg rounded-xl p-3">
                  <div className="text-xs text-muted mb-1">Start (90d)</div>
                  <div className="text-text font-semibold">{parseFloat(startWeight).toFixed(1)} kg</div>
                </div>
              )}
              {targetWeightGoal && (
                <div className="bg-bg rounded-xl p-3">
                  <div className="text-xs text-muted mb-1">Target</div>
                  <div className="text-success font-semibold">{targetWeightGoal} kg</div>
                </div>
              )}
              {projectedETA && (
                <div className="bg-bg rounded-xl p-3">
                  <div className="text-xs text-muted mb-1">ETA</div>
                  <div className="text-text font-semibold">{projectedETA}</div>
                </div>
              )}
            </div>
            <WeightChart weights={w90} goalSettings={goal} height={180}/>
            {rateStatus && weeklyRate !== null && (
              <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${
                rateStatus === 'on' ? 'bg-success/10 text-success'
                  : rateStatus === 'behind' ? 'bg-warn/10 text-warn'
                  : 'bg-accent/10 text-accent'
              }`}>
                Last 7 days: {weeklyRate > 0 ? '+' : ''}{weeklyRate} kg/week
                {rateKgPerWeek && <> · Target: {goalType === 'lose' ? '-' : '+'}{rateKgPerWeek} kg/week</>}
                {' '}· {rateStatus === 'on' ? '✅ On track' : rateStatus === 'behind' ? '⚠ Behind target' : '📈 Ahead of target'}
              </div>
            )}
          </div>
        )}

        {/* Weight trend (fallback if no goal set) */}
        {!targetWeightGoal && (
        <div className="card">
          <div className="card-title flex items-center gap-2"><TrendingUp size={16} className="text-accent"/>Weight Trend</div>
          {weightData.length > 1 ? (
            <WeightChart weights={w30} height={160}/>
          ) : (
            <p className="text-sm text-muted py-8 text-center">No weight data yet — log your first entry in Body.</p>
          )}
        </div>
        )}

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

        {/* Personal Records */}
        <div className="card">
          <div className="card-title flex items-center gap-2"><Dumbbell size={16} className="text-accent"/>Personal Records</div>
          {Object.keys(allPRs).length === 0 ? (
            <p className="text-sm text-muted">No lifts logged yet. Head to Training.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(allPRs).map(([ex, e1rm]) => (
                <div key={ex} className="bg-bg rounded-xl p-3 text-center">
                  <div className="text-xs text-muted mb-1">{ex.split(' ').slice(0, 2).join(' ')}</div>
                  <div className="text-base font-semibold text-accent">{e1rm}</div>
                  <div className="text-xs text-muted">kg e1RM</div>
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
