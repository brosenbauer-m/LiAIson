'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ChatAccessScope } from '@/types'

interface ConnectionRow {
  id: string
  allowed_scope: ChatAccessScope
  compatibility_summary: string | null
  to_user: {
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
  const supabase = createClient()

  const handleChange = async (id: string, scope: ChatAccessScope) => {
    setSavingId(id)
    setConnections(prev => prev.map(c => c.id === id ? { ...c, allowed_scope: scope } : c))
    await supabase
      .from('connection_interests')
      .update({ allowed_scope: scope })
      .eq('id', id)
    setSavingId(null)
  }

  if (connections.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center shadow-soft">
        <div className="text-5xl mb-4">🤝</div>
        <p className="text-text-secondary text-base">No matched connections yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {connections.map(c => {
        const toUser = Array.isArray(c.to_user) ? c.to_user[0] : c.to_user
        return (
        <div key={c.id} className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg shadow-soft overflow-hidden">
              {toUser?.avatar_url ? (
                <img src={toUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                toUser?.display_name?.[0]?.toUpperCase() ?? '?'
              )}
            </div>
            <div>
              <p className="font-semibold text-text-primary">{toUser?.display_name ?? 'Unknown'}</p>
              <p className="text-xs text-text-secondary">@{toUser?.username ?? ''}</p>
            </div>
          </div>
          {c.compatibility_summary && (
            <p className="text-sm text-text-secondary italic">{c.compatibility_summary}</p>
          )}
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