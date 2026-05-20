import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../auth.jsx'
import { getAll, getSettings, addEntry, setEntry, deleteEntry, subscribe } from '../data.js'
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
  const [dataContext, setDataContext] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!uid) return
    getSettings(uid).then(setSettings)
    // Load persisted chat history
    getAll(uid, 'coachHistory', { orderByField: 'createdAt', dir: 'asc' }).then(docs => {
      if (docs.length > 0) {
        setMessages(docs.slice(-20).map(d => ({ role: d.role, text: d.text, isError: d.isError || false })))
      }
    })
  }, [uid])

  useEffect(() => {
    if (!uid) return
    Promise.all([
      getSettings(uid),
      getAll(uid, 'weights', { orderByField: 'date', dir: 'desc' }),
      getAll(uid, 'nutritionLog'),
      getAll(uid, 'lifts'),
    ]).then(([s, wts, nutr, lifts]) => {
      const latestWeight = wts[0]?.weight
      const profile = s.profile || {}
      const targets = s.nutritionTargets || {}
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
      const weekAgoStr = weekAgo.toISOString().slice(0, 10)
      const recentLifts = lifts.filter(l => l.date >= weekAgoStr)
      const recentNutr = nutr.filter(n => n.date >= weekAgoStr)
      const avgKcal = recentNutr.length > 0
        ? Math.round(Object.values(recentNutr.reduce((acc, n) => {
            acc[n.date] = (acc[n.date] || 0) + (parseFloat(n.kcal) || 0); return acc
          }, {})).reduce((a, b) => a + b, 0) / Object.keys(recentNutr.reduce((acc, n) => { acc[n.date] = 1; return acc }, {})).length) : null

      const ctx = [
        latestWeight ? `Current weight: ${latestWeight} kg` : '',
        profile.age ? `Age: ${profile.age}` : '',
        s.goal?.type ? `Goal: ${s.goal.type} weight at ${s.goal.rateKgPerWeek || 0.5} kg/week` : '',
        targets.kcal ? `Daily kcal target: ${targets.kcal} kcal, protein: ${targets.protein}g` : '',
        avgKcal ? `Average daily kcal this week: ${avgKcal}` : '',
        recentLifts.length > 0 ? `Training sessions this week: ${new Set(recentLifts.map(l => l.date)).size}` : '',
        s.activeProgram?.id ? `Active program: ${s.activeProgram.id}` : '',
      ].filter(Boolean).join('. ')

      setDataContext(ctx)
    })
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

    const fullPreamble = SYSTEM_PREAMBLE + (dataContext ? `\n\nUser's current data: ${dataContext}` : '')
    const body = {
      system_instruction: { parts: [{ text: fullPreamble }] },
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
      setMessages(prev => {
        const next = [...prev, { role: 'model', text: reply }]
        // Persist last 20 messages — fire and forget
        ;(async () => {
          try {
            const existing = await getAll(uid, 'coachHistory', { orderByField: 'createdAt', dir: 'asc' })
            // Keep only last 18 + new pair = 20 total
            const toDelete = existing.slice(0, Math.max(0, existing.length - 18))
            for (const d of toDelete) await deleteEntry(uid, 'coachHistory', d.id)
            await addEntry(uid, 'coachHistory', { role: 'user', text: userMsg })
            await addEntry(uid, 'coachHistory', { role: 'model', text: reply })
          } catch (e) { /* non-blocking */ }
        })()
        return next
      })
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
          <div className="pt-6 pb-2">
            <div className="text-center mb-4">
              <Sparkles size={32} className="text-accent/40 mx-auto mb-3"/>
              <p className="text-sm text-muted">Evidence-based fitness and nutrition coaching, personalised to your data.</p>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted text-center mb-2">Try asking:</p>
              {[
                "Based on my current stats, what should my protein target be?",
                "How should I structure my training this week based on my recovery?",
                "I'm stuck on my bench press — what are some proven plateau-busting techniques?",
                "What's a good meal I can log for high protein and low calories?",
                "How do I interpret my HbA1c result and what affects it?",
              ].map((prompt, i) => (
                <button key={i} onClick={() => { setInput(prompt) }}
                  className="w-full text-left text-xs bg-surfaceAlt hover:bg-accent/10 border border-border/30 hover:border-accent/30 rounded-xl px-3 py-2.5 text-muted hover:text-text transition-colors">
                  {prompt}
                </button>
              ))}
            </div>
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
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-muted">History auto-saved. Last 20 messages persisted.</p>
        {messages.length > 0 && (
          <button onClick={async () => {
            const existing = await getAll(uid, 'coachHistory', { orderByField: 'createdAt' })
            for (const d of existing) await deleteEntry(uid, 'coachHistory', d.id)
            setMessages([])
          }} className="text-xs text-muted hover:text-danger transition-colors">Clear history</button>
        )}
      </div>
    </div>
  )
}
