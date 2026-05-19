import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './auth.jsx'
import { ThemeProvider } from './theme.jsx'

// Register PWA service worker and handle updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available
            window.dispatchEvent(new CustomEvent('pwa-update-available', {
              detail: {
                wb: {
                  messageSkipWaiting: () => newWorker.postMessage({ type: 'SKIP_WAITING' }),
                  addEventListener: (event, cb) => navigator.serviceWorker.addEventListener(event, cb),
                }
              }
            }))
          }
        })
      })
    } catch (e) {
      // SW registration failure is non-fatal
      console.warn('SW registration failed:', e)
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
)
