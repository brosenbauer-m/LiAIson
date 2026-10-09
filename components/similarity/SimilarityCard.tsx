'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import SimilarityMap from '@/components/similarity/SimilarityMap'
import { LEVEL_LABEL, type SimilarityResult } from '@/lib/similarity/types'

// "What you have in common" on someone's profile (Extrovert; see
// lib/similarity/compare.ts). Worked out only when the viewer taps the
// button; a kept result that is still up to date shows right away.

type State = { quota: number; used: number; result: SimilarityResult | null }

export default function SimilarityCard({ username, displayName }: { username: string; displayName: string }) {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; link?: { href: string; label: string } } | null>(null)

  useEffect(() => {
    fetch(`/api/similarity/${encodeURIComponent(username)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: State | null) => { if (d) setState(d) })
      .catch(() => {})
  }, [username])

  const compare = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/similarity/${encodeURIComponent(username)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const link = data.emptyVault
          ? { href: '/vault', label: 'Go to your Vault' }
          : data.needsCard
            ? { href: '/settings', label: 'Go to Settings' }
            : undefined
        setError({ text: data.error ?? 'Something went wrong. Please try again.', link })
        return
      }
      setState({ quota: data.quota, used: data.used, result: data.result })
    } catch {
      setError({ text: 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  if (!state || state.quota <= 0) return null
  const { result } = state
  const left = Math.max(0, state.quota - state.used)

  return (
    <div id="similarity" className="bg-card border border-border rounded-xl p-6 shadow-soft scroll-mt-6">
      <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide mb-3">What you have in common</p>

      {result ? (
        <>
          <p className="flex items-center gap-2 text-text-primary">
            <span aria-hidden="true" className="tracking-widest">
              {[1, 2, 3, 4, 5].map(n => (n <= result.level ? '●' : '○')).join('')}
            </span>
            <span className="font-semibold">{LEVEL_LABEL[result.level]}</span>
          </p>
          {result.interests.length > 0 && (
            <div className="mt-4">
              <SimilarityMap
                people={[{ key: 'A', name: 'You' }, { key: 'B', name: displayName }]}
                interests={result.interests}
              />
            </div>
          )}
          <p className="mt-4 text-xs text-text-muted">
            Based on what you both shared, using only what {displayName} lets you see. Only you see this; {displayName} is not told.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-text-secondary leading-relaxed">
            Compare what you share with what {displayName} shares with you. Only you see the result.
          </p>
          <button
            type="button"
            onClick={compare}
            disabled={busy}
            className="mt-4 w-full px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft disabled:opacity-50"
          >
            {busy ? 'Comparing…' : 'See what we have in common'}
          </button>
          <p className="mt-2 text-xs text-text-muted text-center">
            {left} of {state.quota} comparisons left this month
          </p>
        </>
      )}

      {error && (
        <p className="mt-3 text-sm text-error" role="alert">
          {error.text}{' '}
          {error.link && <Link href={error.link.href} className="text-accent hover:underline font-medium">{error.link.label}</Link>}
        </p>
      )}
    </div>
  )
}
