'use client'

import { useState } from 'react'
import type { ChatAccessScope } from '@/types'

interface ConnectionUser {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface ConnectionRow {
  id: string
  allowed_scope: ChatAccessScope
  created_at: string
  from_user: ConnectionUser | ConnectionUser[] | null
}

type ConnectionFilter = 'all' | ChatAccessScope
type SortOrder = 'newest' | 'oldest' | 'name'

const SCOPE_OPTIONS: { value: ChatAccessScope; label: string }[] = [
  { value: 'none', label: 'Default' },
  { value: 'professional', label: 'Professional' },
  { value: 'personal', label: 'Personal' },
  { value: 'both', label: 'Both' },
]

const FILTER_OPTIONS: { value: ConnectionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'both', label: 'Both' },
  { value: 'professional', label: 'Professional' },
  { value: 'personal', label: 'Personal' },
  { value: 'none', label: 'Default' },
]

const PUBLIC_SCOPE_LABELS: Record<ChatAccessScope, string> = {
  none: 'Private',
  professional: 'Public (Professional only)',
  personal: 'Public (Personal only)',
  both: 'Public (Both)',
}

interface Props {
  initialConnections: ConnectionRow[]
  publicScope: ChatAccessScope
}

export default function ConnectionsList({ initialConnections, publicScope }: Props) {
  const [connections, setConnections] = useState(initialConnections)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [filter, setFilter] = useState<ConnectionFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

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

  const handleSelectShown = (checked: boolean, shownIds: string[]) => {
    setSelectedIds(previous => {
      const next = new Set(previous)
      shownIds.forEach(id => checked ? next.add(id) : next.delete(id))
      return next
    })
  }

  const handleBulkChange = async (scope: ChatAccessScope) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBulkSaving(true)
    setFeedback(null)
    try {
      for (let index = 0; index < ids.length; index += 200) {
        const response = await fetch('/api/connections/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionIds: ids.slice(index, index + 200), scope }),
        })
        if (!response.ok) throw new Error('Failed to update access')
      }

      setConnections(previous => previous.map(connection => (
        selectedIds.has(connection.id) ? { ...connection, allowed_scope: scope } : connection
      )))
      setSelectedIds(new Set())
      const message = `Updated ${ids.length} connections`
      setFeedback({ type: 'success', message })
      window.setTimeout(() => {
        setFeedback(current => current?.message === message ? null : current)
      }, 3000)
    } catch {
      setFeedback({ type: 'error', message: 'Something went wrong. Please try again.' })
    } finally {
      setBulkSaving(false)
    }
  }

  const countFor = (scope: ChatAccessScope) => connections.filter(connection => connection.allowed_scope === scope).length
  const filteredConnections = connections.filter(connection => filter === 'all' || connection.allowed_scope === filter)
  const shownConnections = [...filteredConnections].sort((a, b) => {
    if (sortOrder === 'name') {
      const aUser = Array.isArray(a.from_user) ? a.from_user[0] : a.from_user
      const bUser = Array.isArray(b.from_user) ? b.from_user[0] : b.from_user
      return (aUser?.display_name ?? '').localeCompare(bUser?.display_name ?? '')
    }
    const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return sortOrder === 'newest' ? -difference : difference
  })
  const shownIds = shownConnections.map(connection => connection.id)
  const allShownSelected = shownIds.length > 0 && shownIds.every(id => selectedIds.has(id))

  return (
    <div className={`space-y-4 ${selectedIds.size > 0 ? 'pb-32' : ''}`}>
      <p className="text-sm text-text-secondary" title={`Default follows your Chat Access setting: ${PUBLIC_SCOPE_LABELS[publicScope]}.`}>
        Default means they get the same as everyone else based on your account setting (Public or Private). Connections always get at least that.
      </p>

      {connections.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-soft">
          <div className="text-5xl mb-4">🤝</div>
          <p className="text-text-secondary text-base">No connections yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter connections by access">
                {FILTER_OPTIONS.map(option => {
                  const count = option.value === 'all' ? connections.length : countFor(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={filter === option.value}
                      onClick={() => setFilter(option.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        filter === option.value
                          ? 'border-accent bg-accent-tint text-accent'
                          : 'border-border text-text-secondary hover:border-accent/50'
                      }`}
                    >
                      {option.label} ({count})
                    </button>
                  )
                })}
              </div>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <span>Sort by</span>
                <select
                  value={sortOrder}
                  onChange={event => setSortOrder(event.target.value as SortOrder)}
                  className="bg-card border border-border rounded-lg px-3 py-2 text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="name">Name A–Z</option>
                </select>
              </label>
            </div>

            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={allShownSelected}
                disabled={bulkSaving || shownIds.length === 0}
                onChange={event => handleSelectShown(event.target.checked, shownIds)}
                className="h-4 w-4 accent-accent"
              />
              Select all shown
            </label>
          </div>

          {feedback && (
            <p className={feedback.type === 'error' ? 'text-sm text-error' : 'text-sm text-success'} role={feedback.type === 'error' ? 'alert' : 'status'}>
              {feedback.message}
            </p>
          )}

          {shownConnections.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center shadow-soft">
              <p className="text-text-secondary text-base">No connections with this access level.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shownConnections.map(connection => {
                const fromUser = Array.isArray(connection.from_user) ? connection.from_user[0] : connection.from_user
                return (
                  <div key={connection.id} className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(connection.id)}
                        disabled={bulkSaving}
                        onChange={event => handleSelectShown(event.target.checked, [connection.id])}
                        aria-label={`Select ${fromUser?.display_name ?? 'connection'}`}
                        className="h-4 w-4 accent-accent flex-shrink-0"
                      />
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
                      {SCOPE_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => handleChange(connection.id, option.value)}
                          disabled={savingId === connection.id || bulkSaving}
                          title={option.value === 'none' ? `Default follows your Chat Access setting: ${PUBLIC_SCOPE_LABELS[publicScope]}.` : undefined}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:opacity-50 ${
                            connection.allowed_scope === option.value
                              ? 'border-accent bg-accent-tint text-accent'
                              : 'border-border text-text-secondary hover:border-accent/50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-text-primary">{selectedIds.size} selected — Set access to:</span>
            {SCOPE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleBulkChange(option.value)}
                disabled={bulkSaving}
                title={option.value === 'none' ? `Default follows your Chat Access setting: ${PUBLIC_SCOPE_LABELS[publicScope]}.` : undefined}
                className="px-3 py-2 rounded-lg text-sm font-medium border border-border text-text-secondary hover:border-accent/50 hover:text-accent disabled:opacity-50"
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkSaving}
              className="ml-auto text-sm text-accent hover:underline disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}