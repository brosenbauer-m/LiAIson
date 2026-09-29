'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type SearchResult = {
  username: string
  display_name: string
  avatar_url: string | null
}

export default function DiscoverPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const q = query.trim().replace(/^@+/, '')
    if (!q) {
      setResults([])
      setSearched(false)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
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
        <h1 className="text-4xl font-bold text-text-primary mb-3 text-center">Discover</h1>
        <p className="text-text-secondary text-center mb-8">
          Find someone&apos;s LiAIson by name or username.
        </p>

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
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or @username"
            maxLength={50}
            autoFocus
            autoComplete="off"
            aria-label="Search people"
            className="w-full bg-card border border-border rounded-xl pl-12 pr-5 py-4 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60 shadow-soft"
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
            <ul className="bg-card border border-border rounded-xl shadow-soft divide-y divide-border overflow-hidden">
              {results.map(person => (
                <li key={person.username}>
                  <Link
                    href={`/${person.username}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-accent-tint transition-colors"
                  >
                    {person.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={person.avatar_url}
                        alt=""
                        className="h-10 w-10 flex-shrink-0 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="h-10 w-10 flex-shrink-0 rounded-full bg-accent-subtle flex items-center justify-center text-accent-light font-semibold">
                        {person.display_name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
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
      </div>
    </div>
  )
}
