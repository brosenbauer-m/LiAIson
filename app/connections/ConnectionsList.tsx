'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { circleChain, circleWhere, type CircleNode, type CustomCircle } from '@/lib/circles'
import Avatar from '@/components/ui/Avatar'

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
  const router = useRouter()
  // Circles follow the hierarchy (lib/access/resolveScope.ts): being in a
  // circle includes every circle around it, so those tags show as included
  // (greyed, not clickable). The Outer Circle is included unless someone is
  // only in circles that sit on their own outside it.
  const nodes = new Map(customCircles.map(c => [c.id, { id: c.id, parent_id: c.parent_id ?? null, in_inner: !!c.in_inner, isolated: !!c.isolated }] as [string, CircleNode]))
  const tagState = (userId: string, inInner: boolean) => {
    const chosen = new Set(memberships[userId] ?? [])
    const included = new Map<string, string>() // circle id → the chosen circle that includes it
    let innerThrough: string | null = null
    let inAny = false
    let insideOuter = false
    for (const id of chosen) {
      const chain = circleChain(id, nodes)
      if (chain.length === 0) continue
      const name = customCircles.find(c => c.id === id)?.name ?? ''
      chain.slice(1).forEach(c => { if (!included.has(c.id)) included.set(c.id, name) })
      const root = chain[chain.length - 1]
      inAny = true
      if (root.in_inner) innerThrough ??= name
      if (!root.isolated) insideOuter = true
    }
    const outer = inInner || !!innerThrough || !inAny || insideOuter
    return { chosen, included, innerThrough, outer }
  }
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
      else router.refresh()
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
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  // Remove someone: they lose access and can't send a new request.
  const removeConnection = async (id: string) => {
    setRemoving(id)
    setFeedback(null)
    try {
      const res = await fetch('/api/connections/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: id }),
      })
      if (!res.ok) throw new Error('failed')
      setConnections(prev => prev.filter(c => c.id !== id))
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next })
      setConfirmRemove(null)
    } catch {
      setFeedback({ type: 'error', message: 'Could not remove this connection. Please try again.' })
    } finally {
      setRemoving(null)
    }
  }

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
      {innerAllowed && (
        <p className="text-sm text-text-secondary">
          {customCircles.length > 0
            ? 'Being in a circle includes every circle around it, so choosing a circle also ticks the ones it sits in.'
            : 'Everyone you connect with sees your Outer Circle. People in your Inner Circle also see your Inner Circle.'}
        </p>
      )}

      {connections.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-soft">
          <div className="text-5xl mb-4">🤝</div>
          <p className="text-text-secondary text-base">No connections yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter connections by circle">
                {innerAllowed && FILTER_OPTIONS.map(option => {
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

            {innerAllowed && <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={allShownSelected}
                disabled={bulkSaving || shownIds.length === 0}
                onChange={event => handleSelectShown(event.target.checked, shownIds)}
                className="h-4 w-4 accent-accent"
              />
              Select all shown
            </label>}
          </div>

          {feedback && (
            <p className={feedback.type === 'error' ? 'text-sm text-error' : 'text-sm text-success'} role={feedback.type === 'error' ? 'alert' : 'status'}>
              {feedback.message}
            </p>
          )}

          {shownConnections.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-soft">
              <p className="text-text-secondary text-base">No connections in this circle.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {shownConnections.map(connection => {
                const fromUser = Array.isArray(connection.from_user) ? connection.from_user[0] : connection.from_user
                const tags = fromUser ? tagState(fromUser.id, connection.in_inner_circle) : null
                return (
                  <div key={connection.id} className="bg-card border border-border rounded-2xl p-5 shadow-soft space-y-3">
                    <div className="flex items-center gap-3">
                      {innerAllowed && <input
                        type="checkbox"
                        checked={selectedIds.has(connection.id)}
                        disabled={bulkSaving}
                        onChange={event => handleSelectShown(event.target.checked, [connection.id])}
                        aria-label={`Select ${fromUser?.display_name ?? 'connection'}`}
                        className="h-4 w-4 accent-accent flex-shrink-0"
                      />}
                      <Avatar url={fromUser?.avatar_url} name={fromUser?.display_name} size="md" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text-primary truncate">{fromUser?.display_name ?? 'Unknown'}</p>
                        <p className="text-xs text-text-secondary">@{fromUser?.username ?? ''}</p>
                      </div>
                      {confirmRemove === connection.id ? (
                        <span className="flex items-center gap-2 text-sm">
                          <button
                            type="button"
                            onClick={() => removeConnection(connection.id)}
                            disabled={removing === connection.id}
                            className="px-3 py-1.5 rounded-lg text-error border border-error/30 hover:bg-error hover:text-white disabled:opacity-50"
                          >
                            {removing === connection.id ? 'Removing…' : 'Remove'}
                          </button>
                          <button type="button" onClick={() => setConfirmRemove(null)} className="text-text-secondary hover:text-text-primary">Cancel</button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(connection.id)}
                          className="text-sm text-text-muted hover:text-error"
                          aria-label={`Remove ${fromUser?.display_name ?? 'connection'}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {confirmRemove === connection.id && (
                      <p className="text-xs text-text-secondary">
                        {fromUser?.display_name ?? 'They'} will lose access to everything beyond your public profile and can&apos;t send you a new request.
                      </p>
                    )}
                    {innerAllowed && fromUser && tags && (
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Circles of ${fromUser.display_name}`}>
                        <CircleTag label="Outer Circle" on={tags.outer} included={tags.outer} title={tags.outer ? 'Everyone you connect with sees your Outer Circle' : 'Only in circles that sit on their own'} />
                        <CircleTag
                          label="Inner Circle"
                          on={connection.in_inner_circle}
                          included={!!tags.innerThrough}
                          title={tags.innerThrough ? `Included through ${tags.innerThrough}` : undefined}
                          disabled={savingId === connection.id || bulkSaving}
                          onClick={() => handleChange(connection.id, !connection.in_inner_circle)}
                        />
                        {customCircles.map(circle => (
                          <CircleTag
                            key={circle.id}
                            label={circle.name}
                            on={tags.chosen.has(circle.id)}
                            included={tags.included.has(circle.id)}
                            title={tags.included.has(circle.id) ? `Included through ${tags.included.get(circle.id)}` : circleWhere(circle, customCircles)}
                            disabled={circleSaving === `${fromUser.id}:${circle.id}` || bulkSaving}
                            onClick={() => toggleCircle(fromUser.id, circle.id)}
                          />
                        ))}
                      </div>
                    )}
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

// One small circle tag on a connection. "included" = ticked because a chosen
// circle sits inside it (greyed, can't be clicked).
function CircleTag({ label, on, included, title, disabled, onClick }: {
  label: string
  on: boolean
  included?: boolean
  title?: string
  disabled?: boolean
  onClick?: () => void
}) {
  const shown = included ? 'included' : on ? 'on' : 'off'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !!included || !onClick}
      aria-pressed={on || !!included}
      title={title}
      className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-medium tracking-wide transition-colors ${
        shown === 'included'
          ? 'bg-accent-subtle text-text-muted cursor-default'
          : shown === 'on'
            ? 'bg-accent text-white hover:bg-accent-light'
            : onClick ? 'border border-border text-text-muted hover:border-accent/50 hover:text-text-secondary' : 'border border-border text-text-muted/70 cursor-default'
      } disabled:cursor-default`}
    >
      {shown !== 'off' && (
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m2.5 6.5 2.5 2.5 4.5-5.5" />
        </svg>
      )}
      {label}
    </button>
  )
}
