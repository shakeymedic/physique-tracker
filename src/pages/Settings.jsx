import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { getSettings, saveSettings, getAll, addEntry, deleteEntry, setEntry } from '../data.js'
import { Download, LogOut, Save, CloudUpload, Bell, BellOff, Database, Award, X, Plus, Trash2, Pencil, Dumbbell, Activity, Zap, BookOpen, GripVertical, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react'
import { requestNotificationPermission } from '../lib/messaging.js'
import { backupToDrive } from '../lib/drive.js'
import { resolveProgram, computeWeekNumber } from '../training/programs.js'

const SEED_MEALS = [
  { name: 'Porridge with banana', kcal: 380, protein: 14, carbs: 60, fat: 8 },
  { name: 'Greek yoghurt with berries', kcal: 220, protein: 22, carbs: 18, fat: 6 },
  { name: 'Eggs on toast (2 eggs, 2 slices)', kcal: 380, protein: 22, carbs: 32, fat: 18 },
  { name: 'Chicken & rice bowl', kcal: 550, protein: 45, carbs: 60, fat: 12 },
  { name: 'Tuna jacket potato', kcal: 480, protein: 30, carbs: 65, fat: 8 },
  { name: 'Salmon, sweet potato, broccoli', kcal: 560, protein: 38, carbs: 45, fat: 22 },
  { name: 'Chicken pasta', kcal: 600, protein: 42, carbs: 75, fat: 12 },
  { name: 'Beef stir fry & noodles', kcal: 620, protein: 38, carbs: 70, fat: 18 },
  { name: 'Protein shake (whey + milk)', kcal: 250, protein: 32, carbs: 14, fat: 6 },
  { name: 'Peanut butter on toast', kcal: 320, protein: 12, carbs: 30, fat: 18 },
  { name: 'Apple + almonds (30g)', kcal: 260, protein: 7, carbs: 22, fat: 16 },
  { name: 'Chicken Caesar salad', kcal: 420, protein: 38, carbs: 12, fat: 24 },
]

const DEFAULT_SELF_CARE_CATEGORIES = [
  'skincare', 'walk', 'meditation', 'stretching', 'bath/shower', 'journalling',
  'reading', 'early bed', 'no alcohol', 'social time',
]

function Section({ title, children }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {children}
    </div>
  )
}

export default function Settings() {
  const { user, signOutUser } = useAuth()
  const uid = user?.uid
  const navigate = useNavigate()

  const [form, setForm] = useState({
    sex: 'M',
    height: '',
    nutritionKcal: '',
    nutritionProtein: '',
    nutritionCarbs: '',
    nutritionFat: '',
    spoonacularKey: '',
    geminiApiKey: '',
    lastDriveBackup: '',
    // Activity goals
    gymPerWeek: '3',
    cardioPerWeek: '2',
    cardioMinutesPerWeek: '90',
    stepsPerDay: '8000',
    selfCarePerWeek: '5',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [seedMsg, setSeedMsg] = useState('')
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushMsg, setPushMsg] = useState('')
  const [driveMsg, setDriveMsg] = useState('')
  const [driveBacking, setDriveBacking] = useState(false)
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY

  // Self-care categories
  const [selfCareCategories, setSelfCareCategories] = useState(DEFAULT_SELF_CARE_CATEGORIES)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    if (!uid) return
    getSettings(uid).then(s => {
      const ag = s.activityGoals || {}
      setForm({
        sex: s.sex || 'M',
        height: s.height || '',
        nutritionKcal: s.nutritionTargets?.kcal || '',
        nutritionProtein: s.nutritionTargets?.protein || '',
        nutritionCarbs: s.nutritionTargets?.carbs || '',
        nutritionFat: s.nutritionTargets?.fat || '',
        spoonacularKey: s.spoonacularKey || '',
        geminiApiKey: s.geminiApiKey || '',
        lastDriveBackup: s.lastDriveBackup || '',
        gymPerWeek: ag.gymPerWeek != null ? String(ag.gymPerWeek) : '3',
        cardioPerWeek: ag.cardioPerWeek != null ? String(ag.cardioPerWeek) : '2',
        cardioMinutesPerWeek: ag.cardioMinutesPerWeek != null ? String(ag.cardioMinutesPerWeek) : '90',
        stepsPerDay: ag.stepsPerDay != null ? String(ag.stepsPerDay) : '8000',
        selfCarePerWeek: ag.selfCarePerWeek != null ? String(ag.selfCarePerWeek) : '5',
      })
      if (s.selfCareCategories && Array.isArray(s.selfCareCategories) && s.selfCareCategories.length > 0) {
        setSelfCareCategories(s.selfCareCategories)
      }
    })
  }, [uid])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await saveSettings(uid, {
        sex: form.sex,
        height: form.height ? parseFloat(form.height) : null,
        nutritionTargets: {
          kcal: form.nutritionKcal ? parseInt(form.nutritionKcal) : null,
          protein: form.nutritionProtein ? parseInt(form.nutritionProtein) : null,
          carbs: form.nutritionCarbs ? parseInt(form.nutritionCarbs) : null,
          fat: form.nutritionFat ? parseInt(form.nutritionFat) : null,
        },
        spoonacularKey: form.spoonacularKey || null,
        geminiApiKey: form.geminiApiKey || null,
        activityGoals: {
          gymPerWeek: form.gymPerWeek ? parseInt(form.gymPerWeek) : 3,
          cardioPerWeek: form.cardioPerWeek ? parseInt(form.cardioPerWeek) : 2,
          cardioMinutesPerWeek: form.cardioMinutesPerWeek ? parseInt(form.cardioMinutesPerWeek) : 90,
          stepsPerDay: form.stepsPerDay ? parseInt(form.stepsPerDay) : 8000,
          selfCarePerWeek: form.selfCarePerWeek ? parseInt(form.selfCarePerWeek) : 5,
        },
        selfCareCategories,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  const addCategory = () => {
    const cat = newCategory.trim().toLowerCase()
    if (!cat || selfCareCategories.includes(cat)) return
    setSelfCareCategories(prev => [...prev, cat])
    setNewCategory('')
  }

  const removeCategory = (cat) => {
    setSelfCareCategories(prev => prev.filter(c => c !== cat))
  }

  const seedMeals = async () => {
    setSeeding(true); setSeedMsg('')
    try {
      const existing = await getAll(uid, 'mealTemplates')
      const existingNames = new Set(existing.map(t => t.name))
      let added = 0
      for (const meal of SEED_MEALS) {
        if (!existingNames.has(meal.name)) {
          await addEntry(uid, 'mealTemplates', meal)
          added++
        }
      }
      setSeedMsg(added > 0 ? `Added ${added} meal templates.` : 'All templates already exist.')
    } catch (e) {
      setSeedMsg('Error: ' + e.message)
    } finally { setSeeding(false) }
  }

  const enablePush = async () => {
    setPushMsg('')
    try {
      const token = await requestNotificationPermission(uid, vapidKey)
      if (token) { setPushEnabled(true); setPushMsg('Push notifications enabled!') }
      else { setPushMsg('Permission denied or unavailable.') }
    } catch (e) { setPushMsg(e.message) }
  }

  const doBackupToDrive = async () => {
    setDriveBacking(true); setDriveMsg('')
    try {
      const COLLECTIONS = ['weights', 'measurements', 'lifts', 'cardio', 'nutritionLog', 'bloods', 'medications', 'medicationLog', 'planner', 'mealTemplates', 'workoutTemplates', 'wellbeing', 'selfCareLog']
      const allData = {}
      for (const col of COLLECTIONS) { allData[col] = await getAll(uid, col) }
      await backupToDrive(allData)
      const ts = new Date().toISOString()
      await saveSettings(uid, { lastDriveBackup: ts })
      setDriveMsg('Backup complete: ' + new Date(ts).toLocaleString())
    } catch (e) {
      setDriveMsg('Drive backup failed: ' + e.message + '. Use CSV export instead.')
    } finally { setDriveBacking(false) }
  }

  const exportAll = async () => {
    const COLLECTIONS = ['weights', 'measurements', 'lifts', 'cardio', 'nutritionLog', 'bloods', 'medications', 'medicationLog', 'planner', 'mealTemplates', 'workoutTemplates', 'photos', 'wellbeing', 'selfCareLog']
    setExporting(true)
    try {
      for (const col of COLLECTIONS) {
        const data = await getAll(uid, col)
        if (!data.length) continue
        const headers = [...new Set(data.flatMap(d => Object.keys(d)))]
        const rows = data.map(d => headers.map(h => {
          const v = d[h]
          if (v === null || v === undefined) return ''
          if (typeof v === 'object') return JSON.stringify(v)
          return String(v).replace(/,/g, ';')
        }))
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `physique-tracker-${col}-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        await new Promise(r => setTimeout(r, 200))
      }
    } finally { setExporting(false) }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="space-y-4">
        <Section title="Profile">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Sex</label>
              <select className="input" value={form.sex} onChange={e => setForm(p => ({ ...p, sex: e.target.value }))}>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className="label">Height (cm)</label>
              <input type="number" min="100" max="250" step="0.1" className="input"
                value={form.height} onChange={e => setForm(p => ({ ...p, height: e.target.value }))} />
            </div>
          </div>
        </Section>

        <Section title="Activity Goals">
          <p className="text-xs text-muted mb-3">Used in Today, Insights and Achievements to track weekly progress.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { key: 'gymPerWeek', label: 'Gym sessions / week' },
              { key: 'cardioPerWeek', label: 'Cardio sessions / week' },
              { key: 'cardioMinutesPerWeek', label: 'Cardio minutes / week' },
              { key: 'stepsPerDay', label: 'Steps / day' },
              { key: 'selfCarePerWeek', label: 'Self-care sessions / week' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min="0" step="1" className="input"
                  value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Nutrition Targets (manual override)">
          <p className="text-xs text-muted mb-3">These are also set automatically by the Macros calculator in Nutrition.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { key: 'nutritionKcal', label: 'Calories (kcal)' },
              { key: 'nutritionProtein', label: 'Protein (g)' },
              { key: 'nutritionCarbs', label: 'Carbs (g)' },
              { key: 'nutritionFat', label: 'Fat (g)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min="0" className="input"
                  value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </Section>

        <Section title="API Keys">
          <p className="text-xs text-muted mb-3">Keys are stored in your Firestore user document and are never shared.</p>
          <div className="space-y-3">
            <div>
              <label className="label">Spoonacular API Key</label>
              <input type="password" className="input" placeholder="Enter key to enable meal planner"
                value={form.spoonacularKey} onChange={e => setForm(p => ({ ...p, spoonacularKey: e.target.value }))} />
            </div>
            <div>
              <label className="label">Gemini API Key</label>
              <input type="password" className="input" placeholder="Enter key to enable AI Coach"
                value={form.geminiApiKey} onChange={e => setForm(p => ({ ...p, geminiApiKey: e.target.value }))} />
              <p className="text-xs text-muted mt-1">
                Get a free key at{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                  className="text-accent underline">aistudio.google.com</a>
              </p>
            </div>
          </div>
        </Section>

        <button type="submit" className="btn-primary w-full" disabled={saving}>
          <Save size={14} /> {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>

      {/* Self-care categories editor */}
      <Section title="Self-Care Categories">
        <p className="text-sm text-muted mb-3">Customise the quick-log chips shown in the Wellbeing → Self-Care tab.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {selfCareCategories.map(cat => (
            <span key={cat}
              className="chip-ok flex items-center gap-1 cursor-pointer group">
              {cat}
              <button
                type="button"
                onClick={() => removeCategory(cat)}
                className="ml-0.5 opacity-60 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${cat}`}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-1"
            placeholder="Add category…"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
          />
          <button type="button" className="btn-secondary" onClick={addCategory} disabled={!newCategory.trim()}>
            <Plus size={14} /> Add
          </button>
        </div>
        <button
          type="button"
          className="btn-ghost text-xs mt-3"
          onClick={() => setSelfCareCategories(DEFAULT_SELF_CARE_CATEGORIES)}
        >
          Reset to defaults
        </button>
      </Section>

      {/* Active Program */}
      <ActiveProgramSection uid={uid} navigate={navigate}/>

      {/* Custom exercises management */}
      <CustomExercisesSection uid={uid}/>

      {/* Custom routines/programs links */}
      <Section title="Custom Routines &amp; Programs">
        <p className="text-sm text-muted mb-3">Manage your saved custom mobility routines and workout programs.</p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/training')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Activity size={14}/> Manage Routines (in Training → Mobility)
          </button>
          <button
            type="button"
            onClick={() => navigate('/training')}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Zap size={14}/> Manage Programs (in Training → Programs)
          </button>
        </div>
      </Section>

      {/* Achievements link */}
      <Section title="Achievements">
        <p className="text-sm text-muted mb-3">View your earned badges and streaks based on your logged data.</p>
        <button
          type="button"
          onClick={() => navigate('/achievements')}
          className="btn-secondary flex items-center gap-2"
        >
          <Award size={14} /> View Achievements
        </button>
      </Section>

      <Section title="Data Export">
        <p className="text-sm text-muted mb-3">Download all your data as CSV files (one per collection).</p>
        <button onClick={exportAll} className="btn-secondary" disabled={exporting}>
          <Download size={14} /> {exporting ? 'Exporting…' : 'Export All Data'}
        </button>
      </Section>

      <Section title="UK Meal Templates">
        <p className="text-sm text-muted mb-3">Seed 12 common UK meal templates to your Meals list for quick logging.</p>
        <button onClick={seedMeals} className="btn-secondary" disabled={seeding}>
          <Database size={14} /> {seeding ? 'Seeding…' : 'Seed UK Meal Templates'}
        </button>
        {seedMsg && <p className="text-xs text-success mt-2">{seedMsg}</p>}
      </Section>

      <Section title="Google Drive Backup">
        <p className="text-sm text-muted mb-2">Back up all your data as a JSON file to Google Drive.</p>
        <p className="text-xs text-muted mb-3">Requires <code className="text-accent">VITE_GOOGLE_CLIENT_ID</code> in <code>.env.local</code>. If Drive backup fails, use CSV export above.</p>
        {form.lastDriveBackup && (
          <p className="text-xs text-muted mb-2">Last backup: {new Date(form.lastDriveBackup).toLocaleString()}</p>
        )}
        <button onClick={doBackupToDrive} className="btn-secondary" disabled={driveBacking}>
          <CloudUpload size={14} /> {driveBacking ? 'Backing up…' : 'Back up now'}
        </button>
        {driveMsg && <p className="text-xs mt-2" style={{ color: driveMsg.includes('failed') ? '#ef4444' : '#10b981' }}>{driveMsg}</p>}
      </Section>

      <Section title="Push Notifications">
        <p className="text-sm text-muted mb-2">Push notifications are set up but require a backend to send reminders. Daily reminders coming in v3 — for now, the in-app checklist serves as your reminder.</p>
        {!vapidKey ? (
          <p className="text-xs text-muted">Configure <code className="text-accent">VITE_FIREBASE_VAPID_KEY</code> in <code>.env.local</code> to enable push notifications.</p>
        ) : (
          <>
            <button onClick={enablePush} className="btn-secondary" disabled={pushEnabled}>
              {pushEnabled ? <><Bell size={14} /> Notifications enabled</> : <><BellOff size={14} /> Enable push notifications</>}
            </button>
            {pushMsg && <p className="text-xs mt-2" style={{ color: pushMsg.includes('denied') || pushMsg.includes('Error') ? '#ef4444' : '#10b981' }}>{pushMsg}</p>}
          </>
        )}
      </Section>

      {/* Nav customisation */}
      <NavCustomSection uid={uid}/>

      {/* User guide */}
      <UserGuideSection/>

      <Section title="Account">
        <p className="text-sm text-muted mb-3">Signed in as <span className="text-text">{user?.email || user?.displayName}</span></p>
        <button onClick={signOutUser} className="btn-danger">
          <LogOut size={14} /> Sign Out
        </button>
      </Section>
    </div>
  )
}

// ── Active Program Section ─────────────────────────────────────────────────────
function ActiveProgramSection({ uid, navigate }) {
  const [settings, setSettings] = useState(null)
  const [customPrograms, setCustomPrograms] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getSettings(uid).then(setSettings)
    getAll(uid, 'customPrograms').then(setCustomPrograms)
  }, [uid])

  if (!settings) return null

  const activeProgram = settings.activeProgram
  const programDef = activeProgram ? resolveProgram(activeProgram.id, customPrograms) : null

  const exitProgram = async () => {
    if (!confirm('Exit current program?')) return
    setSaving(true)
    try {
      await saveSettings(uid, { activeProgram: null })
      setSettings(prev => ({ ...prev, activeProgram: null }))
    } finally { setSaving(false) }
  }

  if (!programDef) return (
    <Section title="Active Program">
      <p className="text-sm text-muted mb-3">No active program. Start one in Training → Programs.</p>
      <button
        type="button"
        onClick={() => navigate('/training')}
        className="btn-secondary flex items-center gap-2 text-sm"
      >
        <Dumbbell size={14}/> Browse Programs
      </button>
    </Section>
  )

  const weekNum = computeWeekNumber(activeProgram, programDef)
  const totalWeeks = programDef.durationWeeks
  const pct = Math.round((weekNum / totalWeeks) * 100)

  return (
    <Section title="Active Program">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-semibold text-text">{programDef.name}</div>
          <div className="text-xs text-muted">Week {weekNum} of {totalWeeks} · Started {activeProgram.startDate}</div>
        </div>
        <span className="chip-ok text-xs">{programDef.difficulty}</span>
      </div>
      <div className="w-full bg-surfaceAlt rounded-full h-1.5 mb-3">
        <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }}/>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => navigate('/training')}
          className="btn-secondary text-xs"
        >
          View program details
        </button>
        <button
          type="button"
          onClick={exitProgram}
          className="btn-danger text-xs"
          disabled={saving}
        >
          {saving ? 'Exiting…' : 'Exit program'}
        </button>
      </div>
    </Section>
  )
}

// ── Custom Exercises Section ───────────────────────────────────────────────────
function CustomExercisesSection({ uid }) {
  const [exercises, setExercises] = useState([])
  const [editing, setEditing] = useState(null)
  const [editName, setEditName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getAll(uid, 'customExercises').then(setExercises)
  }, [uid])

  const deleteEx = async (id) => {
    if (!confirm('Delete this custom exercise?')) return
    await deleteEntry(uid, 'customExercises', id)
    setExercises(prev => prev.filter(e => e.id !== id))
  }

  const startEdit = (ex) => {
    setEditing(ex.id)
    setEditName(ex.name)
  }

  const saveEdit = async (ex) => {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await setEntry(uid, 'customExercises', ex.id, { ...ex, name: editName.trim() })
      setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, name: editName.trim() } : e))
      setEditing(null)
    } finally { setSaving(false) }
  }

  return (
    <Section title="Custom Exercises">
      <p className="text-sm text-muted mb-3">Exercises you've added. Edit names or delete here. Add new ones via the exercise picker in Training → Log.</p>
      {exercises.length === 0 ? (
        <p className="text-sm text-muted">No custom exercises yet.</p>
      ) : (
        <div className="space-y-2">
          {exercises.map(ex => (
            <div key={ex.id} className="flex items-center gap-2 bg-surfaceAlt rounded-xl px-3 py-2">
              {editing === ex.id ? (
                <>
                  <input
                    type="text"
                    className="input flex-1 text-sm py-1"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(ex) }}
                  />
                  <button onClick={() => saveEdit(ex)} className="btn-primary text-xs" disabled={saving}>
                    {saving ? '…' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(null)} className="btn-ghost text-xs">Cancel</button>
                </>
              ) : (
                <>
                  <Dumbbell size={13} className="text-accent shrink-0"/>
                  <span className="flex-1 text-sm text-text">{ex.name}</span>
                  <span className="text-xs text-muted">{ex.category}</span>
                  <button onClick={() => startEdit(ex)} className="btn-ghost p-1">
                    <Pencil size={13}/>
                  </button>
                  <button onClick={() => deleteEx(ex.id)} className="btn-ghost p-1 text-danger">
                    <Trash2 size={13}/>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ── Nav Customisation Section ───────────────────────────────────────────────────
function NavCustomSection({ uid }) {
  const [settings, setSettings] = useState(null)
  const [order, setOrder] = useState(null)
  const [hidden, setHidden] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { getSettings(uid).then(setSettings) }, [uid])

  if (!settings) return null

  // Nav tabs list (mirrors App.jsx ALL_TABS)
  const NAV_TABS = [
    { to: '/', label: 'Today', fixed: true },
    { to: '/insights', label: 'Insights' },
    { to: '/body', label: 'Body' },
    { to: '/training', label: 'Training' },
    { to: '/nutrition', label: 'Nutrition' },
    { to: '/bloods', label: 'Bloods' },
    { to: '/wellbeing', label: 'Wellbeing' },
    { to: '/meds', label: 'Meds' },
    { to: '/photos', label: 'Photos' },
    { to: '/planner', label: 'Planner' },
    { to: '/coach', label: 'Coach' },
    { to: '/settings', label: 'Settings', fixed: true },
  ]

  const rawOrder = order || settings.navOrder || NAV_TABS.map(t => t.to)
  const rawHidden = hidden || new Set(settings.navHidden || [])
  const moveable = NAV_TABS.filter(t => !t.fixed)

  const moveTab = (to, dir) => {
    const arr = [...rawOrder.filter(x => !NAV_TABS.find(t => t.to === x)?.fixed)]
    const idx = arr.indexOf(to)
    if (idx === -1) return
    const swap = idx + dir
    if (swap < 0 || swap >= arr.length) return
    ;[arr[idx], arr[swap]] = [arr[swap], arr[idx]]
    setOrder([
      '/', // Today always first
      ...arr,
      '/settings', // Settings always last
    ])
  }

  const toggleHide = (to) => {
    const next = new Set(rawHidden)
    next.has(to) ? next.delete(to) : next.add(to)
    setHidden(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      await saveSettings(uid, {
        navOrder: rawOrder,
        navHidden: [...rawHidden],
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const orderedMoveable = rawOrder
    .map(to => moveable.find(t => t.to === to))
    .filter(Boolean)
  // Add any not in order
  moveable.forEach(t => { if (!orderedMoveable.find(x => x.to === t.to)) orderedMoveable.push(t) })

  return (
    <Section title="Navigation Bar">
      <p className="text-sm text-muted mb-3">Show, hide, and reorder tabs in the navigation bar. Today and Settings are always shown.</p>
      <div className="space-y-2 mb-3">
        {orderedMoveable.map((tab, idx) => {
          const isHidden = rawHidden.has(tab.to)
          return (
            <div key={tab.to} className={`flex items-center gap-2 bg-surfaceAlt rounded-xl px-3 py-2.5 ${isHidden ? 'opacity-50' : ''}`}>
              <GripVertical size={14} className="text-muted shrink-0"/>
              <span className="text-sm text-text flex-1">{tab.label}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => moveTab(tab.to, -1)} disabled={idx === 0} className="btn-ghost p-0.5 disabled:opacity-30 text-xs">
                  <ArrowUp size={12}/>
                </button>
                <button onClick={() => moveTab(tab.to, 1)} disabled={idx === orderedMoveable.length - 1} className="btn-ghost p-0.5 disabled:opacity-30 text-xs">
                  <ArrowDown size={12}/>
                </button>
                <button onClick={() => toggleHide(tab.to)} className={`btn-ghost p-1 ml-1 ${isHidden ? 'text-muted' : 'text-accent'}`}>
                  {isHidden ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      <button onClick={save} className="btn-primary text-sm flex items-center gap-2" disabled={saving}>
        <Save size={14}/> {saved ? 'Saved!' : saving ? 'Saving...' : 'Save nav order'}
      </button>
    </Section>
  )
}

// ── User Guide Section ───────────────────────────────────────────────────────────
function UserGuideSection() {
  const [open, setOpen] = useState(false)

  const GUIDE = [
    {
      title: 'Getting started',
      content: `1. Set your profile in Settings → Profile (name, weight, body fat %, sex). This drives macro calculations.
2. Calculate your macros in Nutrition → Macros — enter your weight, body fat %, activity level, and goal. Save the result as your targets.
3. Set your activity goals in Settings → Activity Goals (gym sessions/week, cardio sessions/week).
4. Log your first weight in Today → Quick Weight Log or in Body → Weight.`,
    },
    {
      title: 'Daily use',
      content: `Today page is your dashboard. Each day:
• Log your weight first thing in the morning (fasted = most consistent).
• Log meals in Nutrition → Today as you eat. Use barcode scan for packaged food.
• After training, go to Training → Workout and log your session. Add exercises from the dropdown, log sets with weight, reps, and RPE.
• Log mood/energy/sleep in Wellbeing → Log at the end of the day.`,
    },
    {
      title: 'Training log',
      content: `Training → Workout: the main session logger.
• Pick exercises from the dropdown (grouped by type). Tap "+ New" to create a custom exercise.
• The ⓘ info button next to each exercise shows coaching cues and links to ExRx for full instructions.
• Weight carries over between sets — just change reps. Tick "Warm-up" to exclude a set from PR/tonnage calculations.
• Add a cardio block within the same session (e.g. 20 min bike after lifting).
• Session RPE: rate overall effort 1–10 before saving.
• History groups sessions by month. The All-Time PRs card shows your best e1RM per exercise.`,
    },
    {
      title: 'Programs',
      content: `Training → Programs: structured workout plans.
• 4 built-in programs: Stronglifts 5×5, PPL, 5/3/1 BBB, Hybrid.
• Create your own in the Programs tab → New program. Name your workout days, pick exercises, set the weekly schedule.
• Fork any built-in program with "Fork & customise" to edit a copy.
• When a program is active, Today page shows today's scheduled workout.
• Toggle between Fixed days mode (Mon=slot1 etc.) and Sequential mode (next workout whenever you train).`,
    },
    {
      title: 'Nutrition',
      content: `Nutrition → Today: log meals. Fields: name, kcal, protein, carbs, fat, fibre.
• Barcode scanner: tap the scan button to scan packaged food. Tick "Save as template" to reuse it.
• Quick Log: saved meal templates appear as one-tap chips. Frequently logged meals appear at the top.
• Copy yesterday: one tap to copy all of yesterday's meals to today.
• Net kcal mode: toggle on when you've logged cardio kcal — subtracts burn from shown total.
• Nutrition → Macros: goal-driven calculator using Katch-McArdle formula. Set your targets here.`,
    },
    {
      title: 'Wellbeing',
      content: `Wellbeing → Log: rate mood, energy, sleep quality (1–5), and stress. Log sleep hours separately.
• Symptoms: tap to select from a preset list (nausea, fatigue, etc.).
• Wellbeing → Trends: view individual metrics over time, or tap "All" for a multi-line overlay.
• Insights panel: auto-generated correlations — e.g. sleep hours vs energy score.`,
    },
    {
      title: 'Blood results',
      content: `Bloods: log 18 blood markers grouped by category (BP, lipids, liver, haematology, glucose, renal).
• Flag chips (✓ / ! / ✗) show whether each value is within UK reference ranges.
• Trends tab: plot any marker over time with reference lines shown on the chart.
• Delta indicators (↑↓) in history show change vs previous reading.
• Any "bad" flagged values surface on the Today page as a reminder.`,
    },
    {
      title: 'Medications',
      content: `Medications: track prescribed meds with dosing schedule (daily, weekly, specific days, as-needed).
• Mark doses taken from the Today checklist or the Medications list.
• Stat dose: log one-off doses (e.g. paracetamol) without affecting any schedule.
• Catch-up: log a late dose without shifting future scheduled dates.
• PK levels chart: plots estimated drug concentration over time using first-order pharmacokinetics. Requires half-life in hours (enter when adding the medication).
• Adherence % shown per medication (last 30 days).`,
    },
    {
      title: 'Body & Photos',
      content: `Body → Weight: log daily weight + body fat %. Lean body mass (LBM) is computed and shown as a dashed green line — useful for tracking body recomp when total weight stays stable.
Body → Measurements: log circumference measurements in cm (waist, chest, arms, thighs, neck, hips).
Photos: upload progress photos tagged as front/side/back. Timeline view shows photos chronologically with weight overlay. Compare: full-screen swipe between before and after.`,
    },
    {
      title: 'Insights page',
      content: `Insights shows your key metrics at a glance. Tap "Customise" to show/hide cards and change their order — saved to your account.
Activity Consistency: 90-day heatmap. Colour = activity type (gym=cyan, cardio=green, food=amber). Small dot below each week = gym goal hit that week.`,
    },
    {
      title: 'AI Coach',
      content: `Coach: chat with Gemini 2.5 Flash. The coach is pre-loaded with a summary of your current data (weight, goal, recent training, macro targets) so advice is personalised.
Add your Gemini API key in Settings → Gemini API Key. Free tier available at aistudio.google.com/app/apikey.
The coach will not provide advice on performance-enhancing drugs.`,
    },
    {
      title: 'Settings & customisation',
      content: `Settings → Profile: name, weight, body fat %, sex (used for blood reference ranges).
Settings → Navigation Bar: reorder and hide tabs to suit your workflow.
Settings → Insights: customise which cards appear on the Insights page.
Settings → Activity Goals: gym/cardio/self-care sessions per week (used for rings on Today + charts in Insights).
Settings → Data Export: download all your data as CSV files.
Settings → Google Drive Backup: backs up all data as a JSON file to your Drive.`,
    },
  ]

  return (
    <Section title="User Guide">
      <p className="text-sm text-muted mb-3">A comprehensive guide to every feature in Physique Tracker.</p>
      <button onClick={() => setOpen(o => !o)} className="btn-secondary flex items-center gap-2 mb-3">
        <BookOpen size={14}/> {open ? 'Hide guide' : 'Show user guide'}
      </button>
      {open && (
        <div className="space-y-4">
          {GUIDE.map(section => (
            <div key={section.title} className="bg-surfaceAlt rounded-xl p-4">
              <div className="text-sm font-semibold text-accent mb-2">{section.title}</div>
              <p className="text-xs text-muted whitespace-pre-line leading-relaxed">{section.content}</p>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}
