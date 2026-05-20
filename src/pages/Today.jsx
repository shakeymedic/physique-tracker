import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { subscribe, addEntry, setEntry, getSettings, getAll } from '../data.js'
import { format, subDays, startOfWeek } from 'date-fns'
import { CheckSquare, Square, Apple, Trophy, Cloud, Dumbbell, Heart, Activity, Play } from 'lucide-react'
import { quoteOfTheDay } from '../lib/quotes.js'
import { computeAchievements } from '../lib/achievements.js'
import { isMedDueToday, lastTakenDate } from '../clinical/meds.js'
import { flag } from '../clinical/ranges.js'
import { computeMuscleRecovery, muscleStatus } from '../training/exercises.js'
import WeightChart, { computeWeeklyRate } from '../components/WeightChart.jsx'
import MoodPicker from '../components/MoodPicker.jsx'
import { resolveProgram, getTodayWorkout } from '../training/programs.js'

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
  const [latestBloods, setLatestBloods] = useState(null)

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
    getAll(uid, 'bloods').then(docs => {
      if (docs.length > 0) {
        const sorted = docs.sort((a, b) => b.date.localeCompare(a.date))
        setLatestBloods(sorted[0])
      }
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

  // A: Streak chips
  const { streaks } = computeAchievements({ weights, lifts, cardio, nutritionLog: nutrition, medicationLog: medLogs, wellbeing, selfCareLog, mobilityLog: [], settings })

  // B: Late-day training nudge
  const hour = new Date().getHours()
  const todayTrained = lifts.some(l => l.date === todayStr) || cardio.some(c => c.date === todayStr)
  const showTrainingNudge = hour >= 19 && !todayTrained && gymGoal > 0 && weekGymDays < gymGoal

  // L: Flagged blood values
  const flaggedBloods = latestBloods ? Object.entries(latestBloods)
    .filter(([k, v]) => v != null && typeof v === 'number' && flag(k, v, settings.profile?.sex || 'M') === 'bad')
    .map(([k]) => k) : []

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
          {/* Weekly wellbeing summary */}
          {(() => {
            const weekWb = wellbeing.filter(w => w.date >= weekStart)
            if (!weekWb.length) return null
            const avgMood = weekWb.filter(w => w.mood).length
              ? (weekWb.filter(w => w.mood).reduce((a, w) => a + w.mood, 0) / weekWb.filter(w => w.mood).length).toFixed(1)
              : null
            const avgSleep = weekWb.filter(w => w.sleepHours).length
              ? (weekWb.filter(w => w.sleepHours).reduce((a, w) => a + (parseFloat(w.sleepHours) || 0), 0) / weekWb.filter(w => w.sleepHours).length).toFixed(1)
              : null
            const symptomDays = weekWb.filter(w => w.symptoms?.length > 0).length
            return (
              <div className="mt-3 pt-2 border-t border-border/20">
                <p className="text-xs text-muted">
                  This week:
                  {avgMood && <> avg mood <span className="text-text font-medium">{avgMood}/5</span></>}
                  {avgSleep && <> · avg sleep <span className="text-text font-medium">{avgSleep}h</span></>}
                  {symptomDays > 0 && <> · <span className="text-warn">{symptomDays} symptom day{symptomDays !== 1 ? 's' : ''}</span></>}
                </p>
              </div>
            )
          })()}
          <button
            onClick={() => navigate('/wellbeing')}
            className="btn-ghost text-xs mt-2"
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
          {streaks.gymWeeks.current > 1 && (
            <p className="text-xs text-accent mt-1">🔥 {streaks.gymWeeks.current}-week gym streak</p>
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
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-accent font-bold text-2xl">{todayWeight.weight} kg</span>
                {todayWeight.bodyfat && <span className="text-muted text-sm">· {todayWeight.bodyfat}% BF</span>}
                <span className="chip-ok text-xs ml-auto">Logged ✓</span>
              </div>
              {streaks?.weighIn?.current > 1 && (
                <p className="text-xs text-accent">🔥 {streaks.weighIn.current}-day streak</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted mb-2">Not logged yet today — weigh in now.</p>
          )}
          <form onSubmit={saveWeight} className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input w-36" value={wForm.date}
                onChange={e => setWForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input type="number" step="0.1" min="30" max="300" className="input w-24" placeholder="kg"
                value={wForm.weight} inputMode="decimal" onChange={e => setWForm(p => ({ ...p, weight: e.target.value }))} />
            </div>
            <div>
              <label className="label">BF% (opt)</label>
              <input type="number" step="0.1" min="3" max="60" className="input w-20" placeholder="%"
                value={wForm.bodyfat} inputMode="decimal" onChange={e => setWForm(p => ({ ...p, bodyfat: e.target.value }))} />
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
            {streaks.mealsLogged.current > 1 && (
              <span className="text-xs text-success ml-auto">🔥 {streaks.mealsLogged.current}d streak</span>
            )}
          </div>
          <div className="space-y-2 mb-3">
            {macros.map(m => {
              const rawPct = m.target ? (m.actual / m.target) * 100 : 0
              const displayPct = Math.min(100, rawPct)
              const isOver = rawPct > 100
              const colour = isOver ? 'bg-danger' : rawPct >= 90 ? 'bg-success' : 'bg-accent'
              return (
                <div key={m.name}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-muted">{m.name}</span>
                    <span className={isOver ? 'text-danger font-semibold' : 'text-muted'}>
                      {m.actual} / {m.target}{isOver ? ` (+${Math.round(m.actual - m.target)} over)` : ''}
                    </span>
                  </div>
                  <div className="w-full bg-surfaceAlt rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full transition-all ${colour}`} style={{ width: `${displayPct}%` }} />
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
              {meds.filter(med => med.frequency === 'weekly' && !medsDueToday.find(m => m.id === med.id)).map(med => {
                const lt = lastTakenDate(medLogs, med.id)
                if (!lt) return null
                const nextDate = new Date(lt)
                nextDate.setDate(nextDate.getDate() + 7)
                const daysUntil = Math.ceil((nextDate - new Date()) / 86400000)
                if (daysUntil <= 0 || daysUntil > 7) return null
                return (
                  <li key={`next-${med.id}`} className="flex items-center gap-3 py-1 text-sm text-muted">
                    <span className="text-accent text-xs">💊</span>
                    <span>{med.name} {med.dose}{med.unit} — next dose in {daysUntil} day{daysUntil !== 1 ? 's' : ''}</span>
                  </li>
                )
              })}
            </ul>
          )}
        {meds.filter(m => m.frequency !== 'asNeeded').length > 0 && (() => {
          const weekStart2 = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
          const scheduledMeds = meds.filter(m => m.frequency !== 'asNeeded')
          const takenThisWeek = medLogs.filter(l => l.date >= weekStart2 && !l.outOfSchedule && !l.stat)
          const takenMedIds = new Set(takenThisWeek.map(l => l.medId))
          const adherent = scheduledMeds.filter(m => takenMedIds.has(m.id)).length
          const pct = Math.round((adherent / scheduledMeds.length) * 100)
          return (
            <div className="mt-2 pt-2 border-t border-border/20">
              <p className="text-xs text-muted">
                Meds this week: <span className={pct >= 90 ? 'text-success' : pct >= 70 ? 'text-warn' : 'text-danger'}>
                  {adherent}/{scheduledMeds.length} taken ({pct}%)
                </span>
              </p>
            </div>
          )
        })()}
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

      {/* Flagged blood results */}
      {flaggedBloods.length > 0 && (
        <div className="card border-danger/30 bg-danger/5">
          <p className="text-xs text-danger flex items-center gap-2">
            <span>⚠</span> Last bloods: {flaggedBloods.join(', ')} flagged — 
            <button onClick={() => navigate('/bloods')} className="underline">view</button>
          </p>
        </div>
      )}

      {/* B: Late-day training nudge */}
      {showTrainingNudge && (
        <div className="card border-accent/20 bg-accent/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">No training logged yet today</p>
              <p className="text-xs text-muted">{weekGymDays}/{gymGoal} sessions this week</p>
            </div>
            <button onClick={() => navigate('/training')} className="btn-primary text-xs flex items-center gap-1">
              <Dumbbell size={12}/> Log session
            </button>
          </div>
        </div>
      )}

      {/* Active program today's plan */}
      {settings.activeProgram && <TodayProgramPanel activeProgram={settings.activeProgram} navigate={navigate}/>}

    </div>
  )
}

// ── Today’s program plan panel ─────────────────────────────────────────────────
function TodayProgramPanel({ activeProgram, navigate }) {
  const { user } = useAuth()
  const [customPrograms, setCustomPrograms] = useState([])
  useEffect(() => {
    if (user?.uid) getAll(user.uid, 'customPrograms').then(setCustomPrograms)
  }, [user?.uid])

  const programDef = resolveProgram(activeProgram.id, customPrograms)
  if (!programDef) return null

  const todayWorkoutKey = getTodayWorkout(programDef, activeProgram)
  const workout = todayWorkoutKey !== 'rest'
    ? (programDef.workouts?.[todayWorkoutKey] || null)
    : null

  const isRest = todayWorkoutKey === 'rest'
  const isCardio = workout?.type === 'cardio'
  const isMobility = workout?.type === 'mobility'

  return (
    <div className="card border-accent/20 bg-accent/5">
      <div className="card-title flex items-center gap-2">
        <Dumbbell size={16} className="text-accent" />
        Today’s Plan — {programDef.name}
      </div>

      {isRest ? (
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-text">😴 Rest Day</div>
            <p className="text-xs text-muted">Recovery is progress.</p>
          </div>
          <button onClick={() => navigate('/training')} className="btn-ghost text-xs">
            View program →
          </button>
        </div>
      ) : isCardio ? (
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-text">{workout.name}</div>
            <p className="text-xs text-muted">{workout.description}</p>
          </div>
          <button onClick={() => navigate('/training')} className="btn-primary text-xs flex items-center gap-1 shrink-0">
            <Play size={12}/> Log
          </button>
        </div>
      ) : isMobility ? (
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-text">{workout.name}</div>
            <p className="text-xs text-muted">{workout.description}</p>
          </div>
          <button onClick={() => navigate('/training')} className="btn-primary text-xs flex items-center gap-1 shrink-0">
            <Play size={12}/> Start
          </button>
        </div>
      ) : workout ? (
        <div>
          <div className="text-sm font-semibold text-text mb-2">{workout.name}</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {(workout.exercises || []).map((ex, i) => (
              <span key={i} className="text-xs bg-surfaceAlt text-text px-2 py-0.5 rounded-full">
                {ex.name}
              </span>
            ))}
          </div>
          <button
            onClick={() => navigate('/training')}
            className="btn-primary text-xs flex items-center gap-1"
          >
            <Play size={12}/> Start session
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">No specific workout today.</p>
      )}
    </div>
  )

}
