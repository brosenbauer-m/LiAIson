'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { staggerContainer, fadeInUp } from '@/lib/animations'
import ChatBubble from '@/components/chat/ChatBubble'
import SuggestedPromptChip from '@/components/ui/SuggestedPromptChip'
import type { ChatMessage } from '@/types'

interface Props {
  username: string
  displayName: string
}

// Generate a simple visitor ID for session tracking
function getVisitorId(): string {
  let id = sessionStorage.getItem('maimoir_visitor_id')
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    sessionStorage.setItem('maimoir_visitor_id', id)
  }
  return id
}

export default function ProfileChatSection({ username, displayName }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [rateLimited, setRateLimited] = useState(false)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [connectStatus, setConnectStatus] = useState<'idle' | 'pending' | 'matched' | 'loading'>('idle')
  const [connectMessage, setConnectMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Fetch suggested prompts
    fetch(`/api/prompts/${username}`)
      .then(r => r.json())
      .then(d => setSuggestedPrompts(d.prompts ?? []))
      .catch(() => {})

    // Check auth status
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user)
    })
  }, [username])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || rateLimited) return

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

      if (res.status === 429) {
        const data = await res.json()
        setRateLimited(true)
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.error ?? `You've reached the daily limit. Sign up to connect with ${displayName} directly.` },
        ])
        setLoading(false)
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
        setStreamingContent(accumulated)
      }

      setMessages(prev => [...prev, { role: 'assistant', content: accumulated }])
      setStreamingContent('')
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "I'm having trouble responding right now. Please try again." },
      ])
    } finally {
      setLoading(false)
    }
  }, [messages, loading, rateLimited, username, displayName])

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

      // Get target user ID
      const { data: targetUser } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single()

      if (!targetUser) { setConnectStatus('idle'); return }

      const res = await fetch('/api/connections/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: targetUser.id }),
      })

      const data = await res.json()

      if (data.matched) {
        setConnectStatus('matched')
        setConnectMessage("You're connected! You'll hear from each other soon.")
      } else {
        setConnectStatus('pending')
        setConnectMessage("Your interest has been noted — we'll let you know if it's mutual.")
      }
    } catch {
      setConnectStatus('idle')
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
        <button
          onClick={handleConnect}
          disabled={connectStatus === 'loading' || connectStatus === 'pending' || connectStatus === 'matched'}
          className={`px-5 py-2 text-sm rounded-lg font-medium transition-all shadow-soft ${
            connectStatus === 'matched'
              ? 'bg-success/10 text-success border border-success/20'
              : connectStatus === 'pending'
              ? 'bg-accent-subtle text-accent border border-accent/30'
              : 'bg-accent hover:bg-accent-light text-white'
          }`}
        >
          {connectStatus === 'matched' ? '✓ Connected' : connectStatus === 'pending' ? '⏳ Interest noted' : connectStatus === 'loading' ? '...' : 'Connect'}
        </button>
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
          <ChatBubble key={i} role={msg.role} content={msg.content} />
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
      {messages.length === 0 && suggestedPrompts.length > 0 && (
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
        {rateLimited ? (
          <div className="text-center py-3">
            <p className="text-sm text-text-secondary mb-2">
              You&apos;ve had a great conversation!{' '}
              <a
                href="/signup"
                className="text-accent hover:underline font-medium"
              >
                Sign up to connect with {displayName} directly.
              </a>
            </p>
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
      </div>
    </div>
  )
}
