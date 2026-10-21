'use client'

import { useEffect, useRef, useState } from 'react'
import ChatBubble from '@/components/chat/ChatBubble'

// Similarities Chart → a LiAIson to talk to about everyone in the chart
// (owner request 2026-10-20; /api/compare/talk). Uses only what each person
// lets you see; every message is paid by you, like any message.

type Message = { role: 'user' | 'assistant'; content: string }

const firstName = (name: string) => name.split(' ')[0] || name

export default function GroupTalk({ usernames, includeMe, names }: { usernames: string[]; includeMe: boolean; names: string[] }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const box = boxRef.current
    if (box && messages.length) box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const firsts = names.map(firstName)
  const list = firsts.length > 1 ? `${firsts.slice(0, -1).join(', ')} and ${firsts[firsts.length - 1]}` : firsts[0]
  const suggestion = includeMe ? 'What do we all have in common?' : 'What do they all have in common?'

  const send = async (text: string) => {
    if (!text.trim() || busy) return
    const next: Message[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages(next)
    setInput('')
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/compare/talk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames, includeMe, messages: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(d.error ?? 'The LiAIson could not answer right now. Please try again.')
        setMessages(messages)
        setInput(text)
        return
      }
      setMessages([...next, { role: 'assistant', content: d.reply }])
      window.dispatchEvent(new Event('liaison:usage-changed'))
    } catch {
      setError('The LiAIson could not answer right now. Please try again.')
      setMessages(messages)
      setInput(text)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full bg-card border border-border rounded-2xl shadow-card overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-surface/30 text-center">
        <p className="font-semibold text-text-primary">Ask a LiAIson About {list}</p>
      </div>
      <div ref={boxRef} className="max-h-[640px] min-h-[320px] overflow-y-auto p-4 sm:p-6 space-y-3">
        {messages.map((m, i) => <ChatBubble key={i} role={m.role} content={m.content} />)}
        {busy && <p className="pl-12 text-sm text-text-secondary animate-pulse">Thinking...</p>}
        {messages.length === 0 && !busy && (
          <div className="flex justify-center pt-6">
            <button
              type="button"
              onClick={() => void send(suggestion)}
              className="px-4 py-2 rounded-full border border-accent/30 bg-accent-tint text-sm text-accent hover:bg-accent-subtle"
            >
              {suggestion}
            </button>
          </div>
        )}
      </div>
      {error && <p className="px-6 pb-2 text-sm text-error" role="alert">{error}</p>}
      <form
        onSubmit={e => { e.preventDefault(); void send(input) }}
        className="border-t border-border p-4 sm:p-5 bg-surface/30 flex gap-3"
      >
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(input)
            }
          }}
          placeholder={`Ask about ${list}...`}
          rows={1}
          maxLength={2000}
          disabled={busy}
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-6 py-3 bg-accent hover:bg-accent-light text-white rounded-lg text-sm font-medium disabled:opacity-50 shadow-soft"
        >
          Send<span aria-hidden="true">*</span>
        </button>
      </form>
    </div>
  )
}
