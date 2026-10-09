'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import ChatBubble from '@/components/chat/ChatBubble'
import SuggestedPromptChip from '@/components/ui/SuggestedPromptChip'
import { readChatSignals } from '@/lib/chat/signals'
import type { ChatMessage } from '@/types'

interface Props {
  ownerId: string
  username: string
  displayName: string
  // Shown now and then under a reply that points out something in common:
  // 'map' links to the Similarity card (Extrovert), 'upgrade' to Plans.
  similarityNote: 'map' | 'upgrade' | null
}

type TrialStatus = {
  plan: 'exempt' | 'trial' | 'paying' | 'trial_ended'
  trialEndsAt: string | null
  dailyLimit: number
  messagesLeftToday: number | null
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })
}

// The Similarity note shows at most once per chat per day (Vienna day).
function viennaDay(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Vienna' })
}

function takeSimilarityNote(username: string): boolean {
  try {
    const key = `liaison_similarity_note:${username}`
    const today = viennaDay()
    if (localStorage.getItem(key) === today) return false
    localStorage.setItem(key, today)
    return true
  } catch {
    return false
  }
}

// Generate a simple visitor ID for session tracking
function getVisitorId(): string {
  let id = sessionStorage.getItem('liaison_visitor_id')
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('liaison_visitor_id', id)
  }
  return id
}

export default function ProfileChatSection({ ownerId, username, displayName, similarityNote }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [rateLimited, setRateLimited] = useState(false)
  const [limitMessage, setLimitMessage] = useState('')
  const [paused, setPaused] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [connectStatus, setConnectStatus] = useState<'none' | 'requested' | 'connected' | 'self' | 'signed_out' | 'loading'>('loading')
  const [connectMessage, setConnectMessage] = useState('')
  const [trial, setTrial] = useState<TrialStatus | null>(null)
  // Index of the reply the Similarity note is shown under.
  const [noteAt, setNoteAt] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Chat needs an account: the person who sends a message pays for it.
  const signedOut = authChecked && !isLoggedIn

  // Free-month status of the signed-in sender (shown under the chat).
  const loadTrial = useCallback(() => {
    fetch('/api/billing/trial-status', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: TrialStatus | null) => {
        if (!d) return
        setTrial(d)
        if (d.plan === 'trial_ended') {
          const ended = d.trialEndsAt ? ` on ${formatDay(d.trialEndsAt)}` : ''
          setLimitMessage(`Your free month ended${ended}. Add a payment method in Settings to keep chatting.`)
          setPaused(true)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    // Fetch suggested prompts
    fetch(`/api/prompts/${username}`)
      .then(r => r.json())
      .then(d => setSuggestedPrompts(d.prompts ?? []))
      .catch(() => {})

    fetch(`/api/connections/status?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => setConnectStatus(d.status ?? 'none'))
      .catch(() => setConnectStatus('none'))

    // Check auth status
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
      setAuthChecked(true)
      if (user) loadTrial()
    })
  }, [username, loadTrial])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || rateLimited || paused || !isLoggedIn) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setStreamingContent('')

    try {
      const visitorId = getVisitorId()
      const res = await fetch(`/api/chat/${username}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, visitorId }),
      })

      if (res.status === 401) {
        setIsLoggedIn(false)
        setMessages(prev => prev.slice(0, -1))
        setLoading(false)
        return
      }

      if (res.status === 429) {
        const data = await res.json()
        const text = data.error ?? "You've reached today's message limit. Please try again tomorrow."
        setLimitMessage(text)
        if (data.paused) setPaused(true)
        else setRateLimited(true)
        setMessages(prev => [...prev, { role: 'assistant', content: text }])
        setLoading(false)
        loadTrial()
        return
      }

      if (!res.ok || !res.body) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: "I'm having trouble responding right now. Please try again." },
        ])
        setLoading(false)
        return
      }

      // Stream response
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamingContent(readChatSignals(accumulated).text)
      }

      const reply = readChatSignals(accumulated)
      setMessages(prev => [...prev, { role: 'assistant', content: reply.text }])
      if (reply.common && similarityNote && takeSimilarityNote(username)) setNoteAt(newMessages.length)
      setStreamingContent('')
      loadTrial()
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "I'm having trouble responding right now. Please try again." },
      ])
    } finally {
      setLoading(false)
    }
  }, [messages, loading, rateLimited, paused, isLoggedIn, username, loadTrial, similarityNote])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleConnect = async () => {
    if (!isLoggedIn) {
      router.push(`/signup?redirect=/${username}`)
      return
    }

    setConnectStatus('loading')
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: ownerId }),
      })

      if (!res.ok) {
        setConnectStatus('none')
        return
      }

      const data = await res.json()
      if (data.status === 'requested') {
        setConnectStatus('requested')
        setConnectMessage('Request sent.')
      } else if (data.status === 'connected') {
        setConnectStatus('connected')
        setConnectMessage("You're connected.")
      } else {
        setConnectStatus('none')
      }
    } catch {
      setConnectStatus('none')
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col shadow-card" style={{ minHeight: '600px' }}>
      {/* Chat header */}
      <div className="border-b border-border px-6 py-5 bg-surface/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg shadow-soft">
            {displayName[0]?.toUpperCase() ?? 'M'}
          </div>
          <div>
            <p className="font-semibold text-text-primary">{displayName}&apos;s LiAIson</p>
            <p className="text-xs text-text-secondary">Ask me anything about {displayName}</p>
          </div>
        </div>
        {connectStatus !== 'self' && <button
          onClick={handleConnect}
          disabled={connectStatus === 'loading' || connectStatus === 'requested' || connectStatus === 'connected'}
          className={`px-5 py-2 text-sm rounded-lg font-medium transition-all shadow-soft ${
            connectStatus === 'connected'
              ? 'bg-success/10 text-success border border-success/20'
              : connectStatus === 'requested'
              ? 'bg-accent-subtle text-accent border border-accent/30'
              : 'bg-accent hover:bg-accent-light text-white'
          }`}
        >
          {connectStatus === 'connected' ? '✓ Connected' : connectStatus === 'requested' ? 'Requested' : connectStatus === 'loading' ? '...' : 'Connect'}
        </button>}
      </div>

      {connectMessage && (
        <div className="px-6 py-4 bg-accent-tint text-accent text-sm border-b border-accent/10">
          {connectMessage}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ maxHeight: '400px' }}>
        {messages.length === 0 && !loading && (
          <div className="text-center py-12 text-text-secondary">
            <p className="text-sm">Start a conversation to learn about {displayName}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <ChatBubble role={msg.role} content={msg.content} />
            {i === noteAt && similarityNote && (
              <p className="-mt-1 mb-3 pl-9 text-xs text-text-secondary">
                {similarityNote === 'map' ? (
                  <a href="#similarity" className="hover:text-text-primary hover:underline">✨ See everything you have in common →</a>
                ) : (
                  <Link href="/plans#similarity" className="hover:text-text-primary hover:underline">✨ With Extrovert, see a map of everything you have in common →</Link>
                )}
              </p>
            )}
          </div>
        ))}
        {streamingContent && (
          <ChatBubble role="assistant" content={streamingContent} isStreaming />
        )}
        {loading && !streamingContent && (
          <div className="flex items-center gap-2 text-text-secondary text-sm pl-12">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts */}
      {messages.length === 0 && isLoggedIn && suggestedPrompts.length > 0 && (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="px-6 pb-4 flex flex-wrap gap-2"
        >
          {suggestedPrompts.map((prompt, i) => (
            <motion.div key={i} variants={fadeInUp}>
              <SuggestedPromptChip
                prompt={prompt}
                onClick={sendMessage}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Input */}
      <div className="border-t border-border p-5 bg-surface/30">
        {paused ? (
          <div className="text-center py-3">
            <p className="text-sm text-text-secondary">
              {limitMessage}{' '}
              <Link href="/settings" className="text-accent hover:underline font-medium">
                Go to Settings
              </Link>
            </p>
          </div>
        ) : signedOut ? (
          <div className="text-center py-2 space-y-3">
            <p className="text-sm text-text-secondary">
              Sign up or log in to chat with {displayName}&apos;s LiAIson.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft"
              >
                Sign up
              </Link>
              <Link
                href={`/login?redirect=/${encodeURIComponent(username)}`}
                className="px-5 py-2.5 border-2 border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg transition-all"
              >
                Log in
              </Link>
            </div>
          </div>
        ) : rateLimited ? (
          <div className="text-center py-3">
            <p className="text-sm text-text-secondary">{limitMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder={`Ask about ${displayName}...`}
              rows={1}
              maxLength={2000}
              disabled={loading}
              className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none disabled:opacity-60 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-accent hover:bg-accent-light text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-all shadow-soft hover:shadow-card"
            >
              Send
            </button>
          </form>
        )}
        {isLoggedIn && trial?.plan === 'trial' && (
          <p className="mt-3 text-center text-xs text-text-secondary">
            Free month{trial.messagesLeftToday !== null ? `: ${trial.messagesLeftToday} of ${trial.dailyLimit} free messages left today` : ` (${trial.dailyLimit} free messages per day)`}
            {trial.trialEndsAt ? ` · ends on ${formatDay(trial.trialEndsAt)}` : ''}. After that, you&apos;ll need a{' '}
            <Link href="/settings" className="text-accent hover:underline">saved payment method</Link> to keep chatting.
          </p>
        )}
        <p className="mt-3 text-center text-xs text-text-muted">
          You&apos;re chatting with an AI. It answers only from what {displayName} has shared and can make mistakes.
        </p>
      </div>
    </div>
  )
}
