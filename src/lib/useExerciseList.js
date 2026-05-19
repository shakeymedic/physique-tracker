/**
 * Hook: merges built-in exercises with user's custom exercises.
 * Returns { all, builtIn, custom, loading }
 */
import { useEffect, useState } from 'react'
import { subscribe } from '../data.js'
import { BUILT_IN_EXERCISES } from '../training/exercises.js'

export function useExerciseList(uid) {
  const [custom, setCustom] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) {
      setLoading(false)
      return
    }
    const unsub = subscribe(uid, 'customExercises', (data) => {
      setCustom(data)
      setLoading(false)
    }, { orderByField: 'createdAt', dir: 'asc' })
    return unsub
  }, [uid])

  const all = [
    ...BUILT_IN_EXERCISES,
    ...custom.map(c => ({
      name: c.name,
      primary: c.primary || [],
      secondary: c.secondary || [],
      category: c.category || 'other',
      isCustom: true,
      id: c.id,
    })),
  ]

  return { all, builtIn: BUILT_IN_EXERCISES, custom, loading }
}
