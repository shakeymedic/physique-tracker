/**
 * Google Drive backup helper using the Drive API v3.
 *
 * NOTE: This requires the user to have signed in with Google and granted
 * the drive.file scope. Because the app already uses Firebase Google sign-in,
 * we request this scope incrementally via Google Identity Services.
 *
 * If Drive integration proves too complex for the deployment environment,
 * fallback to the CSV export in Settings which is always available.
 */

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const BACKUP_FILENAME = 'physique-tracker-backup.json'
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const FILES_URL = 'https://www.googleapis.com/drive/v3/files'

/**
 * Get a Google OAuth access token with drive.file scope.
 * Uses Google Identity Services (GIS) tokenClient.
 * Returns a Promise<string> that resolves with the access token.
 */
function getAccessToken() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'))
      return
    }
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID not set. Add it to .env.local for Drive backup.'))
      return
    }
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) reject(new Error(response.error))
        else resolve(response.access_token)
      },
    })
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

/**
 * Find an existing backup file by name. Returns file id or null.
 */
async function findBackupFile(token) {
  const url = `${FILES_URL}?q=name='${BACKUP_FILENAME}' and trashed=false&fields=files(id,name)&spaces=drive`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Drive search failed: ${res.status}`)
  const data = await res.json()
  return data.files?.[0]?.id || null
}

/**
 * Upload allData as JSON to Google Drive (create or update).
 * @param {object} allData - all collections to back up
 * @param {function} [onProgress] - optional progress callback (not used, reserved)
 * @returns {{ fileId: string }}
 */
export async function backupToDrive(allData) {
  const token = await getAccessToken()
  const json = JSON.stringify(allData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })

  const existingId = await findBackupFile(token)

  const metadata = { name: BACKUP_FILENAME, mimeType: 'application/json' }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', blob)

  let url, method
  if (existingId) {
    url = `${UPLOAD_URL}/${existingId}?uploadType=multipart`
    method = 'PATCH'
  } else {
    url = `${UPLOAD_URL}?uploadType=multipart`
    method = 'POST'
  }

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Drive upload failed: ${res.status}`)
  }
  const file = await res.json()
  return { fileId: file.id }
}
