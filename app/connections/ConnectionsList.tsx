'use client'

import { useState } from 'react'
import type { ChatAccessScope } from '@/types'

interface ConnectionRow {
  id: string
  allowed_scope: ChatAccessScope
  from_user: {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  } | {
    id: string
    username: string
    display_name: string
    avatar_url: string | null
  }[] | null
}

const SCOPE_OPTIONS: { value: ChatAccessScope; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'professional', label: 'Professional' },
  { value: 'personal', label: 'Personal' },
  { value: 'both', label: 'Both' },
]

interface Props {
  initialConnections: ConnectionRow[]
}

export default function ConnectionsList({ initialConnections }: Props) {
  const [connections, setConnections] = useState(initialConnections)
  const [savingId, setSavingId] = useState<string | null>(null)

  const handleChange = async (id: string, scope: ChatAccessScope) => {
    const previousScope = connections.find(connection => connection.id === id)?.allowed_scope
    if (previousScope === undefined) return

    setSavingId(id)
    setConnections(prev => prev.map(c => c.id === id ? { ...c, allowed_scope: scope } : c))
    try {
      const response = await fetch('/api/connections/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionIds: [id], scope }),
      })
      if (!response.ok) {
        setConnections(prev => prev.map(c => c.id === id ? { ...c, allowed_scope: previousScope } : c))
      }
    } catch {
      setConnections(prev => prev.map(c => c.id === id ? { ...c, allowed_scope: previousScope } : c))
    } finally {
      setSavingId(null)
    }
  }

  if (connections.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center shadow-soft">
        <div className="text-5xl mb-4">🤝</div>
        <p className="text-text-secondary text-base">No connections yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {connections.map(c => {
        const fromUser = Array.isArray(c.from_user) ? c.from_user[0] : c.from_user
        return (
        <div key={c.id} className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg shadow-soft overflow-hidden">
              {fromUser?.avatar_url ? (
                <img src={fromUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                fromUser?.display_name?.[0]?.toUpperCase() ?? '?'
              )}
            </div>
            <div>
              <p className="font-semibold text-text-primary">{fromUser?.display_name ?? 'Unknown'}</p>
              <p className="text-xs text-text-secondary">@{fromUser?.username ?? ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCOPE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleChange(c.id, opt.value)}
                disabled={savingId === c.id}
                className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                  c.allowed_scope === opt.value
                    ? 'border-accent bg-accent-tint text-accent'
                    : 'border-border text-text-secondary hover:border-accent/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        )
      })}
    </div>
  )
}