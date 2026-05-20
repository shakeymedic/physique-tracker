import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { subscribe, getAll, getSettings, setEntry, saveSettings } from '../data.js'
import { format, subDays, addWeeks, startOfWeek } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { CheckSquare, Square, TrendingUp, Dumbbell, Droplets, Activity, Target, Heart, Zap, Trophy, Settings2, GripVertical, Eye, EyeOff } from 'lucide-react'
import { flag } from '../clinical/ranges.js'
import WeightChart, { computeWeeklyRate } from '../components/WeightChart.jsx'
import ConsistencyHeatmap from '../components/ConsistencyHeatmap.jsx'
import { getProgramById } from '../training/programs.js'
import { computeAchievements, BADGE_DEFS } from '../lib/achievements.js'
import MilestoneRow from '../components/MilestoneRow.jsx'

const epleyDash = (w, r) => parseFloat(w) * (1 + parseFloat(r) / 30)

function getBestE1RMDash(lifts, exerciseName) {
  let best = 0
  lifts.forEach(l => {
    const exercises = l.exercises
      ? l.exercises
      : l.exercise
        ? [{ name: l.exercise, sets: l.sets || [] }]
        : []
    exercises.filter(e => e.name === exerciseName).forEach(e => {
      ;(e.sets || []).forEach(s => {
        const e1 = epleyDash(s.weight, s.reps)
        if (e1 > best) best = e1
      })
    })
  })
  return best
}

function computeMilestoneProgressDash(milestone, lifts, weights) {
  if (!milestone?.exercise) return { hit: false, progress: 0, currentKg: null, targetKg: null }
  const latestWeight = weights?.length
    ? weights.slice().sort((a, b) => b.date.localeCompare(a.date))[0]?.weight || 80
    : 80
  const targetKg = latestWeight * (milestone.multiplier || 1.0)
  const currentKg = getBestE1RMDash(lifts, milestone.exercise)
  const progress = targetKg > 0 ? Math.min(1, currentKg / targetKg) : 0
  const hit = currentKg >= targetKg * 0.99
  return { hit, progress, currentKg, targetKg }
}

function FlagChip({ name, value, sex }) {
  const f = flag(name, value, sex)
  if (!f) return <span className="text-sm text-muted">{value ?? '—'}</span>
  const cls = { ok: 'chip-ok', warn: 'chip-warn', bad: 'chip-bad' }[f]
  return <span className={cls}>{value}</span>
}

// Mini bar showing actual vs goal for a given week
function WeekGoalBar({ label, actual, goal, colorClass = 'bg-accent' }) {
  const pct = goal > 0 ? Math.min(100, (actual / goal) * 100) : 0
  const met = actual >= goal
  return (
    <div>
      <div className="flex justify-between text-xs text-muted mb-0.5">
        <span>{label}</span>
        <span className={met ? 'text-success font-medium' : 'text-text'}>
          {actual}/{goal}
          {met && ' ✓'}
        </span>
      </div>
      <div className="w-full bg-surfaceAlt rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${met ? 'bg-success' : colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function Insights() {
  const { user } = useAuth()
  const uid = user?.uid
  const [weights, setWeights] = useState([])
  const [lifts, setLifts] = useState([])
  const [cardio, setCardio] = useState([])
  const [bloods, setBloods] = useState([])
  const [nutrition, setNutrition] = useState([])
  const [planner, setPlanner] = useState([])
  const [completions, setCompletions] = useState({})
  const [settings, setSettings] = useState({})
  const [wellbeing, setWellbeing] = useState([])
  const [selfCareLog, setSelfCareLog] = useState([])

  useEffect(() => {
    if (!uid) return
    const u1 = subscribe(uid, 'weights', setWeights, { limit: 90 })
    const u2 = subscribe(uid, 'lifts', setLifts, { limit: 300 })
    const u3 = subscribe(uid, 'cardio', setCardio, { limit: 200 })
    const u4 = subscribe(uid, 'bloods', setBloods, { limit: 50 })
    const u5 = subscribe(uid, 'nutritionLog', setNutrition, { limit: 50 })
    const u6 = subscribe(uid, 'planner', setPlanner, { orderByField: 'createdAt' })
    const u7 = subscribe(uid, 'wellbeing', setWellbeing, { limit: 100 })
    const u8 = subscribe(uid, 'selfCareLog', setSelfCareLog, { limit: 100 })
    getAll(uid, 'checklistCompletions').then(docs => {
      const map = {}
      docs.forEach(d => { map[d.id] = d })
      setCompletions(map)
    })
    getSettings(uid).then(setSettings)
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8() }
  }, [uid])

  const today = format(new Date(), 'yyyy-MM-dd')

  // --- Weight trend (last 30d) ---
  const w30 = weights.filter(w => w.date >= format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    .slice().sort((a, b) => a.date.localeCompare(b.date))

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

  let rateStatus = null
  if (weeklyRate !== null && rateKgPerWeek) {
    const actual = goalType === 'lose' ? -weeklyRate : weeklyRate
    if (actual >= rateKgPerWeek * 0.8 && actual <= rateKgPerWeek * 1.3) rateStatus = 'on'
    else if (actual < rateKgPerWeek * 0.8) rateStatus = 'behind'
    else rateStatus = 'ahead'
  }

  // All-time PR per exercise — handles both old single-exercise and new multi-exercise shape
  const allPRs = {}
  const epleyCalc = (w, r) => parseFloat(w) * (1 + parseFloat(r) / 30)
  lifts.forEach(l => {
    const exercises = l.exercises
      ? l.exercises
      : l.exercise ? [{ name: l.exercise, sets: l.sets || [] }] : []
    exercises.forEach(ex => {
      if (!ex.name) return
      ;(ex.sets || []).forEach(s => {
        const e = epleyCalc(s.weight, s.reps)
        if (!allPRs[ex.name] || e > parseFloat(allPRs[ex.name])) {
          allPRs[ex.name] = e.toFixed(1)
        }
      })
    })
  })

  // ── Weekly goals (last 4 weeks) ──
  const actGoals = settings.activityGoals || {}
  const gymGoal = actGoals.gymPerWeek || 3
  const cardioGoal = actGoals.cardioPerWeek || 2
  const selfCareGoal = actGoals.selfCarePerWeek || 5

  // Build 4 weeks array (Mon..Sun), most recent first
  const weeklyGoalData = Array.from({ length: 4 }, (_, i) => {
    const monDate = startOfWeek(subDays(new Date(), i * 7), { weekStartsOn: 1 })
    const sunDate = new Date(monDate)
    sunDate.setDate(monDate.getDate() + 6)
    const wStart = format(monDate, 'yyyy-MM-dd')
    const wEnd = format(sunDate, 'yyyy-MM-dd')

    const gymSessions = new Set(lifts.filter(l => l.date >= wStart && l.date <= wEnd).map(l => l.date)).size
    const cardioSessions = cardio.filter(c => c.date >= wStart && c.date <= wEnd).length
    const selfCareSessions = selfCareLog.filter(s => s.date >= wStart && s.date <= wEnd).length

    return {
      label: i === 0 ? 'This week' : `${format(monDate, 'd MMM')}`,
      gym: gymSessions,
      cardio: cardioSessions,
      selfCare: selfCareSessions,
    }
  })

  // ── Heatmap data — all activity dates ──
  const heatmapDates = [
    ...lifts.map(l => ({ date: l.date, type: 'lift' })),
    ...cardio.map(c => ({ date: c.date, type: 'cardio' })),
    ...nutrition.map(n => ({ date: n.date, type: 'nutrition' })),
    ...wellbeing.map(w => ({ date: w.date, type: 'wellbeing' })),
    ...selfCareLog.map(s => ({ date: s.date, type: 'selfcare' })),
  ]

  // ── Achievements ──
  const { badges } = computeAchievements({
    weights, lifts, cardio, nutritionLog: nutrition, wellbeing, selfCareLog, settings
  })
  const earnedBadges = BADGE_DEFS.filter(b => badges[b.id]?.earned)
  const recentEarned = earnedBadges.slice(-3).reverse() // last 3 earned

  // ── Card manager state ──
  const ALL_CARDS = [
    { id: 'goal',        label: 'Goal Tracker' },
    { id: 'heatmap',     label: 'Activity Heatmap' },
    { id: 'weekly',      label: 'Weekly Goals' },
    { id: 'macros',      label: 'Macros Today' },
    { id: 'prs',         label: 'Personal Records' },
    { id: 'bp',          label: 'Blood Pressure' },
    { id: 'checklist',   label: "Today's Checklist" },
    { id: 'milestones',  label: 'Program Milestones' },
  ]

  const rawCardSettings = settings.dashboardCards
  const cardOrder = rawCardSettings?.order || ALL_CARDS.map(c => c.id)
  const hiddenCards = new Set(rawCardSettings?.hidden || [])

  const [managing, setManaging] = useState(false)
  const [localOrder, setLocalOrder] = useState(null)
  const [localHidden, setLocalHidden] = useState(null)
  const effectiveOrder = localOrder || cardOrder
  const effectiveHidden = localHidden || hiddenCards

  const moveCard = (idx, dir) => {
    const arr = [...effectiveOrder]
    const swap = idx + dir
    if (swap < 0 || swap >= arr.length) return
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    setLocalOrder(arr)
  }

  const toggleCard = (id) => {
    const next = new Set(effectiveHidden)
    next.has(id) ? next.delete(id) : next.add(id)
    setLocalHidden(next)
  }

  const saveCardSettings = async () => {
    await saveSettings(uid, {
      dashboardCards: { order: effectiveOrder, hidden: [...effectiveHidden] }
    })
    setManaging(false)
    setLocalOrder(null)
    setLocalHidden(null)
  }

  const visible = (id) => !effectiveHidden.has(id)

  return (
    <div className="space-y-4">

      {/* Card manager header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">Insights</div>
        {!managing ? (
          <button onClick={() => setManaging(true)} className="btn-ghost text-xs flex items-center gap-1">
            <Settings2 size={13}/> Customise
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={saveCardSettings} className="btn-primary text-xs">Save layout</button>
            <button onClick={() => { setManaging(false); setLocalOrder(null); setLocalHidden(null) }} className="btn-secondary text-xs">Cancel</button>
          </div>
        )}
      </div>

      {/* Card manager panel */}
      {managing && (
        <div className="card">
          <div className="card-title flex items-center gap-2"><Settings2 size={15} className="text-accent"/> Customise Insights</div>
          <p className="text-xs text-muted mb-3">Show/hide cards and drag to reorder. Changes save when you tap "Save layout".</p>
          <div className="space-y-2">
            {effectiveOrder.map((id, idx) => {
              const card = ALL_CARDS.find(c => c.id === id)
              if (!card) return null
              const hidden = effectiveHidden.has(id)
              return (
                <div key={id} className={`flex items-center gap-2 bg-surfaceAlt rounded-xl px-3 py-2.5 ${hidden ? 'opacity-50' : ''}`}>
                  <GripVertical size={14} className="text-muted shrink-0"/>
                  <span className="text-sm text-text flex-1">{card.label}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveCard(idx, -1)} disabled={idx === 0} className="btn-ghost p-0.5 disabled:opacity-30">↑</button>
                    <button onClick={() => moveCard(idx, 1)} disabled={idx === effectiveOrder.length - 1} className="btn-ghost p-0.5 disabled:opacity-30">↓</button>
                    <button onClick={() => toggleCard(id)} className={`btn-ghost p-1 ml-1 ${hidden ? 'text-muted' : 'text-accent'}`}>
                      {hidden ? <EyeOff size={14}/> : <Eye size={14}/>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Render cards in order */}
      {effectiveOrder.map(id => {
        if (effectiveHidden.has(id)) return null

        if (id === 'goal') return (
          <div key="goal">
            {(targetWeightGoal || latestWeight) && (
              <div className="card">
                <div className="card-title flex items-center gap-2"><Target size={16} className="text-accent" />Goal Tracker</div>
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
                <WeightChart weights={w90} goalSettings={goal} height={180} />
                {rateStatus && weeklyRate !== null && (
                  <div className={`mt-3 text-xs rounded-lg px-3 py-2 ${rateStatus === 'on' ? 'bg-success/10 text-success' : rateStatus === 'behind' ? 'bg-warn/10 text-warn' : 'bg-accent/10 text-accent'}`}>
                    Last 7 days: {weeklyRate > 0 ? '+' : ''}{weeklyRate} kg/week
                    {rateKgPerWeek && <> · Target: {goalType === 'lose' ? '-' : '+'}{rateKgPerWeek} kg/week</>}
                    {' '}· {rateStatus === 'on' ? '✅ On track' : rateStatus === 'behind' ? '⚠ Behind target' : '📈 Ahead of target'}
                  </div>
                )}
                {!targetWeightGoal && w30.length > 1 && (
                  <>
                    <div className="card-title flex items-center gap-2 mt-3"><TrendingUp size={16} className="text-accent" />Weight Trend</div>
                    <WeightChart weights={w30} height={160} />
                  </>
                )}
              </div>
            )}
            {!targetWeightGoal && !latestWeight && (
              <div className="card">
                <div className="card-title flex items-center gap-2"><TrendingUp size={16} className="text-accent" />Weight Trend</div>
                <p className="text-sm text-muted py-6 text-center">No weight data yet — log your first entry in Body.</p>
              </div>
            )}
          </div>
        )

        if (id === 'heatmap') return (
          <div key="heatmap" className="card">
            <div className="card-title flex items-center gap-2">
              <Zap size={16} className="text-accent" /> Activity Consistency (12 weeks)
            </div>
            <ConsistencyHeatmap entries={heatmapDates} weeks={12} gymGoal={gymGoal} />

            {/* Achievement badges summary */}
            <div className="mt-4 pt-4 border-t border-border/20">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Trophy size={14} className="text-warn"/>
                  <span className="text-sm font-semibold text-text">Achievements</span>
                </div>
                <span className="text-xs text-muted">{earnedBadges.length} / {BADGE_DEFS.length} earned</span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-surfaceAlt rounded-full h-1.5 mb-3">
                <div
                  className="bg-warn h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.round((earnedBadges.length / BADGE_DEFS.length) * 100)}%` }}
                />
              </div>

              {/* Tier breakdown */}
              {(() => {
                const beginner = BADGE_DEFS.filter(b => b.tier === 'beginner')
                const standard = BADGE_DEFS.filter(b => !b.tier)
                const earnedBeg = beginner.filter(b => badges[b.id]?.earned).length
                const earnedStd = standard.filter(b => badges[b.id]?.earned).length
                return (
                  <div className="flex gap-4 text-xs text-muted mb-3">
                    <span>Beginner: <span className="text-text font-medium">{earnedBeg}/{beginner.length}</span></span>
                    <span>Standard: <span className="text-text font-medium">{earnedStd}/{standard.length}</span></span>
                  </div>
                )
              })()}

              {/* Last 3 earned */}
              {recentEarned.length > 0 ? (
                <div>
                  <p className="text-xs text-muted mb-2">Recently earned</p>
                  <div className="space-y-1.5">
                    {recentEarned.map(b => (
                      <div key={b.id} className="flex items-center gap-3 bg-warn/10 border border-warn/20 rounded-xl px-3 py-2">
                        <Trophy size={14} className="text-warn shrink-0"/>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-warn truncate">{b.name}</div>
                          <div className="text-xs text-muted">{b.desc}</div>
                        </div>
                        {b.tier === 'beginner' && (
                          <span className="text-xs bg-accent/20 text-accent rounded-full px-2 py-0.5 shrink-0">Beginner</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-xs text-muted">No badges earned yet — start logging to unlock your first.</p>
                </div>
              )}

              {earnedBadges.length > 0 && (
                <button
                  onClick={() => window.location.hash = '#/achievements'}
                  className="btn-ghost text-xs mt-2 w-full text-center"
                >
                  View all badges →
                </button>
              )}
            </div>
          </div>
        )

        if (id === 'weekly') return (
          <div key="weekly" className="card">
            <div className="card-title flex items-center gap-2">
              <Heart size={16} className="text-accent" /> Weekly Goals (last 4 weeks)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {weeklyGoalData.map((wk, i) => (
                <div key={i} className="bg-bg rounded-xl p-3 space-y-2">
                  <div className="text-xs font-semibold text-muted mb-2">{wk.label}</div>
                  <WeekGoalBar label="Gym" actual={wk.gym} goal={gymGoal} colorClass="bg-accent" />
                  <WeekGoalBar label="Cardio" actual={wk.cardio} goal={cardioGoal} colorClass="bg-success" />
                  <WeekGoalBar label="Self-care" actual={wk.selfCare} goal={selfCareGoal} colorClass="bg-purple-400" />
                </div>
              ))}
            </div>
          </div>
        )

        if (id === 'macros') return (
          <div key="macros" className="card">
            <div className="card-title flex items-center gap-2"><Activity size={16} className="text-accent" />Macros Today</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={macroData} layout="vertical">
                <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={48} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }} />
                <Bar dataKey="actual" name="Actual" fill="#22d3ee" radius={[0, 4, 4, 0]} />
                <Bar dataKey="target" name="Target" fill="#334155" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )

        if (id === 'prs') return (
          <div key="prs" className="card">
            <div className="card-title flex items-center gap-2"><Dumbbell size={16} className="text-accent" />Personal Records</div>
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
        )

        if (id === 'bp') return (
          <div key="bp" className="card">
            <div className="card-title flex items-center gap-2"><Droplets size={16} className="text-accent" />Blood Pressure</div>
            {latestBP ? (
              <>
                <div className="flex gap-3 mb-3">
                  <span className="text-2xl font-bold text-accent">{latestBP.systolic}</span>
                  <span className="text-2xl text-muted">/</span>
                  <span className="text-2xl font-bold text-text">{latestBP.diastolic}</span>
                  <span className="text-sm text-muted self-end mb-1">mmHg</span>
                  {latestBP.hr && <span className="text-sm text-muted self-end mb-1">· {latestBP.hr} bpm</span>}
                </div>
                {bpTrend.length > 1 && (
                  <ResponsiveContainer width="100%" height={80}>
                    <LineChart data={bpTrend}>
                      <Line type="monotone" dataKey="s" stroke="#22d3ee" dot={false} strokeWidth={1.5} />
                      <Line type="monotone" dataKey="d" stroke="#94a3b8" dot={false} strokeWidth={1.5} />
                      <XAxis dataKey="date" hide />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">No BP readings yet. Log in Bloods.</p>
            )}
          </div>
        )

        if (id === 'checklist') return (
          <div key="checklist" className="card">
            <div className="card-title flex items-center gap-2"><CheckSquare size={16} className="text-accent" />Today's Checklist</div>
            {todayItems.length === 0 ? (
              <p className="text-sm text-muted">No items scheduled for today. Add them in Planner.</p>
            ) : (
              <ul className="space-y-2">
                {todayItems.map(item => {
                  const key = `${today}_${item.id}`
                  const done = completions[key]?.done
                  return (
                    <li key={item.id} className="flex items-center gap-3 cursor-pointer" onClick={() => toggleItem(item)}>
                      {done ? <CheckSquare size={18} className="text-success shrink-0" /> : <Square size={18} className="text-muted shrink-0" />}
                      <span className={`text-sm ${done ? 'line-through text-muted' : 'text-text'}`}>{item.title}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )

        if (id === 'milestones') {
          const prog = settings.activeProgram ? getProgramById(settings.activeProgram.id) : null
          if (!prog?.milestones?.length) return null
          const exerciseMilestones = prog.milestones.filter(m => m.exercise)
          if (!exerciseMilestones.length) return null
          return (
            <div key="milestones" className="card">
              <div className="card-title flex items-center gap-2">
                <Trophy size={16} className="text-warn"/> Program Milestones — {prog.name}
              </div>
              {exerciseMilestones.map(m => {
                const { hit, progress, currentKg, targetKg } = computeMilestoneProgressDash(m, lifts, weights)
                return (
                  <MilestoneRow key={m.id} milestone={m} progress={progress} hit={hit} currentKg={currentKg} targetKg={targetKg}/>
                )
              })}
            </div>
          )
        }

        return null
      })}

    </div>
  )
}
