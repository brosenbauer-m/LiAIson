'use client'

import { useState } from 'react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

// Introvert's list of connections (one circle: no circle tags). Sorting and
// removing a connection (they lose access and can't send a new request).

interface ConnectionUser {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface ConnectionRow {
  id: string
  created_at: string
  from_user: ConnectionUser | ConnectionUser[] | null
}

type SortOrder = 'newest' | 'oldest' | 'name'

export default function ConnectionsList({ initialConnections }: { initialConnections: ConnectionRow[] }) {
  const [connections, setConnections] = useState(initialConnections)
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState('')

  const removeConnection = async (id: string) => {
    setRemoving(id)
    setError('')
    try {
      const res = await fetch('/api/connections/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: id }),
      })
      if (!res.ok) throw new Error('failed')
      setConnections(prev => prev.filter(c => c.id !== id))
      setConfirmRemove(null)
    } catch {
      setError('Could not remove this connection. Please try again.')
    } finally {
      setRemoving(null)
    }
  }

  const userOf = (c: ConnectionRow) => (Array.isArray(c.from_user) ? c.from_user[0] : c.from_user)
  const shown = [...connections].sort((a, b) => {
    if (sortOrder === 'name') return (userOf(a)?.display_name ?? '').localeCompare(userOf(b)?.display_name ?? '')
    const difference = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return sortOrder === 'newest' ? -difference : difference
  })

  if (connections.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-soft">
        <p className="text-text-secondary text-base">No connections yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      {error && <p className="text-sm text-error" role="alert">{error}</p>}

      <div className="space-y-3">
        {shown.map(connection => {
          const user = userOf(connection)
          return (
            <div key={connection.id} className="bg-card border border-border rounded-2xl p-5 shadow-soft space-y-3">
              <div className="flex items-center gap-3">
                <Avatar url={user?.avatar_url} name={user?.display_name} size="md" />
                <div className="flex-1 min-w-0">
                  <Link href={`/${user?.username ?? ''}`} className="block font-semibold text-text-primary truncate hover:underline">{user?.display_name ?? 'Unknown'}</Link>
                  <p className="text-xs text-text-secondary">@{user?.username ?? ''}</p>
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
                    aria-label={`Remove ${user?.display_name ?? 'connection'}`}
                  >
                    Remove
                  </button>
                )}
              </div>
              {confirmRemove === connection.id && (
                <p className="text-xs text-text-secondary">
                  {user?.display_name ?? 'They'} will lose access to everything beyond your public profile and can&apos;t send you a new request.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
