'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Avatar from '@/components/ui/Avatar'

type SearchResult = {
  username: string
  display_name: string
  avatar_url: string | null
}

type ContentResult = SearchResult & { match: 'full' | 'partial'; reason: string }
type Mode = 'name' | 'content'

export default function DiscoverPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [mode, setMode] = useState<Mode>('name')
  // AI search quota: null = not signed in / unknown; quota 0 = not in the plan.
  const [quota, setQuota] = useState<{ quota: number; used: number } | null>(null)
  const [contentQuery, setContentQuery] = useState('')
  const [contentResults, setContentResults] = useState<ContentResult[] | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/discover/search', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (active && data && typeof data.quota === 'number') setQuota({ quota: data.quota, used: data.used ?? 0 })
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  const runContentSearch = async (event: FormEvent) => {
    event.preventDefault()
    const q = contentQuery.trim()
    if (q.length < 3 || contentLoading) return
    setContentLoading(true)
    setContentError(null)
    try {
      const res = await fetch('/api/discover/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
      })
      const data = await res.json().catch(() => ({}))
      if (typeof data.quota === 'number') setQuota({ quota: data.quota, used: data.used ?? 0 })
      if (!res.ok) {
        setContentError(typeof data.error === 'string' ? data.error : 'Search failed. Please try again.')
        setContentResults(null)
      } else {
        setContentResults(Array.isArray(data.results) ? data.results : [])
      }
    } catch {
      setContentError('Search failed. Please try again.')
    } finally {
      setContentLoading(false)
    }
  }

  // Typing: show "searching" at once; an empty box clears the results.
  const changeQuery = (value: string) => {
    setQuery(value)
    if (value.trim().replace(/^@+/, '')) {
      setLoading(true)
    } else {
      setResults([])
      setSearched(false)
      setLoading(false)
    }
  }

  useEffect(() => {
    const q = query.trim().replace(/^@+/, '')
    if (!q) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/discover?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        setResults(Array.isArray(data.results) ? data.results : [])
        setSearched(true)
        setLoading(false)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setResults([])
          setSearched(true)
          setLoading(false)
        }
      }
    }, 250)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary mb-3 text-center">Discover</h1>
        <p className="text-text-secondary text-center mb-8">
          {mode === 'name'
            ? <>Find someone&apos;s LiAIson by name or username.</>
            : <>Describe who you are looking for, for example &quot;someone who plays tennis in Vienna&quot;.</>}
        </p>

        {quota && (
          <div className="flex justify-center gap-1 mb-6 bg-surface border border-border rounded-lg p-1 w-fit mx-auto shadow-soft" role="group" aria-label="How to search">
            {([['name', 'By name'], ['content', 'By what they share']] as [Mode, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === value ? 'bg-accent text-white shadow-soft' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === 'content' && quota && (
          quota.quota <= 0 ? (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-soft text-sm text-text-secondary leading-relaxed">
              With Ambivert or Extrovert you can find people by what they share, not just by their name, for example someone who plays tennis in Vienna.{' '}
              <Link href="/plans" className="text-accent hover:underline">See plans</Link>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={runContentSearch} className="flex gap-2">
                <input
                  type="search"
                  value={contentQuery}
                  onChange={e => setContentQuery(e.target.value)}
                  placeholder="Someone who plays tennis in Vienna"
                  maxLength={200}
                  autoComplete="off"
                  aria-label="Describe who you are looking for"
                  className="flex-1 min-w-0 bg-card border border-border rounded-2xl px-5 py-4 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60 shadow-soft"
                />
                <button
                  type="submit"
                  disabled={contentLoading || contentQuery.trim().length < 3 || quota.used >= quota.quota}
                  className="px-5 rounded-xl bg-accent hover:bg-accent-light text-white font-medium disabled:opacity-50"
                >
                  Search
                </button>
              </form>
              <p className="text-xs text-text-muted text-center">
                {Math.max(0, quota.quota - quota.used)} of {quota.quota} searches left this month (the same search again today is free). Only people who chose to be findable are searched, and only what everyone can see on their profile.
              </p>

              {contentLoading && <p className="text-center text-sm text-text-secondary py-6">Searching...</p>}
              {!contentLoading && contentError && <p className="text-center text-sm text-error py-2" role="alert">{contentError}</p>}
              {!contentLoading && !contentError && contentResults && contentResults.length === 0 && (
                <p className="text-center text-sm text-text-secondary py-6">No one found. Try describing it differently.</p>
              )}
              {!contentLoading && contentResults && contentResults.length > 0 && (
                <ul className="bg-card border border-border rounded-2xl shadow-soft divide-y divide-border overflow-hidden">
                  {contentResults.map(person => (
                    <li key={person.username}>
                      <Link href={`/${person.username}`} className="flex items-start gap-3 px-4 py-3 hover:bg-accent-tint transition-colors">
                        <Avatar url={person.avatar_url} name={person.display_name} />
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary truncate">
                            {person.display_name}{' '}
                            <span className="text-sm font-normal text-text-secondary">@{person.username}</span>
                          </p>
                          {person.reason && <p className="text-sm text-text-secondary">{person.reason}</p>}
                          <p className="text-xs text-text-muted mt-1">{person.match === 'full' ? 'Matches everything you asked for' : 'Matches part of what you asked for'}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        )}

        {mode === 'name' && (
        <>
        <div className="relative">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted"
          >
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => changeQuery(e.target.value)}
            placeholder="Search by name or @username"
            maxLength={50}
            autoFocus
            autoComplete="off"
            aria-label="Search people"
            className="w-full bg-card border border-border rounded-2xl pl-12 pr-5 py-4 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60 shadow-soft"
          />
        </div>

        <div className="mt-4">
          {loading && (
            <p className="text-center text-sm text-text-secondary py-6">Searching...</p>
          )}

          {!loading && searched && results.length === 0 && (
            <p className="text-center text-sm text-text-secondary py-6">No one found. Try a different name or username.</p>
          )}

          {!loading && results.length > 0 && (
            <ul className="bg-card border border-border rounded-2xl shadow-soft divide-y divide-border overflow-hidden">
              {results.map(person => (
                <li key={person.username}>
                  <Link
                    href={`/${person.username}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent-tint transition-colors"
                  >
                    <Avatar url={person.avatar_url} name={person.display_name} />
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">{person.display_name}</p>
                      <p className="text-sm text-text-secondary truncate">@{person.username}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  )
}
