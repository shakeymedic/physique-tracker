import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

// Only initialize Firebase when configured, so ConfigMissing screen can render.
export const app = isConfigured ? initializeApp(firebaseConfig) : null
export const auth = isConfigured ? getAuth(app) : null
export const db = isConfigured ? getFirestore(app) : null
export const storage = isConfigured ? getStorage(app) : null
export const googleProvider = isConfigured ? new GoogleAuthProvider() : null
