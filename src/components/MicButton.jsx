/**
 * MicButton — Web Speech API voice dictation button.
 * Hidden on unsupported browsers.
 * Props:
 *   onTranscript(text: string) — called with recognized text
 *   className — optional extra classes
 */
import { useState } from 'react'
import { Mic, MicOff } from 'lucide-react'

const SR = typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function MicButton({ onTranscript, className = '' }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')

  if (!SR) return null // hide on unsupported browsers

  const start = () => {
    setError('')
    const rec = new SR()
    rec.lang = 'en-GB'
    rec.continuous = false
    rec.interimResults = false

    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = (e) => {
      setListening(false)
      setError(e.error === 'not-allowed' ? 'Mic permission denied' : e.error)
    }
    rec.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript || ''
      if (transcript) onTranscript(transcript)
    }

    try { rec.start() } catch (e) { setListening(false) }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={start}
        disabled={listening}
        title={listening ? 'Listening…' : 'Dictate'}
        className={`btn-ghost p-2 relative ${className} ${listening ? 'text-accent' : 'text-muted'}`}
      >
        {listening ? (
          <>
            <Mic size={16} className="animate-pulse"/>
          </>
        ) : (
          <Mic size={16}/>
        )}
      </button>
      {error && <span className="text-xs text-danger mt-0.5">{error}</span>}
    </div>
  )
}
