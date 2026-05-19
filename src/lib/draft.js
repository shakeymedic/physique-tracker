/**
 * Autosave / draft helpers for in-progress forms.
 * Drafts are stored in localStorage under keys like `pt-draft-{form}-{uid}`.
 */

export function saveDraft(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, at: Date.now() }))
  } catch (e) {
    // Quota exceeded or private browsing — ignore silently
    console.warn('saveDraft failed:', e)
  }
}

export function loadDraft(key, maxAgeMs = 24 * 60 * 60 * 1000) {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    const { data, at } = JSON.parse(raw)
    if (Date.now() - at > maxAgeMs) return null
    return { data, at }
  } catch {
    return null
  }
}

export function clearDraft(key) {
  localStorage.removeItem(key)
}

/** Format a timestamp (ms) as a human-readable "X minutes ago" string */
export function draftAgo(at) {
  const diffMs = Date.now() - at
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}
