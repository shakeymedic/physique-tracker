import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, getSettings, getAll } from '../data.js'
import { format, subDays, startOfWeek } from 'date-fns'
import { CheckSquare, Square, Apple, Trophy, Cloud, Dumbbell, Heart, Activity } from 'lucide-react'
import { quoteOfTheDay } from '../lib/quotes.js'
import { isMedDueToday, lastTakenDate } from '../clinical/meds.js'
import { computeMuscleRecovery, muscleStatus } from '../training/exercises.js'
import WeightChart, { computeWeeklyRate } from '../components/WeightChart.jsx'
import MoodPicker from '../components/MoodPicker.jsx'

const today = () => format(new Date(), 'yyyy-MM-dd')

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// Small circular progress ring for "This Week" card
function Ring({ value = 0, size = 48, label, sub }) {
  const strokeWidth = 5
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(1, value)
  const done = value >= 1
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            className="text-surfaceAlt" />
          <circle cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="currentColor" strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className={done ? 'text-success transition-all' : 'text-accent transition-all'} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-text">
          {sub}
        </div>
      </div>
      <div className="text-[10px] text-muted text-center leading-tight">{label}</div>
    </div>
  )
}

export default function Today() {
  const { user } = useAuth()
  const uid = user?.uid
  const navigate = useNavigate()

  const [weights, setWeights] = useState([])
  const [lifts, setLifts] = useState([])
  const [cardio, setCardio] = useState([])
  const [nutrition, setNutrition] = useState([])
  const [planner, setPlanner] = useState([])
  const [meds, setMeds] = useState([])
  const [medLogs, setMedLogs] = useState([])
  const [completions, setCompletions] = useState({})
  const [settings, setSettings] = useState({})
  const [dietBreaks, setDietBreaks] = useState({})
  const [wellbeing, setWellbeing] = useState([])
  const [selfCareLog, setSelfCareLog] = useState([])

  // Quick weight log form
  const [wForm, setWForm] = useState({ date: today(), weight: '', bodyfat: '' })
  const [wSaving, setWSaving] = useState(false)

  // Mood quick log state
  const [moodVal, setMoodVal] = useState(null)
  const [moodSaving, setMoodSaving] = useState(false)
  const [moodSaved, setMoodSaved] = useState(false)

  useEffect(() => {
    if (!uid) return
    const u1 = subscribe(uid, 'weights', setWeights, { limit: 90 })
    const u2 = subscribe(uid, 'lifts', setLifts, { limit: 200 })
    const u3 = subscribe(uid, 'cardio', setCardio, { limit: 100 })
    const u4 = subscribe(uid, 'nutritionLog', setNutrition, { limit: 100 })
    const u5 = subscribe(uid, 'planner', setPlanner, { orderByField: 'createdAt' })
    const u6 = subscribe(uid, 'medications', setMeds, { orderByField: 'createdAt' })
    const u7 = subscribe(uid, 'medicationLog', setMedLogs, { limit: 200 })
    const u8 = subscribe(uid, 'wellbeing', setWellbeing, { limit: 100 })
    const u9 = subscribe(uid, 'selfCareLog', setSelfCareLog, { limit: 100 })
    getAll(uid, 'checklistCompletions').then(docs => {
      const map = {}
      docs.forEach(d => { map[d.id] = d })
      setCompletions(map)
    })
    getAll(uid, 'dietBreaks').then(docs => {
      const map = {}
      docs.forEach(d => { map[d.id] = d })
      setDietBreaks(map)
    })
    getSettings(uid).then(s => {
      setSettings(s)
    })
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9() }
  }, [uid])

  const todayStr = today()
  const firstName = (user?.displayName || '').split(' ')[0] || user?.email?.split('@')[0] || 'there'
  const dateLabel = format(new Date(), 'EEEE d MMMM yyyy')

  // ── Quick weight save ──
  const saveWeight = async (e) => {
    e.preventDefault()
    if (!wForm.weight) return
    setWSaving(true)
    try {
      await addEntry(uid, 'weights', {
        date: wForm.date,
        weight: parseFloat(wForm.weight),
        ...(wForm.bodyfat ? { bodyfat: parseFloat(wForm.bodyfat) } : {}),
      })
      setWForm({ date: today(), weight: '', bodyfat: '' })
    } finally { setWSaving(false) }
  }

  const todayWeight = weights.find(w => w.date === todayStr)

  // ── Macros today ──
  const todayNutrition = nutrition.filter(n => n.date === todayStr)
  const totals = todayNutrition.reduce((acc, n) => ({
    kcal: acc.kcal + (parseFloat(n.kcal) || 0),
    protein: acc.protein + (parseFloat(n.protein) || 0),
    carbs: acc.carbs + (parseFloat(n.carbs) || 0),
    fat: acc.fat + (parseFloat(n.fat) || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  const activeDietBreak = dietBreaks[todayStr]
  const rawTargets = settings.nutritionTargets || {}
  const tdee = settings.goal?.tdee || null
  const targets = activeDietBreak
    ? { kcal: tdee || rawTargets.kcal || 2000, protein: rawTargets.protein || 160, carbs: rawTargets.carbs || 200, fat: rawTargets.fat || 70 }
    : { kcal: rawTargets.kcal || 2000, protein: rawTargets.protein || 160, carbs: rawTargets.carbs || 200, fat: rawTargets.fat || 70 }

  const macros = [
    { name: 'Kcal', actual: Math.round(totals.kcal), target: targets.kcal },
    { name: 'Protein', actual: Math.round(totals.protein), target: targets.protein },
    { name: 'Carbs', actual: Math.round(totals.carbs), target: targets.carbs },
    { name: 'Fat', actual: Math.round(totals.fat), target: targets.fat },
  ]

  // ── Planner checklist for today ──
  const dayName = format(new Date(), 'EEE').toLowerCase().slice(0, 3)
  const todayPlannerItems = planner.filter(p => {
    if (!p.days && !p.specificDate) return false
    if (p.specificDate) return p.specificDate === todayStr
    return Array.isArray(p.days) && p.days.includes(dayName)
  })

  // ── Meds due today ──
  const medsDueToday = meds.filter(med => {
    if (med.frequency === 'asNeeded') return false
    const lt = lastTakenDate(medLogs, med.id)
    return isMedDueToday(med, todayStr, lt)
  })

  const togglePlannerItem = async (item) => {
    const key = `${todayStr}_${item.id}`
    const done = completions[key]?.done
    await setEntry(uid, 'checklistCompletions', key, { date: todayStr, itemId: item.id, done: !done })
    setCompletions(prev => ({ ...prev, [key]: { ...prev[key], done: !done } }))
  }

  const toggleMedTaken = async (med) => {
    const existing = medLogs.find(l => l.date === todayStr && l.medId === med.id)
    if (existing) {
      const { deleteEntry } = await import('../data.js')
      await deleteEntry(uid, 'medicationLog', existing.id)
    } else {
      await addEntry(uid, 'medicationLog', { date: todayStr, medId: med.id, name: med.name, dose: med.dose, unit: med.unit })
    }
  }

  // ── PRs today ──
  const todayLifts = lifts.filter(l => l.date === todayStr)
  const todayPRs = todayLifts.flatMap(l => l.prs || [])

  // ── Weight trend for mini chart (last 30d) ──
  const w30 = weights
    .filter(w => w.date >= format(subDays(new Date(), 30), 'yyyy-MM-dd'))
    .sort((a, b) => a.date.localeCompare(b.date))

  const weeklyRate = computeWeeklyRate(weights)
  const targetRate = settings.goal?.rateKgPerWeek || null
  const isOnTrack = weeklyRate !== null && targetRate !== null
    ? settings.goal?.type === 'lose'
      ? weeklyRate <= -targetRate * 1.2 && weeklyRate >= -targetRate * 0.5
      : Math.abs(weeklyRate) <= targetRate * 1.2
    : null

  // ── Muscle recovery ──
  const muscleRec = computeMuscleRecovery(lifts, todayStr)
  const readyMuscles = Object.entries(muscleRec).filter(([, d]) => muscleStatus(d) === 'recovered').map(([m]) => m)
  const fatiguedMuscles = Object.entries(muscleRec).filter(([, d]) => muscleStatus(d) === 'fatigued').map(([m]) => m)

  // ── This Week stats ──
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekLifts = lifts.filter(l => l.date >= weekStart)
  // Unique lift days (one session per day)
  const weekGymDays = new Set(weekLifts.map(l => l.date)).size
  const weekCardioSessions = cardio.filter(c => c.date >= weekStart).length
  const weekCardioKm = cardio
    .filter(c => c.date >= weekStart)
    .reduce((s, c) => s + (parseFloat(c.distance) || 0), 0)
  const weekSelfCare = selfCareLog.filter(s => s.date >= weekStart).length

  const actGoals = settings.activityGoals || {}
  const gymGoal = actGoals.gymPerWeek || 3
  const cardioGoal = actGoals.cardioPerWeek || 2
  const selfCareGoal = actGoals.selfCarePerWeek || 5

  // ── Today's mood ──
  const todayWellbeing = wellbeing.find(w => w.date === todayStr)
  const todayMood = todayWellbeing?.mood ?? null

  const saveMood = async (val) => {
    if (!uid) return
    setMoodSaving(true)
    try {
      if (todayWellbeing?.id) {
        await setEntry(uid, 'wellbeing', todayWellbeing.id, { ...todayWellbeing, mood: val })
      } else {
        await addEntry(uid, 'wellbeing', { date: todayStr, mood: val })
      }
      setMoodSaved(true)
      setTimeout(() => setMoodSaved(false), 2500)
    } finally { setMoodSaving(false) }
  }

  const handleMoodSelect = (val) => {
    setMoodVal(val)
    saveMood(val)
  }

  return (
    <div className="space-y-4">

      {/* Greeting card */}
      <div className="card">
        <div className="text-base font-semibold text-text">{greeting()}, {firstName}.</div>
        <div className="text-xs text-muted mb-2">{dateLabel}</div>
        {activeDietBreak && (
          <span className="chip-warn mb-2 inline-flex">
            {activeDietBreak.type === 'refeed' ? '🍽 Refeed day' : '🛌 Diet break'} — maintenance calories today
          </span>
        )}
        <p className="text-sm text-muted italic">"{quoteOfTheDay()}"</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Mood quick log */}
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Heart size={16} className="text-accent" /> Mood Today
          </div>
          {todayMood !== null ? (
            <p className="text-xs text-muted mb-2">
              Logged today:{' '}
              {['😞','😕','😐','🙂','😄'][todayMood - 1] || '?'}{' '}
              <button className="text-accent underline text-xs ml-1" onClick={() => setMoodVal(null)}>
                change
              </button>
            </p>
          ) : null}
          <MoodPicker
            value={moodVal ?? todayMood ?? null}
            onChange={handleMoodSelect}
          />
          {moodSaving && <p className="text-xs text-muted mt-2">Saving…</p>}
          {moodSaved && <p className="text-xs text-success mt-2">✓ Mood saved</p>}
          <button
            onClick={() => navigate('/wellbeing')}
            className="btn-ghost text-xs mt-3"
          >
            Full wellbeing log →
          </button>
        </div>

        {/* This Week goals */}
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Activity size={16} className="text-accent" /> This Week
          </div>
          <div className="flex justify-around mt-2 mb-3">
            <Ring
              value={gymGoal > 0 ? weekGymDays / gymGoal : 0}
              label="Gym sessions"
              sub={`${weekGymDays}/${gymGoal}`}
            />
            <Ring
              value={cardioGoal > 0 ? weekCardioSessions / cardioGoal : 0}
              label="Cardio"
              sub={`${weekCardioSessions}/${cardioGoal}`}
            />
            <Ring
              value={selfCareGoal > 0 ? weekSelfCare / selfCareGoal : 0}
              label="Self-care"
              sub={`${weekSelfCare}/${selfCareGoal}`}
            />
          </div>
          {weekCardioKm > 0 && (
            <p className="text-xs text-muted">
              Cardio distance this week: <span className="text-text font-medium">{weekCardioKm.toFixed(1)} km</span>
            </p>
          )}
          <button onClick={() => navigate('/training')} className="btn-ghost text-xs mt-2">
            View training →
          </button>
        </div>

        {/* Quick weight log */}
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Cloud size={16} className="text-accent" /> Quick Weight Log
          </div>
          {todayWeight ? (
            <div className="mb-3 text-sm">
              <span className="text-accent font-semibold text-lg">{todayWeight.weight} kg</span>
              {todayWeight.bodyfat && <span className="text-muted ml-2">· {todayWeight.bodyfat}% BF</span>}
              <span className="text-muted ml-2">logged today</span>
            </div>
          ) : null}
          <form onSubmit={saveWeight} className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input w-36" value={wForm.date}
                onChange={e => setWForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input type="number" step="0.1" min="30" max="300" className="input w-24" placeholder="kg"
                value={wForm.weight} onChange={e => setWForm(p => ({ ...p, weight: e.target.value }))} />
            </div>
            <div>
              <label className="label">BF% (opt)</label>
              <input type="number" step="0.1" min="3" max="60" className="input w-20" placeholder="%"
                value={wForm.bodyfat} onChange={e => setWForm(p => ({ ...p, bodyfat: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={wSaving || !wForm.weight}>
              {wSaving ? 'Saving…' : 'Save'}
            </button>
          </form>
          {w30.length > 1 && (
            <div className="mt-3">
              <WeightChart weights={w30} goalSettings={settings.goal} height={100} compact />
            </div>
          )}
          {weeklyRate !== null && (
            <div className="mt-2 text-xs text-muted">
              Last 7d:{' '}
              <span className={weeklyRate < 0 ? 'text-success' : 'text-warn'}>
                {weeklyRate > 0 ? '+' : ''}{weeklyRate} kg/week
              </span>
              {targetRate && (
                <span className="ml-2">
                  · Target: {settings.goal?.type === 'lose' ? '-' : '+'}{targetRate} kg
                  · {isOnTrack === true ? '✅ On track' : isOnTrack === false ? '⚠ Off track' : ''}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Macros today */}
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Apple size={16} className="text-accent" /> Macros Today
          </div>
          <div className="space-y-2 mb-3">
            {macros.map(m => {
              const pct = m.target ? Math.min(100, (m.actual / m.target) * 100) : 0
              const colour = pct > 105 ? 'bg-danger' : pct > 80 ? 'bg-success' : 'bg-accent'
              return (
                <div key={m.name}>
                  <div className="flex justify-between text-xs text-muted mb-0.5">
                    <span>{m.name}</span>
                    <span>{m.actual} / {m.target}</span>
                  </div>
                  <div className="w-full bg-surfaceAlt rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <button onClick={() => navigate('/nutrition')} className="btn-secondary text-xs">
            Log meal →
          </button>
        </div>

        {/* Today's checklist */}
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <CheckSquare size={16} className="text-accent" /> Today's Checklist
          </div>
          {todayPlannerItems.length === 0 && medsDueToday.length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled. Add tasks in Planner or Meds.</p>
          ) : (
            <ul className="space-y-2">
              {todayPlannerItems.map(item => {
                const key = `${todayStr}_${item.id}`
                const done = completions[key]?.done
                return (
                  <li key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => togglePlannerItem(item)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlannerItem(item) } }}
                    className="flex items-center gap-3 cursor-pointer select-none py-1 -mx-1 px-1 rounded hover:bg-surfaceAlt/40 active:bg-surfaceAlt">
                    {done
                      ? <CheckSquare size={16} className="text-success shrink-0" />
                      : <Square size={16} className="text-muted shrink-0" />}
                    <span className={`text-sm ${done ? 'line-through text-muted' : 'text-text'}`}>{item.title}</span>
                  </li>
                )
              })}
              {medsDueToday.map(med => {
                const taken = medLogs.some(l => l.date === todayStr && l.medId === med.id)
                return (
                  <li key={med.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleMedTaken(med)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMedTaken(med) } }}
                    className="flex items-center gap-3 cursor-pointer select-none py-1 -mx-1 px-1 rounded hover:bg-surfaceAlt/40 active:bg-surfaceAlt">
                    {taken
                      ? <CheckSquare size={18} className="text-success shrink-0" />
                      : <Square size={18} className="text-warn shrink-0" />}
                    <span className={`text-sm flex-1 ${taken ? 'line-through text-muted' : 'text-text'}`}>
                      {med.name} {med.dose}{med.unit}
                    </span>
                    {med.frequency === 'weekly' && <span className="chip-warn text-xs">Weekly</span>}
                    {med.frequency === 'daily' && <span className="chip-warn text-xs">Daily</span>}
                    {med.frequency === 'specific-days' && <span className="chip-warn text-xs">Scheduled</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Muscle recovery summary */}
        <div className="card">
          <div className="card-title flex items-center gap-2">
            <Dumbbell size={16} className="text-accent" /> Recovery Status
          </div>
          {readyMuscles.length > 0 && (
            <p className="text-xs text-success mb-1">
              ✅ Recovered &amp; ready: {readyMuscles.join(', ')}
            </p>
          )}
          {fatiguedMuscles.length > 0 && (
            <p className="text-xs text-danger mb-1">
              🔴 Still fatigued: {fatiguedMuscles.join(', ')}
            </p>
          )}
          {readyMuscles.length === 0 && fatiguedMuscles.length === 0 && (
            <p className="text-xs text-muted">Log training sessions to see recovery status.</p>
          )}
          {/* Cardio this week summary */}
          <p className="text-xs text-muted mt-2">
            Cardio this week:{' '}
            <span className="text-text font-medium">{weekCardioSessions} session{weekCardioSessions !== 1 ? 's' : ''}</span>
            {weekCardioKm > 0 && <> · <span className="text-text font-medium">{weekCardioKm.toFixed(1)} km</span></>}
          </p>
          <button onClick={() => navigate('/training')} className="btn-ghost text-xs mt-2">
            View full heatmap →
          </button>
        </div>

      </div>

      {/* PRs today */}
      {todayPRs.length > 0 && (
        <div className="card border-warn/30 bg-warn/5">
          <div className="card-title flex items-center gap-2">
            <Trophy size={16} className="text-warn" /> New PRs Today!
          </div>
          <div className="flex flex-wrap gap-2">
            {todayPRs.map(pr => (
              <span key={pr} className="chip-warn">🏆 {pr}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
