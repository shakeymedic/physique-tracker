// Firestore data access layer. Each function takes a userId so security rules
// can enforce `request.auth.uid == userId`. Data shape is denormalized per user.
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, deleteDoc,
  query, orderBy, limit, where, serverTimestamp, onSnapshot,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage'
import { db, storage } from './firebase'

const userCol = (uid, name) => collection(db, 'users', uid, name)
const userDoc = (uid, name, id) => doc(db, 'users', uid, name, id)

// ----- generic helpers -----
export async function addEntry(uid, collectionName, data) {
  return await addDoc(userCol(uid, collectionName), { ...data, createdAt: serverTimestamp() })
}
export async function setEntry(uid, collectionName, id, data) {
  await setDoc(userDoc(uid, collectionName, id), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}
export async function deleteEntry(uid, collectionName, id) {
  await deleteDoc(userDoc(uid, collectionName, id))
}
export function subscribe(uid, collectionName, cb, opts = {}) {
  const ref = opts.orderByField
    ? query(userCol(uid, collectionName), orderBy(opts.orderByField, opts.dir || 'desc'), limit(opts.limit || 500))
    : query(userCol(uid, collectionName), orderBy('date', 'desc'), limit(opts.limit || 500))
  return onSnapshot(ref, (snap) => cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
}
export async function getAll(uid, collectionName, opts = {}) {
  const ref = opts.orderByField
    ? query(userCol(uid, collectionName), orderBy(opts.orderByField, opts.dir || 'desc'))
    : userCol(uid, collectionName)
  const snap = await getDocs(ref)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ----- settings (single doc) -----
export async function getSettings(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'meta', 'settings'))
  return snap.exists() ? snap.data() : {}
}
export async function saveSettings(uid, data) {
  await setDoc(doc(db, 'users', uid, 'meta', 'settings'), { ...data, updatedAt: serverTimestamp() }, { merge: true })
}

// ----- progress photos in Storage -----
export async function uploadPhoto(uid, file, label) {
  const stamp = Date.now()
  const safe = (label || 'photo').replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  const path = `users/${uid}/photos/${stamp}-${safe}-${file.name}`
  const r = ref(storage, path)
  await uploadBytes(r, file)
  const url = await getDownloadURL(r)
  await addEntry(uid, 'photos', { url, path, label: label || 'photo', date: new Date().toISOString().slice(0,10) })
  return url
}
export async function listPhotos(uid) {
  return await getAll(uid, 'photos', { orderByField: 'date', dir: 'desc' })
}
export async function deletePhoto(uid, photo) {
  if (photo.path) { try { await deleteObject(ref(storage, photo.path)) } catch (e) { console.warn(e) } }
  await deleteEntry(uid, 'photos', photo.id)
}
