import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../auth.jsx'
import { uploadPhoto, listPhotos, deletePhoto, getAll } from '../data.js'
import { format } from 'date-fns'
import { Camera, Trash2, GitCompare, X, Upload, Clock } from 'lucide-react'

const LABELS = ['front', 'side', 'back']

function TimelineTab({ photos, weights }) {
  const [enlarged, setEnlarged] = useState(null)
  const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date))

  const getWeight = (date) => {
    if (!weights.length) return null
    // find exact match or nearest
    const exact = weights.find(w => w.date === date)
    if (exact) return exact.weight
    const sorted = [...weights].sort((a, b) =>
      Math.abs(new Date(a.date) - new Date(date)) - Math.abs(new Date(b.date) - new Date(date))
    )
    return sorted[0]?.weight || null
  }

  if (sorted.length === 0) {
    return (
      <div className="card text-center py-8">
        <Clock size={40} className="text-muted mx-auto mb-2"/>
        <p className="text-sm text-muted">No photos yet. Upload some to see the timeline.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {enlarged && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setEnlarged(null)}>
          <img src={enlarged.url} alt={enlarged.label}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"/>
          <button className="absolute top-4 right-4 btn-ghost bg-bg/60 rounded-lg p-2">
            <X size={18}/>
          </button>
        </div>
      )}

      <div className="card">
        <div className="card-title">Photo Timeline</div>
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {sorted.map(p => {
            const w = getWeight(p.date)
            return (
              <div key={p.id} className="shrink-0 cursor-pointer" onClick={() => setEnlarged(p)}>
                <img src={p.url} alt={p.label}
                  className="w-24 h-32 object-cover rounded-xl hover:opacity-90 transition-opacity"/>
                <div className="text-xs text-muted text-center mt-1">{p.date.slice(5)}</div>
                {w && <div className="text-xs text-accent text-center">{w} kg</div>}
                <div className="text-xs text-muted text-center capitalize">{p.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Photos() {
  const { user } = useAuth()
  const uid = user?.uid
  const [photos, setPhotos] = useState([])
  const [weights, setWeights] = useState([])
  const [uploading, setUploading] = useState(false)
  const [label, setLabel] = useState('front')
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [selected, setSelected] = useState([])
  const [compareMode, setCompareMode] = useState(false)
  const [view, setView] = useState('gallery') // 'gallery' | 'timeline'
  const fileRef = useRef()

  useEffect(() => {
    if (!uid) return
    listPhotos(uid).then(setPhotos)
    getAll(uid, 'weights', { orderByField: 'date', dir: 'asc' }).then(setWeights)
  }, [uid])

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const upload = async (e) => {
    e.preventDefault()
    if (!file) return
    setUploading(true)
    try {
      await uploadPhoto(uid, file, label)
      const updated = await listPhotos(uid)
      setPhotos(updated)
      setFile(null)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } finally { setUploading(false) }
  }

  const remove = async (photo) => {
    await deletePhoto(uid, photo)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    setSelected(prev => prev.filter(id => id !== photo.id))
  }

  const toggleSelect = (photo) => {
    if (!compareMode) return
    setSelected(prev => {
      if (prev.includes(photo.id)) return prev.filter(id => id !== photo.id)
      if (prev.length >= 2) return [prev[1], photo.id]
      return [...prev, photo.id]
    })
  }

  const getWeight = (date) => weights.find(w => w.date === date)?.weight

  // Group by date
  const grouped = photos.reduce((acc, p) => {
    acc[p.date] = acc[p.date] || []
    acc[p.date].push(p)
    return acc
  }, {})

  const comparePhotos = selected.map(id => photos.find(p => p.id === id)).filter(Boolean)

  return (
    <div className="space-y-4">
      {/* Upload form */}
      <div className="card">
        <div className="card-title flex items-center gap-2"><Upload size={16} className="text-accent"/>Upload Progress Photo</div>
        <form onSubmit={upload} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date}
              onChange={e => setDate(e.target.value)}/>
          </div>
          <div>
            <label className="label">Label</label>
            <select className="input" value={label} onChange={e => setLabel(e.target.value)}>
              {LABELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Photo</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment"
              className="input py-1.5 text-sm cursor-pointer" onChange={handleFile}/>
          </div>
          {preview && (
            <div className="md:col-span-3">
              <img src={preview} alt="preview" className="max-h-40 rounded-lg object-cover"/>
            </div>
          )}
          <div className="md:col-span-3">
            <button type="submit" className="btn-primary" disabled={uploading || !file}>
              {uploading ? 'Uploading…' : 'Upload Photo'}
            </button>
          </div>
        </form>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => { setView('gallery'); setCompareMode(false); setSelected([]) }}
          className={view === 'gallery' ? 'btn-primary' : 'btn-secondary'}>
          <Camera size={14}/> Gallery
        </button>
        <button onClick={() => { setView('timeline'); setCompareMode(false); setSelected([]) }}
          className={view === 'timeline' ? 'btn-primary' : 'btn-secondary'}>
          <Clock size={14}/> Timeline
        </button>
        {view === 'gallery' && (
          <button onClick={() => { setCompareMode(c => !c); setSelected([]) }}
            className={compareMode ? 'btn-primary' : 'btn-secondary'}>
            <GitCompare size={14}/> {compareMode ? 'Cancel Compare' : 'Compare'}
          </button>
        )}
        {compareMode && <span className="text-sm text-muted">Select 2 photos to compare</span>}
      </div>

      {/* Timeline view */}
      {view === 'timeline' && <TimelineTab photos={photos} weights={weights}/>}

      {/* Compare view (gallery only) */}
      {view === 'gallery' && compareMode && selected.length === 2 && (
        <div className="card">
          <div className="card-title">Comparison</div>
          <div className="grid grid-cols-2 gap-4">
            {comparePhotos.map(p => {
              const w = getWeight(p.date)
              return (
                <div key={p.id} className="text-center">
                  <img src={p.url} alt={p.label} className="w-full rounded-xl object-cover aspect-[3/4]"/>
                  <div className="text-sm font-medium mt-2">{p.date}</div>
                  <div className="text-xs text-muted capitalize">{p.label}</div>
                  {w && <div className="text-xs text-accent">{w} kg</div>}
                </div>
              )
            })}
          </div>
          {comparePhotos.length === 2 && (() => {
            const w1 = getWeight(comparePhotos[0].date)
            const w2 = getWeight(comparePhotos[1].date)
            if (!w1 || !w2) return null
            const diff = (parseFloat(w2) - parseFloat(w1)).toFixed(1)
            return (
              <p className="text-center text-sm mt-2 text-accent">
                Weight change: {diff > 0 ? '+' : ''}{diff} kg
              </p>
            )
          })()}
        </div>
      )}

      {/* Gallery */}
      {view === 'gallery' && (Object.keys(grouped).length === 0 ? (
        <div className="card text-center py-8">
          <Camera size={40} className="text-muted mx-auto mb-2"/>
          <p className="text-sm text-muted">No photos yet. Upload your first progress photo above.</p>
        </div>
      ) : (
        Object.keys(grouped).sort((a, b) => b.localeCompare(a)).map(d => (
          <div key={d} className="card">
            <div className="card-title">{d} {getWeight(d) ? <span className="text-accent font-normal text-sm">· {getWeight(d)} kg</span> : ''}</div>
            <div className="grid grid-cols-3 gap-2">
              {grouped[d].map(p => {
                const isSel = selected.includes(p.id)
                return (
                  <div key={p.id} className="relative group cursor-pointer"
                    onClick={() => toggleSelect(p)}>
                    <img src={p.url} alt={p.label}
                      className={`w-full aspect-[3/4] object-cover rounded-xl transition-all ${compareMode ? (isSel ? 'ring-2 ring-accent' : 'opacity-60') : ''}`}/>
                    <div className="absolute bottom-0 left-0 right-0 bg-bg/70 rounded-b-xl px-2 py-1 text-xs capitalize text-muted">
                      {p.label}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(p) }}
                      className="absolute top-1 right-1 btn-ghost p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-bg/80 rounded-lg">
                      <Trash2 size={13}/>
                    </button>
                    {isSel && compareMode && (
                      <div className="absolute top-1 left-1 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-bg text-xs font-bold">
                        {selected.indexOf(p.id) + 1}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      ))}
    </div>
  )
}
