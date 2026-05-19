/**
 * RoutineTimer — full-screen modal that guides user through a mobility routine.
 * Shows current stretch name, countdown, progress bar, next-up.
 * Skip / Pause / Back controls.
 * On completion → calls onComplete(logData).
 */
import { useState, useEffect, useRef } from 'react'
import { X, Play, Pause, SkipForward, ChevronLeft, CheckCircle } from 'lucide-react'
import { STRETCHES } from '../training/stretches.js'

function getStretchInfo(name) {
  return STRETCHES.find(s => s.name === name) || null
}

export default function RoutineTimer({ routine, onComplete, onClose }) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [remaining, setRemaining] = useState(null)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const intervalRef = useRef(null)

  const items = routine?.stretches || []
  const totalItems = items.length
  const current = items[currentIdx]

  // Init remaining when stretch changes
  useEffect(() => {
    if (!current) return
    setRemaining(current.durationSec)
    setRunning(false)
  }, [currentIdx, current?.stretch])

  // Countdown
  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            // Auto-advance after 1s
            setTimeout(() => advance(), 800)
            return 0
          }
          return r - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  function advance() {
    if (currentIdx < totalItems - 1) {
      setCurrentIdx(i => i + 1)
    } else {
      setFinished(true)
      setRunning(false)
    }
  }

  function goBack() {
    if (currentIdx > 0) setCurrentIdx(i => i - 1)
  }

  function handleComplete() {
    const log = {
      routineId: routine.id || 'custom',
      routineName: routine.name,
      durationMin: routine.durationMin || Math.round(items.reduce((s, i) => s + i.durationSec, 0) / 60),
      stretches: items.map(i => ({ name: i.stretch, durationSec: i.durationSec })),
    }
    onComplete(log)
  }

  if (!routine) return null

  const pct = remaining !== null && current ? Math.max(0, (remaining / current.durationSec) * 100) : 100
  const overallPct = ((currentIdx + (remaining !== null && current ? 1 - remaining / current.durationSec : 0)) / totalItems) * 100
  const nextItem = items[currentIdx + 1]
  const mins = Math.floor((remaining ?? 0) / 60).toString().padStart(2, '0')
  const secs = ((remaining ?? 0) % 60).toString().padStart(2, '0')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Routine timer"
    >
      <div className="relative w-full max-w-sm mx-4 bg-surface rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <div className="text-xs text-muted">{routine.name}</div>
            <div className="text-sm font-semibold text-text">{currentIdx + 1} / {totalItems}</div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-full" aria-label="Close">
            <X size={18}/>
          </button>
        </div>

        {/* Overall progress bar */}
        <div className="px-4 pb-2">
          <div className="w-full bg-surfaceAlt rounded-full h-1.5">
            <div className="bg-accent h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}/>
          </div>
        </div>

        {finished ? (
          <div className="px-4 py-8 text-center">
            <CheckCircle size={48} className="text-success mx-auto mb-3"/>
            <div className="text-lg font-semibold text-text mb-1">Routine complete!</div>
            <div className="text-sm text-muted mb-4">{routine.name} — {routine.durationMin} min</div>
            <button onClick={handleComplete} className="btn-primary w-full">
              Log this session
            </button>
            <button onClick={onClose} className="btn-ghost w-full mt-2 text-sm">
              Close without logging
            </button>
          </div>
        ) : (
          <>
            {/* Stretch info */}
            <div className="px-4 py-4 text-center">
              <div className="text-2xl font-bold text-text mb-1">{current?.stretch}</div>
              {getStretchInfo(current?.stretch) && (
                <div className="text-xs text-muted mb-2">
                  {getStretchInfo(current?.stretch).muscle}
                </div>
              )}
              {/* Countdown ring */}
              <div className="relative inline-flex items-center justify-center my-3">
                <svg width={120} height={120} className="rotate-[-90deg]">
                  <circle cx={60} cy={60} r={52} fill="none" stroke="currentColor" strokeWidth={7}
                    className="text-surfaceAlt"/>
                  <circle cx={60} cy={60} r={52} fill="none" stroke="currentColor" strokeWidth={7}
                    strokeDasharray={`${2 * Math.PI * 52 * pct / 100} ${2 * Math.PI * 52}`}
                    strokeLinecap="round"
                    className="text-accent transition-all duration-1000"/>
                </svg>
                <div className="absolute text-center">
                  <div className="text-3xl font-mono font-bold text-text">{mins}:{secs}</div>
                </div>
              </div>

              {/* Stretch-level progress bar */}
              <div className="w-full bg-surfaceAlt rounded-full h-1 mb-4">
                <div className="bg-accent/50 h-1 rounded-full transition-all duration-1000"
                  style={{ width: `${100 - pct}%` }}/>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-4 pb-4 gap-2">
              <button
                onClick={goBack}
                disabled={currentIdx === 0}
                className="btn-secondary p-2 disabled:opacity-30"
                aria-label="Previous stretch"
              >
                <ChevronLeft size={20}/>
              </button>

              <button
                onClick={() => setRunning(r => !r)}
                className="btn-primary flex items-center gap-2 flex-1 justify-center text-base"
              >
                {running ? <><Pause size={18}/> Pause</> : <><Play size={18}/> {remaining === current?.durationSec ? 'Start' : 'Resume'}</>}
              </button>

              <button
                onClick={advance}
                className="btn-secondary p-2"
                aria-label="Skip stretch"
              >
                <SkipForward size={20}/>
              </button>
            </div>

            {/* Next up */}
            {nextItem && (
              <div className="px-4 pb-4 text-center">
                <span className="text-xs text-muted">Next: </span>
                <span className="text-xs text-accent">{nextItem.stretch}</span>
                <span className="text-xs text-muted"> ({nextItem.durationSec}s)</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
