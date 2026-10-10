'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CustomCircle } from '@/lib/circles'

// Social Butterfly: the owner's own circles (create, rename, delete). Who is
// in each circle is chosen per connection below; what each circle sees is
// chosen in the Vault. Deleting a circle turns its Vault sections into drafts.
export default function CustomCircles({ circles, allowed }: { circles: (CustomCircle & { memberCount: number })[]; allowed: number }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const call = async (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, string>) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/circles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return false
      }
      router.refresh()
      return true
    } catch {
      setError('Something went wrong. Please try again.')
      return false
    } finally {
      setBusy(false)
    }
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (await call('POST', { name })) setName('')
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-soft space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-semibold text-text-primary text-lg">Your own circles</h2>
        <span className="text-xs text-text-secondary tabular-nums">{circles.length} of {allowed}</span>
      </div>
      <p className="text-sm text-text-secondary">
        Make circles such as Family or Climbing club. Put people in them below, and choose in your Vault what each circle sees.
      </p>

      {circles.length > 0 && (
        <ul className="divide-y divide-border border border-border rounded-lg">
          {circles.map(circle => (
            <li key={circle.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {editing?.id === circle.id ? (
                <form
                  className="flex flex-1 gap-2"
                  onSubmit={async e => {
                    e.preventDefault()
                    if (await call('PATCH', { id: circle.id, name: editing.name })) setEditing(null)
                  }}
                >
                  <input
                    value={editing.name}
                    onChange={e => setEditing({ id: circle.id, name: e.target.value })}
                    maxLength={40}
                    aria-label="Circle name"
                    className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                  <button type="submit" disabled={busy} className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50">Save</button>
                  <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-text-secondary">Cancel</button>
                </form>
              ) : (
                <>
                  <span className="flex-1 min-w-0 font-medium text-text-primary truncate">{circle.name}</span>
                  <span className="text-xs text-text-secondary">{circle.memberCount} {circle.memberCount === 1 ? 'person' : 'people'}</span>
                  {confirmDelete === circle.id ? (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="text-text-secondary">Delete? Its Vault sections become drafts.</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => { if (await call('DELETE', { id: circle.id })) setConfirmDelete(null) }}
                        className="px-3 py-1 text-red-700 border border-red-300 rounded-lg hover:bg-red-600 hover:text-white disabled:opacity-50"
                      >
                        Yes, delete
                      </button>
                      <button type="button" onClick={() => setConfirmDelete(null)} className="text-text-secondary">Cancel</button>
                    </span>
                  ) : (
                    <span className="flex gap-3 text-sm">
                      <button type="button" onClick={() => setEditing({ id: circle.id, name: circle.name })} className="text-accent hover:underline">Rename</button>
                      <button type="button" onClick={() => setConfirmDelete(circle.id)} className="text-red-700 hover:underline">Delete</button>
                    </span>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {circles.length < allowed ? (
        <form onSubmit={create} className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={40}
            placeholder="New circle, e.g. Family"
            aria-label="New circle name"
            className="flex-1 min-w-0 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            Add
          </button>
        </form>
      ) : (
        <p className="text-xs text-text-secondary">You have all {allowed} circles your plan allows. You can allow more on the <Link href="/settings#subscription" className="text-accent hover:underline">Plans page</Link>.</p>
      )}
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </div>
  )
}
