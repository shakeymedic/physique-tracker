import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, isConfigured } from './firebase'

const AuthContext = createContext({ user: null, loading: true, signIn: () => {}, signOutUser: () => {} })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return }
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false) })
    return () => unsub()
  }, [])

  const signIn = async () => {
    if (!isConfigured) { alert('Firebase is not configured yet. See README.'); return }
    try { await signInWithPopup(auth, googleProvider) }
    catch (e) { console.error(e); alert('Sign-in failed: ' + e.message) }
  }
  const signOutUser = async () => { await signOut(auth) }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOutUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
