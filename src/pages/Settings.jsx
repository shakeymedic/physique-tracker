import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { getSettings, saveSettings, getAll, addEntry } from '../data.js'
import { Download, LogOut, Save, CloudUpload, Bell, BellOff, Database, Award, X, Plus } from 'lucide-react'
import { requestNotificationPermission } from '../lib/messaging.js'
import { backupToDrive } from '../lib/drive.js'

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

      <Section title="Account">
        <p className="text-sm text-muted mb-3">Signed in as <span className="text-text">{user?.email || user?.displayName}</span></p>
        <button onClick={signOutUser} className="btn-danger">
          <LogOut size={14} /> Sign Out
        </button>
      </Section>
    </div>
  )
}
