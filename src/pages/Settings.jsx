import { useEffect, useState } from 'react'
import { useAuth } from '../auth.jsx'
import { getSettings, saveSettings, getAll } from '../data.js'
import { Download, LogOut, Save } from 'lucide-react'

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

  const [form, setForm] = useState({
    sex: 'M',
    height: '',
    nutritionKcal: '',
    nutritionProtein: '',
    nutritionCarbs: '',
    nutritionFat: '',
    spoonacularKey: '',
    geminiApiKey: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!uid) return
    getSettings(uid).then(s => {
      setForm({
        sex: s.sex || 'M',
        height: s.height || '',
        nutritionKcal: s.nutritionTargets?.kcal || '',
        nutritionProtein: s.nutritionTargets?.protein || '',
        nutritionCarbs: s.nutritionTargets?.carbs || '',
        nutritionFat: s.nutritionTargets?.fat || '',
        spoonacularKey: s.spoonacularKey || '',
        geminiApiKey: s.geminiApiKey || '',
      })
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
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally { setSaving(false) }
  }

  const exportAll = async () => {
    const COLLECTIONS = ['weights','measurements','lifts','nutritionLog','bloods','medications','medicationLog','planner','mealTemplates','workoutTemplates','photos']
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
        a.download = `physique-tracker-${col}-${new Date().toISOString().slice(0,10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        await new Promise(r => setTimeout(r, 200)) // small delay between downloads
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
                value={form.height} onChange={e => setForm(p => ({ ...p, height: e.target.value }))}/>
            </div>
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
                  value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}/>
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
                value={form.spoonacularKey} onChange={e => setForm(p => ({ ...p, spoonacularKey: e.target.value }))}/>
            </div>
            <div>
              <label className="label">Gemini API Key</label>
              <input type="password" className="input" placeholder="Enter key to enable AI Coach"
                value={form.geminiApiKey} onChange={e => setForm(p => ({ ...p, geminiApiKey: e.target.value }))}/>
              <p className="text-xs text-muted mt-1">
                Get a free key at{' '}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
                  className="text-accent underline">aistudio.google.com</a>
              </p>
            </div>
          </div>
        </Section>

        <button type="submit" className="btn-primary w-full" disabled={saving}>
          <Save size={14}/> {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>

      <Section title="Data Export">
        <p className="text-sm text-muted mb-3">Download all your data as CSV files (one per collection).</p>
        <button onClick={exportAll} className="btn-secondary" disabled={exporting}>
          <Download size={14}/> {exporting ? 'Exporting…' : 'Export All Data'}
        </button>
      </Section>

      <Section title="Account">
        <p className="text-sm text-muted mb-3">Signed in as <span className="text-text">{user?.email || user?.displayName}</span></p>
        <button onClick={signOutUser} className="btn-danger">
          <LogOut size={14}/> Sign Out
        </button>
      </Section>
    </div>
  )
}
