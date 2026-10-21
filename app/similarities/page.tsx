'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BubbleChart, { type ChartPerson } from '@/components/similarity/BubbleChart'
import GroupTalk from '@/components/similarity/GroupTalk'
import TierMark from '@/components/ui/TierMark'
import type { SimilarityResult } from '@/lib/similarity/types'

// Similarities with several people at once (Social Butterfly). Find people
// by name or @username (Discover search, plus your connections), then see one
// floating bubble chart of everything they have in common, with each other
// and, if you switch on Include Me, with you (off by default; owner decision
// 2026-10-12). Only what each person lets you see is used. Only you see it.

type Candidate = { username: string; display_name: string; avatar_url: string | null; plan?: string | null }
type Person = { key: string; username: string; name: string; avatarUrl: string | null }
type Loaded = {
  groupCompare: number
  quota: number
  used: number
  me: { username: string; name: string; avatarUrl: string | null }
  candidates: Candidate[]
  people: Person[] | null
  result: SimilarityResult | null
}

export default function SimilaritiesPage() {
  const router = useRouter()
  const [data, setData] = useState<Loaded | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Candidate[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; link?: { href: string; label: string } } | null>(null)
  const [people, setPeople] = useState<Person[] | null>(null)
  const [result, setResult] = useState<SimilarityResult | null>(null)
  const [includeMe, setIncludeMe] = useState(false)
  // The people picker folds away once there is a chart (owner 2026-10-21).
  const [chooserOpen, setChooserOpen] = useState(true)

  const load = useCallback(async () => {
    const params = new URLSearchParams(window.location.search)
    const fromUrl = (params.get('u') ?? '').split(',').map(u => u.trim()).filter(Boolean)
    const me = params.get('me') === '1'
    setIncludeMe(me)
    const res = await fetch(`/api/compare?u=${encodeURIComponent(fromUrl.join(','))}${me ? '&me=1' : ''}`, { cache: 'no-store' }).catch(() => null)
    if (res?.status === 401) {
      router.push('/login?redirect=/similarities')
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
      setChooserOpen(false)
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

  // Search: your connections that match, then people findable on Discover.
  useEffect(() => {
    const q = query.trim().replace(/^@/, '').toLowerCase()
    if (!q) {
      const t = setTimeout(() => setFound([]), 0)
      return () => clearTimeout(t)
    }
    const local = (data?.candidates ?? []).filter(c => c.username.toLowerCase() !== (data?.me.username ?? '').toLowerCase() && (c.username.toLowerCase().startsWith(q) || c.display_name.toLowerCase().includes(q)))
    const controller = new AbortController()
    const t = setTimeout(async () => {
      setFound(local.slice(0, 6))
      const res = await fetch(`/api/discover?q=${encodeURIComponent(q)}`, { signal: controller.signal }).catch(() => null)
      if (!res?.ok) return
      const { results } = (await res.json()) as { results: Candidate[] }
      // You are added only with the Include Me switch, never from the search.
      const seen = new Set([...local.map(c => c.username.toLowerCase()), (data?.me.username ?? '').toLowerCase()])
      setFound([...local, ...results.filter(r => !seen.has(r.username.toLowerCase()))].slice(0, 6))
    }, 200)
    return () => { clearTimeout(t); controller.abort() }
  }, [query, data])

  const pick = (c: Candidate) => {
    setNames(prev => ({ ...prev, [c.username.toLowerCase()]: c.display_name }))
    if (!selected.some(u => u.toLowerCase() === c.username.toLowerCase())) toggle(c.username)
    setQuery('')
    setFound([])
  }

  const compare = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: selected, includeMe }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        const link = d.emptyVault
          ? { href: '/vault', label: 'Go to Your Vault' }
          : d.needsCard
            ? { href: '/settings', label: 'Go to Settings' }
            : d.locked
              ? { href: '/settings#subscription', label: 'See Social Butterfly' }
              : undefined
        setError({ text: d.error ?? 'Something went wrong. Please try again.', link })
        return
      }
      setPeople(d.people)
      setResult(d.result)
      setChooserOpen(false)
      setData(prev => (prev ? { ...prev, quota: d.quota, used: d.used } : prev))
      router.replace(`/similarities?u=${encodeURIComponent(selected.join(','))}${includeMe ? '&me=1' : ''}`)
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
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">Similarities</h1>
          <p className="text-text-secondary text-lg mt-2">See what several people have in common.</p>
        </div>

        {locked ? (
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 shadow-soft space-y-3 text-center">
            <p className="text-sm text-text-secondary leading-relaxed">
              Similarities with several people at once are part of Social Butterfly. With Extrovert you can see your Similarities with one person on their profile.
            </p>
            <Link href="/settings#subscription" className="text-sm text-accent hover:underline font-medium">See Social Butterfly</Link>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 shadow-soft space-y-5">
            <button
              type="button"
              onClick={() => setChooserOpen(o => !o)}
              aria-expanded={chooserOpen}
              className="w-full flex items-center justify-between gap-4 text-left"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-text-primary">Choose 2 to {data.groupCompare} People</span>
                {!chooserOpen && selected.length > 0 && (
                  <span className="block text-sm text-text-secondary truncate">
                    {selected.map(u => names[u.toLowerCase()] ?? `@${u}`).join(', ')}{includeMe ? ' and you' : ''}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-text-secondary tabular-nums">{selected.length} of {data.groupCompare}</span>
                <span className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-text-secondary text-lg leading-none" aria-hidden="true">
                  {chooserOpen ? '−' : '+'}
                </span>
              </span>
            </button>

            {chooserOpen && (<>
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

            <div className="relative">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                disabled={selected.length >= data.groupCompare}
                placeholder={selected.length >= data.groupCompare ? `You have chosen ${data.groupCompare} people` : 'Search by name or @username'}
                aria-label="Search people by name or username"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent disabled:opacity-60"
              />
              {found.length > 0 && (
                <ul className="mt-2 border border-border rounded-lg divide-y divide-border overflow-hidden" aria-label="Search results">
                  {found.map(c => (
                    <li key={c.username}>
                      <button
                        type="button"
                        onClick={() => pick(c)}
                        className="w-full flex items-baseline gap-2 px-4 py-2.5 text-left hover:bg-accent-tint"
                      >
                        <span className="text-sm font-medium text-text-primary">{c.display_name} <TierMark plan={c.plan} /></span>
                        <span className="text-xs text-text-muted">@{c.username}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <span>
                <span className="block text-sm font-medium text-text-primary">Include Me</span>
                <span className="block text-xs text-text-secondary">Also show what you have in common with them.</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={includeMe}
                onClick={() => setIncludeMe(v => !v)}
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${includeMe ? 'bg-accent' : 'bg-border'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-all ${includeMe ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>

            <div>
              <button
                type="button"
                onClick={compare}
                disabled={busy || selected.length < 2}
                className="w-full px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Create Similarities Chart*'}
              </button>
              <p className="mt-2 text-xs text-text-muted text-center">
                Each person counts as one Similarity check. {left} of {data.quota} left this month.
              </p>
            </div>

            {error && (
              <p className="text-sm text-error" role="alert">
                {error.text}{' '}
                {error.link && <Link href={error.link.href} className="text-accent hover:underline font-medium">{error.link.label}</Link>}
              </p>
            )}
            </>)}
          </div>
        )}

        {people && result && (() => {
          const chartPeople: ChartPerson[] = [
            ...(result.includesViewer ? [{ key: 'A', name: data.me.name, avatarUrl: data.me.avatarUrl, you: true }] : []),
            ...people.map(p => ({ key: p.key, name: p.name, avatarUrl: p.avatarUrl })),
          ]
          const usernames = people.map(p => p.username)
          const includesViewer = !!result.includesViewer
          const pairLevel = (a: string, b: string) =>
            a === 'A' ? result.levels?.[b] : b === 'A' ? result.levels?.[a] : result.pairs?.[[a, b].sort().join('-')]
          const learnMore = async (interest: { label: string; people: string[] }) => {
            const res = await fetch('/api/compare/topic', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ usernames, includeMe: includesViewer, label: interest.label, people: interest.people }),
            }).catch(() => null)
            const d = await res?.json().catch(() => ({})) ?? {}
            if (!res?.ok) return { error: d.error ?? 'Learn More is not available right now.' }
            window.dispatchEvent(new Event('liaison:usage-changed'))
            return { summary: d.summary as string }
          }
          return (
            <section className="space-y-10" aria-label="Similarities Chart">
              {result.interests.length > 0 && (
                <BubbleChart people={chartPeople} interests={result.interests} pairLevel={pairLevel} onLearnMore={learnMore} />
              )}
              <p className="text-xs text-text-muted text-center">
                Uses only what each person lets you see. Only you see this; nobody is notified.
              </p>
              <GroupTalk
                key={`${usernames.join(',')}|${includesViewer}`}
                usernames={usernames}
                includeMe={includesViewer}
                names={people.map(p => p.name)}
              />
            </section>
          )
        })()}
      </div>
    </div>
  )
}
