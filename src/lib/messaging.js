/**
 * Firebase Cloud Messaging setup.
 *
 * NOTE: Actually SENDING push notifications requires a server (e.g. Cloud Functions).
 * This file handles the client-side "ready to receive" setup only.
 * Daily reminders are planned for v3 — for now, the in-app checklist serves as reminders.
 */

import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { app, isConfigured } from '../firebase'
import { saveSettings } from '../data.js'

/**
 * Request notification permission and register for FCM.
 * @param {string} uid - Firebase user ID
 * @param {string} vapidKey - VAPID key from Firebase console
 * @returns {string|null} FCM token or null if permission denied
 */
export async function requestNotificationPermission(uid, vapidKey) {
  if (!isConfigured || !app) throw new Error('Firebase not configured')
  if (!vapidKey) throw new Error('VAPID key not set. Add VITE_FIREBASE_VAPID_KEY to .env.local')

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return null

  const messaging = getMessaging(app)
  const token = await getToken(messaging, { vapidKey })
  if (uid && token) {
    await saveSettings(uid, { fcmToken: token })
  }
  return token
}

/**
 * Listen for foreground messages.
 * @param {function} onMsg - callback({ title, body })
 * @returns unsubscribe function
 */
export function onForegroundMessage(onMsg) {
  if (!isConfigured || !app) return () => {}
  try {
    const messaging = getMessaging(app)
    return onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {}
      onMsg({ title, body })
    })
  } catch {
    return () => {}
  }
}
