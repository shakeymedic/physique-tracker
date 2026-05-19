/**
 * UpdateToast — shows a bottom toast when a new PWA version is available.
 * Usage: mount once in App.jsx; it manages its own visibility.
 */
import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export default function UpdateToast() {
  const [show, setShow] = useState(false)
  const [wb, setWb] = useState(null) // workbox instance from vite-plugin-pwa

  useEffect(() => {
    // vite-plugin-pwa exposes a `useRegisterSW` hook; we handle the callback here.
    // Listen for a custom event dispatched by main.jsx when update is available.
    const handleUpdate = (e) => {
      setWb(e.detail?.wb || null)
      setShow(true)
    }
    window.addEventListener('pwa-update-available', handleUpdate)
    return () => window.removeEventListener('pwa-update-available', handleUpdate)
  }, [])

  const handleRefresh = () => {
    if (wb) {
      wb.messageSkipWaiting()
      wb.addEventListener('controlling', () => window.location.reload())
    } else {
      window.location.reload()
    }
    setShow(false)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-surface border border-border/60 rounded-2xl px-4 py-3 shadow-xl text-sm">
      <span className="text-text">A new version is available.</span>
      <button onClick={handleRefresh} className="btn-primary py-1 px-3 gap-1 text-xs">
        <RefreshCw size={13}/> Refresh
      </button>
      <button onClick={() => setShow(false)} className="btn-ghost p-1 text-muted text-xs">Dismiss</button>
    </div>
  )
}
