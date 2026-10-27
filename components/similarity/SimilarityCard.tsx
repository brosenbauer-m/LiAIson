'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import BubbleChart from '@/components/similarity/BubbleChart'
import { LEVEL_LABEL, type SimilarityResult } from '@/lib/similarity/types'

// "What you have in common" on someone's profile (Extrovert; see
// lib/similarity/compare.ts). Nothing shows until the viewer taps the button
// (owner decision 2026-10-12): a kept result that is still up to date is
// shown for free, otherwise a new check is made (counts towards the limit).

type State = { quota: number; used: number; result: SimilarityResult | null }

export default function SimilarityCard({ username, displayName, groupCompare, bare = false }: { username: string; displayName: string; groupCompare: boolean; bare?: boolean }) {
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<{ text: string; link?: { href: string; label: string } } | null>(null)

  useEffect(() => {
    fetch(`/api/similarity/${encodeURIComponent(username)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: State | null) => { if (d) setState(d) })
      .catch(() => {})
  }, [username])

  const compare = async () => {
    if (state?.result) { setShown(true); return }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/similarity/${encodeURIComponent(username)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const link = data.emptyVault
          ? { href: '/vault', label: 'Go to Your Vault' }
          : data.needsCard
            ? { href: '/settings', label: 'Go to Settings' }
            : undefined
        setError({ text: data.error ?? 'Something went wrong. Please try again.', link })
        return
      }
      setState({ quota: data.quota, used: data.used, result: data.result })
      setShown(true)
    } catch {
      setError({ text: 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  if (!state || state.quota <= 0) return null
  const result = shown ? state.result : null
  const kept = !!state.result
  const left = Math.max(0, state.quota - state.used)
  const first = displayName.split(' ')[0] || displayName

  return (
    <div id="similarity" className={bare ? 'scroll-mt-24' : 'bg-card border border-border rounded-2xl p-6 shadow-soft scroll-mt-6'}>
      <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide mb-3">What You Have in Common</p>

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
              <BubbleChart
                people={[{ key: 'A', name: 'You', you: true }, { key: 'B', name: displayName }]}
                interests={result.interests}
              />
            </div>
          )}
          <p className="mt-3 text-xs text-text-muted text-center">Only you see this; {first} is not notified.</p>
          {groupCompare && (
            <Link
              href={`/similarities?u=${encodeURIComponent(username)}`}
              className="mt-4 flex w-full items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-accent/40 text-accent hover:bg-accent-tint text-sm font-medium transition-colors"
            >
              <span aria-hidden="true">+</span> Add More People to a Similarities Chart
            </Link>
          )}
          <button type="button" onClick={() => setShown(false)} className="mt-3 block mx-auto text-xs text-text-muted hover:text-text-secondary">
            Hide
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-text-secondary leading-relaxed">
            See a chart of what you have in common with {first}. Only you see it.
          </p>
          <button
            type="button"
            onClick={compare}
            disabled={busy}
            className="mt-4 w-full px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft disabled:opacity-50"
          >
            {busy ? 'Checking…' : kept ? 'Show What We Have in Common' : 'See What We Have in Common*'}
          </button>
          {!kept && (
            <p className="mt-2 text-xs text-text-muted text-center">
              {left} of {state.quota} Similarity checks left this month
            </p>
          )}
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
