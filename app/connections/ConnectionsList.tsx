'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { CustomCircle } from '@/lib/circles'

interface ConnectionUser {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface ConnectionRow {
  id: string
  in_inner_circle: boolean
  created_at: string
  from_user: ConnectionUser | ConnectionUser[] | null
}

type ConnectionFilter = 'all' | 'inner' | 'outer'
type SortOrder = 'newest' | 'oldest' | 'name'

const CIRCLE_OPTIONS: { inner: boolean; label: string }[] = [
  { inner: false, label: 'Outer Circle' },
  { inner: true, label: 'Inner Circle' },
]

const FILTER_OPTIONS: { value: ConnectionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'inner', label: 'Inner Circle' },
  { value: 'outer', label: 'Outer Circle' },
]

interface Props {
  initialConnections: ConnectionRow[]
  // Inner Circle only on plans with two circles (Ambivert and up).
  innerAllowed: boolean
  // Own circles (Social Butterfly) and, per connected user id, the circles they are in.
  customCircles: CustomCircle[]
  initialMemberships: Record<string, string[]>
}

export default function ConnectionsList({ initialConnections, innerAllowed, customCircles, initialMemberships }: Props) {
  const [connections, setConnections] = useState(initialConnections)
  const [memberships, setMemberships] = useState(initialMemberships)
  const [circleSaving, setCircleSaving] = useState<string | null>(null)

  // Add a person to / remove them from one of the owner's own circles.
  const toggleCircle = async (userId: string, circleId: string) => {
    const was = (memberships[userId] ?? []).includes(circleId)
    const apply = (member: boolean) => setMemberships(prev => ({
      ...prev,
      [userId]: member ? [...(prev[userId] ?? []).filter(id => id !== circleId), circleId] : (prev[userId] ?? []).filter(id => id !== circleId),
    }))
    setCircleSaving(`${userId}:${circleId}`)
    apply(!was)
    try {
      const res = await fetch('/api/circles/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId, memberIds: [userId], member: !was }),
      })
      if (!res.ok) apply(was)
    } catch {
      apply(was)
    } finally {
      setCircleSaving(null)
    }
  }
  const [savingId, setSavingId] = useState<string | null>(null)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [filter, setFilter] = useState<ConnectionFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleChange = async (id: string, inner: boolean) => {
    const previous = connections.find(connection => connection.id === id)?.in_inner_circle
    if (previous === undefined) return

    setSavingId(id)
    setConnections(prev => prev.map(c => c.id === id ? { ...c, in_inner_circle: inner } : c))
    try {
      const response = await fetch('/api/connections/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionIds: [id], inner }),
      })
      if (!response.ok) {
        setConnections(prev => prev.map(c => c.id === id ? { ...c, in_inner_circle: previous } : c))
      }
    } catch {
      setConnections(prev => prev.map(c => c.id === id ? { ...c, in_inner_circle: previous } : c))
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

  const handleBulkChange = async (inner: boolean) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    setBulkSaving(true)
    setFeedback(null)
    try {
      for (let index = 0; index < ids.length; index += 200) {
        const response = await fetch('/api/connections/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionIds: ids.slice(index, index + 200), inner }),
        })
        if (!response.ok) throw new Error('Failed to update access')
      }

      setConnections(previous => previous.map(connection => (
        selectedIds.has(connection.id) ? { ...connection, in_inner_circle: inner } : connection
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

  const matches = (connection: ConnectionRow, f: ConnectionFilter) =>
    f === 'all' || (f === 'inner') === connection.in_inner_circle
  const countFor = (f: ConnectionFilter) => connections.filter(connection => matches(connection, f)).length
  const filteredConnections = connections.filter(connection => matches(connection, filter))
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
      <p className="text-sm text-text-secondary">
        {innerAllowed
          ? 'Everyone you connect with sees your Outer Circle. People in your Inner Circle also see your Inner Circle.'
          : 'Everyone you connect with sees your Vault (except drafts).'}
        {!innerAllowed && (
          <> With Ambivert or Extrovert you can also put people in an Inner Circle. <Link href="/plans#circles" className="text-accent hover:underline">Learn more</Link></>
        )}
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
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter connections by circle">
                {(innerAllowed ? FILTER_OPTIONS : FILTER_OPTIONS.slice(0, 1)).map(option => {
                  const count = countFor(option.value)
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
              <p className="text-text-secondary text-base">No connections in this circle.</p>
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
                    {fromUser && customCircles.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-text-secondary">Also in:</span>
                        {customCircles.map(circle => {
                          const member = (memberships[fromUser.id] ?? []).includes(circle.id)
                          return (
                            <button
                              key={circle.id}
                              type="button"
                              onClick={() => toggleCircle(fromUser.id, circle.id)}
                              disabled={circleSaving === `${fromUser.id}:${circle.id}` || bulkSaving}
                              aria-pressed={member}
                              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-50 ${
                                member ? 'border-accent bg-accent text-white' : 'border-border text-text-secondary hover:border-accent/50'
                              }`}
                            >
                              {member ? '✓ ' : ''}{circle.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {innerAllowed && <div className="flex flex-wrap gap-2">
                      {CIRCLE_OPTIONS.map(option => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => handleChange(connection.id, option.inner)}
                          disabled={savingId === connection.id || bulkSaving}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all disabled:opacity-50 ${
                            connection.in_inner_circle === option.inner
                              ? 'border-accent bg-accent-tint text-accent'
                              : 'border-border text-text-secondary hover:border-accent/50'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {innerAllowed && selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-4xl -translate-x-1/2 rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-text-primary">{selectedIds.size} selected — Move to:</span>
            {CIRCLE_OPTIONS.map(option => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleBulkChange(option.inner)}
                disabled={bulkSaving}
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