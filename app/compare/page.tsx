'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import SimilarityMap from '@/components/similarity/SimilarityMap'
import { LEVEL_LABEL, type SimilarityResult } from '@/lib/similarity/types'

// Compare yourself with several people at once (Social Butterfly).
// Pick people you are connected to (or add anyone by username), then see one
// bubble map for everyone and how much each person has in common with you.
// Only you see it; nobody is told.

type Candidate = { username: string; display_name: string; avatar_url: string | null }
type Person = { key: string; username: string; name: string; avatarUrl: string | null }
type Loaded = {
  groupCompare: number
  quota: number
  used: number
  candidates: Candidate[]
  people: Person[] | null
  result: SimilarityResult | null
}

function dots(level: number): string {
  return [1, 2, 3, 4, 5].map(n => (n <= level ? '●' : '○')).join('')
}

export default function ComparePage() {
  const router = useRouter()
  const [data, setData] = useState<Loaded | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; link?: { href: string; label: string } } | null>(null)
  const [people, setPeople] = useState<Person[] | null>(null)
  const [result, setResult] = useState<SimilarityResult | null>(null)

  const load = useCallback(async () => {
    const fromUrl = (new URLSearchParams(window.location.search).get('u') ?? '').split(',').map(u => u.trim()).filter(Boolean)
    const res = await fetch(`/api/compare?u=${encodeURIComponent(fromUrl.join(','))}`, { cache: 'no-store' }).catch(() => null)
    if (res?.status === 401) {
      router.push('/login?redirect=/compare')
      return
    }
    if (!res?.ok) {
      setError({ text: 'Something went wrong. Please refresh the page.' })
      return
    }
    const d = (await res.json()) as Loaded
    setData(d)
    setSelected(fromUrl.slice(0, Math.max(d.groupCompare, 0)))
    setNames(Object.fromEntries(d.candidates.map(c => [c.username.toLowerCase(), c.display_name])))
    if (d.people && d.result) {
      setPeople(d.people)
      setResult(d.result)
    }
  }, [router])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const toggle = (username: string) => {
    setError(null)
    setSelected(prev => {
      const has = prev.some(u => u.toLowerCase() === username.toLowerCase())
      if (has) return prev.filter(u => u.toLowerCase() !== username.toLowerCase())
      if (data && prev.length >= data.groupCompare) return prev
      return [...prev, username]
    })
  }

  const addExtra = (e: React.FormEvent) => {
    e.preventDefault()
    const username = extra.trim().replace(/^@/, '')
    if (!username) return
    if (!/^[\w.-]{1,40}$/.test(username)) {
      setError({ text: 'Please enter a username, e.g. anna.berger.' })
      return
    }
    if (!selected.some(u => u.toLowerCase() === username.toLowerCase())) toggle(username)
    setExtra('')
  }

  const compare = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: selected }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        const link = d.emptyVault
          ? { href: '/vault', label: 'Go to your Vault' }
          : d.needsCard
            ? { href: '/settings', label: 'Go to Settings' }
            : d.locked
              ? { href: '/plans#butterfly', label: 'See Social Butterfly' }
              : undefined
        setError({ text: d.error ?? 'Something went wrong. Please try again.', link })
        return
      }
      setPeople(d.people)
      setResult(d.result)
      setData(prev => (prev ? { ...prev, quota: d.quota, used: d.used } : prev))
      router.replace(`/compare?u=${encodeURIComponent(selected.join(','))}`)
    } catch {
      setError({ text: 'Something went wrong. Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-secondary">{error?.text ?? 'Loading...'}</p>
      </div>
    )
  }

  const left = Math.max(0, data.quota - data.used)
  const locked = data.groupCompare < 2

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <div>
          <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">Compare</h1>
          <p className="text-text-secondary text-lg mt-2">See what you have in common with several people at once.</p>
        </div>

        {locked ? (
          <div className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-3">
            <p className="text-sm text-text-secondary leading-relaxed">
              Comparing yourself with several people at once is part of Social Butterfly. With Extrovert you can compare yourself with one person on their profile.
            </p>
            <Link href="/plans#butterfly" className="text-sm text-accent hover:underline font-medium">See Social Butterfly →</Link>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-semibold text-text-primary">Choose 2 to {data.groupCompare} people</h2>
              <span className="text-xs text-text-secondary tabular-nums">{selected.length} of {data.groupCompare}</span>
            </div>

            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => toggle(u)}
                    className="px-3 py-1 rounded-full text-sm font-medium bg-accent text-white"
                    aria-label={`Remove ${names[u.toLowerCase()] ?? u}`}
                  >
                    {names[u.toLowerCase()] ?? `@${u}`} ×
                  </button>
                ))}
              </div>
            )}

            {data.candidates.length > 0 && (
              <div>
                <p className="text-xs text-text-secondary mb-2">People you are connected to</p>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {data.candidates.map(c => {
                    const on = selected.some(u => u.toLowerCase() === c.username.toLowerCase())
                    return (
                      <button
                        key={c.username}
                        type="button"
                        onClick={() => toggle(c.username)}
                        aria-pressed={on}
                        disabled={!on && selected.length >= data.groupCompare}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all disabled:opacity-40 ${
                          on ? 'border-accent bg-accent-tint text-accent font-medium' : 'border-border text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        {c.display_name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <form onSubmit={addExtra} className="flex gap-2">
              <input
                value={extra}
                onChange={e => setExtra(e.target.value)}
                placeholder="Add someone by username"
                aria-label="Add someone by username"
                className="flex-1 min-w-0 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={!extra.trim() || selected.length >= data.groupCompare}
                className="px-4 py-2.5 border-2 border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </form>

            <div>
              <button
                type="button"
                onClick={compare}
                disabled={busy || selected.length < 2}
                className="w-full px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft disabled:opacity-50"
              >
                {busy ? 'Comparing…' : 'Compare'}
              </button>
              <p className="mt-2 text-xs text-text-muted text-center">
                Each person counts as one comparison. {left} of {data.quota} left this month. Comparing the same people again is free while nothing has changed.
              </p>
            </div>

            {error && (
              <p className="text-sm text-error" role="alert">
                {error.text}{' '}
                {error.link && <Link href={error.link.href} className="text-accent hover:underline font-medium">{error.link.label}</Link>}
              </p>
            )}
          </div>
        )}

        {people && result && (
          <div className="bg-card border border-border rounded-xl p-6 shadow-soft space-y-5">
            <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide">What you have in common</p>
            <ul className="space-y-2">
              {people.map(p => {
                const level = result.levels?.[p.key] ?? 1
                return (
                  <li key={p.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <Link href={`/${p.username}`} className="font-medium text-text-primary hover:underline">{p.name}</Link>
                    <span className="flex items-center gap-2 text-sm text-text-primary">
                      <span aria-hidden="true" className="tracking-widest">{dots(level)}</span>
                      <span>{LEVEL_LABEL[level]}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            {result.interests.length > 0 && (
              <SimilarityMap
                people={[{ key: 'A', name: 'You' }, ...people.map(p => ({ key: p.key, name: p.name }))]}
                interests={result.interests}
              />
            )}
            <p className="text-xs text-text-muted">
              Based on what you all shared, using only what each person lets you see. Only you see this; nobody is told.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
