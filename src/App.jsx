import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LogOut, LayoutDashboard, Dumbbell, Apple, Activity, Pill, Camera, Settings,
  Ruler, ClipboardList, Sparkles, Sun, Moon, Cloud, CloudOff, Home, Heart } from 'lucide-react'
import { useAuth } from './auth.jsx'
import { isConfigured } from './firebase.js'
import { useTheme } from './theme.jsx'
import { useEffect, useState } from 'react'
import Login from './pages/Login.jsx'
import Today from './pages/Today.jsx'
import Insights from './pages/Dashboard.jsx'
import BodyLog from './pages/BodyLog.jsx'
import Training from './pages/Training.jsx'
import Nutrition from './pages/Nutrition.jsx'
import Bloods from './pages/Bloods.jsx'
import Medications from './pages/Medications.jsx'
import Photos from './pages/Photos.jsx'
import Planner from './pages/Planner.jsx'
import Coach from './pages/Coach.jsx'
import SettingsPage from './pages/Settings.jsx'
import Wellbeing from './pages/Wellbeing.jsx'
import Achievements from './pages/Achievements.jsx'
import UpdateToast from './components/UpdateToast.jsx'

const tabs = [
  { to: '/', label: 'Today', icon: Home, end: true },
  { to: '/insights', label: 'Insights', icon: LayoutDashboard },
  { to: '/body', label: 'Body', icon: Ruler },
  { to: '/training', label: 'Training', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Apple },
  { to: '/bloods', label: 'Bloods', icon: Activity },
  { to: '/wellbeing', label: 'Wellbeing', icon: Heart },
  { to: '/meds', label: 'Meds', icon: Pill },
  { to: '/photos', label: 'Photos', icon: Camera },
  { to: '/planner', label: 'Planner', icon: ClipboardList },
  { to: '/coach', label: 'Coach', icon: Sparkles },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SyncIndicator() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
    ? <Cloud size={16} className="text-accent" title="Synced"/>
    : <CloudOff size={16} className="text-danger" title="Offline"/>
}

export default function App() {
  const { user, loading, signOutUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline) }
  }, [])

  if (!isConfigured) return <ConfigMissing />
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted">Loading…</div>
  if (!user) return <Login />

  return (
    <div className="min-h-screen pb-20">
      {!isOnline && (
        <div className="bg-warn/90 text-bg text-xs text-center py-1 px-4 font-medium sticky top-0 z-30">
          Offline — data will sync when reconnected
        </div>
      )}
      <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-border/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent font-bold">PT</div>
            <div>
              <div className="text-sm font-semibold leading-tight">Physique Tracker</div>
              <div className="text-xs text-muted leading-tight">{user.displayName || user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <SyncIndicator/>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="btn-ghost" title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <button onClick={signOutUser} className="btn-ghost" title="Sign out"><LogOut size={16}/></button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-2 flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({isActive}) =>
              `shrink-0 flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg mb-2 transition-colors ${isActive ? 'bg-accent/15 text-accent' : 'text-muted hover:text-text'}`}>
              <t.icon size={16} className="md:shrink-0"/>
              <span className="hidden md:inline">{t.label}</span>
              <span className="md:hidden">{t.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/body" element={<BodyLog />} />
          <Route path="/training" element={<Training />} />
          <Route path="/nutrition" element={<Nutrition />} />
          <Route path="/bloods" element={<Bloods />} />
          <Route path="/meds" element={<Medications />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/wellbeing" element={<Wellbeing />} />
          <Route path="/achievements" element={<Achievements />} />
          {/* Legacy redirect */}
          <Route path="/dashboard" element={<Navigate to="/insights" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <UpdateToast/>
    </div>
  )
}

function ConfigMissing() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-lg">
        <div className="card-title">Firebase configuration missing</div>
        <p className="text-sm text-muted mb-3">Create a <code className="text-accent">.env.local</code> file in the project root with your Firebase project keys. See <code>.env.example</code> for the template and the README for setup steps.</p>
        <p className="text-sm text-muted">After saving, restart the dev server.</p>
      </div>
    </div>
  )
}
