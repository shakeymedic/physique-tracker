import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../auth.jsx'
import { getSettings } from '../data.js'
import { Sparkles, Send, ExternalLink } from 'lucide-react'

const SYSTEM_PREAMBLE = "You are an evidence-based fitness and nutrition coach. The user is tracking weight, training, macros and routine bloods. Provide practical, conservative advice. Decline anything outside legitimate, prescribed medical or routine fitness/nutrition guidance — and never advise on anabolic or performance-enhancing drugs."

export default function Coach() {
  const { user } = useAuth()
  const uid = user?.uid
  const [settings, setSettings] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!uid) return
    getSettings(uid).then(setSettings)
  }, [uid])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const apiKey = settings?.geminiApiKey

  const send = async () => {
    if (!input.trim() || !apiKey || loading) return
    const userMsg = input.trim()
    setInput('')
    setError('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    // Build Gemini contents array
    const history = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }))

    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PREAMBLE }] },
      contents: [
        ...history,
        { role: 'user', parts: [{ text: userMsg }] },
      ],
    }

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || `API error ${res.status}`)
      }
      const data = await res.json()
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(no response)'
      setMessages(prev => [...prev, { role: 'model', text: reply }])
    } catch (e) {
      setError(e.message)
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${e.message}`, isError: true }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  if (settings === null) {
    return <div className="text-sm text-muted">Loading…</div>
  }

  if (!apiKey) {
    return (
      <div className="card max-w-lg">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={20} className="text-accent"/>
          <div className="card-title mb-0">AI Fitness Coach</div>
        </div>
        <p className="text-sm text-muted mb-3">
          Connect your Gemini API key to chat with an evidence-based fitness and nutrition coach.
          The coach can help with training advice, nutrition guidance, and interpreting your progress
          — within conservative, science-backed bounds.
        </p>
        <p className="text-sm text-muted mb-4">
          Your messages are sent directly from your browser to Google's Gemini API and are never stored.
        </p>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-flex gap-2"
        >
          <ExternalLink size={14}/> Get a Gemini API Key
        </a>
        <p className="text-xs text-muted mt-3">
          After getting your key, add it in <span className="text-accent">Settings → Gemini API Key</span>.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-accent"/>
        <span className="text-base font-semibold text-text">AI Fitness Coach</span>
        <span className="chip-ok text-xs ml-auto">Gemini 2.5 Flash</span>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-3">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <Sparkles size={32} className="text-accent/40 mx-auto mb-3"/>
            <p className="text-sm text-muted">Ask me anything about training, nutrition, recovery or understanding your health data.</p>
            <p className="text-xs text-muted mt-1">I'll give evidence-based, conservative guidance within fitness and nutrition.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              m.role === 'user'
                ? 'bg-accent/15 text-text rounded-br-sm'
                : m.isError
                  ? 'bg-danger/10 text-danger rounded-bl-sm'
                  : 'bg-surface text-text rounded-bl-sm'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-muted">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>•</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>•</span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <textarea
          className="input flex-1 resize-none"
          rows={2}
          placeholder="Ask about training, nutrition, recovery…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button onClick={send} className="btn-primary px-3" disabled={loading || !input.trim()}>
          <Send size={16}/>
        </button>
      </div>
      <p className="text-xs text-muted mt-1">Chat history is not saved. Refresh to start a new session.</p>
    </div>
  )
}
