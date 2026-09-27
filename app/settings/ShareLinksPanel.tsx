'use client'

import { useEffect, useState } from 'react'

type LinkScope = 'professional' | 'personal' | 'both'

interface ShareLink {
  id: string
  scope: LinkScope
  token: string
  created_at: string
  revoked_at: string | null
}

const SCOPE_LABELS: Record<LinkScope, string> = {
  professional: 'Professional',
  personal: 'Personal',
  both: 'Both',
}

export default function ShareLinksPanel({ username }: { username: string }) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newScope, setNewScope] = useState<LinkScope>('both')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = async () => {
    const response = await fetch('/api/share-links')
    if (!response.ok) throw new Error('Failed to load share links.')
    const data = await response.json()
    setLinks(data.links ?? [])
  }

  useEffect(() => {
    let active = true

    const loadInitialLinks = async () => {
      try {
        const response = await fetch('/api/share-links')
        if (!response.ok) throw new Error('Failed to load share links.')
        const data = await response.json()
        if (active) setLinks(data.links ?? [])
      } catch {
        if (active) setErrorMessage('Could not load share links. Please try again.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadInitialLinks()
    return () => { active = false }
  }, [])

  const handleCreate = async () => {
    setCreating(true)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/share-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: newScope }),
      })
      if (!response.ok) throw new Error('Failed to create share link.')
      await load()
    } catch {
      setErrorMessage('Could not create a share link. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this link? It will stop working immediately.')) return
    setErrorMessage(null)
    try {
      const response = await fetch(`/api/share-links/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to revoke share link.')
      await load()
    } catch {
      setErrorMessage('Could not revoke the share link. Please try again.')
    }
  }

  const buildUrl = (token: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    return `${base}/${username}?link=${encodeURIComponent(token)}`
  }

  const handleCopy = async (link: ShareLink) => {
    try {
      await navigator.clipboard.writeText(buildUrl(link.token))
      setCopiedId(link.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setErrorMessage('Could not copy the link. Please copy its URL manually.')
    }
  }

  const activeLinks = links.filter(link => !link.revoked_at)

  return (
    <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
      <h2 className="font-semibold text-text-primary text-lg">Share Links</h2>
      <p className="text-sm text-text-secondary leading-relaxed">
        Create a link that always grants a specific scope, no matter your general chat access setting.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <select
          aria-label="Share link access scope"
          value={newScope}
          onChange={event => setNewScope(event.target.value as LinkScope)}
          className="flex-1 px-4 py-3 rounded-lg border-2 border-border bg-background text-text-primary text-sm"
        >
          <option value="professional">Professional</option>
          <option value="personal">Personal</option>
          <option value="both">Both</option>
        </select>
        <button
          onClick={handleCreate}
          disabled={creating || !username}
          className="px-6 py-3 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Link'}
        </button>
      </div>

      {errorMessage && <p role="alert" className="text-sm text-error">{errorMessage}</p>}

      {loading ? (
        <p className="text-sm text-text-secondary">Loading...</p>
      ) : activeLinks.length === 0 ? (
        <p className="text-sm text-text-secondary">No active links yet.</p>
      ) : (
        <div className="space-y-3">
          {activeLinks.map(link => (
            <div key={link.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-4 rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-accent mb-1">{SCOPE_LABELS[link.scope]}</p>
                <p className="text-sm text-text-secondary font-mono truncate">{buildUrl(link.token)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleCopy(link)}
                  className="px-4 py-2 border-2 border-border hover:border-accent text-text-primary text-xs font-medium rounded-lg transition-all"
                >
                  {copiedId === link.id ? 'Copied ✓' : 'Copy'}
                </button>
                <button
                  onClick={() => handleRevoke(link.id)}
                  className="px-4 py-2 border-2 border-error/30 hover:bg-error/10 text-error text-xs font-medium rounded-lg transition-all"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}