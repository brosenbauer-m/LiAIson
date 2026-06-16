'use client'

import { useState } from 'react'
import Link from 'next/link'
import ProfileCard from '@/components/ui/ProfileCard'
import type { User } from '@/types'

type FilterMode = 'all' | 'professional' | 'personal'

export default function DiscoverPage() {
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [mode, setMode] = useState<FilterMode>('all')
  const [results, setResults] = useState<{ user: User; tags: string[] }[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)

    const res = await fetch('/api/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode, location }),
    })

    const data = await res.json()
    setResults(data.results ?? [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="font-bold text-xl text-accent-light">LiAIson</Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-text-secondary hover:text-text-primary text-sm transition-colors">Login</Link>
            <Link href="/signup" className="px-4 py-2 bg-accent hover:bg-accent/90 text-white text-sm rounded-lg transition-colors">
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-text-primary mb-3 text-center">Discover</h1>
        <p className="text-text-secondary text-center mb-10">
          Find interesting people based on their skills, interests, and what they&apos;re looking for.
        </p>

        <form onSubmit={handleSearch} className="space-y-4 mb-8">
          <div className="relative">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Find someone who plays tennis in Vienna, or a designer who loves coffee..."
              className="w-full bg-card border border-border rounded-xl px-5 py-4 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60 pr-32"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="absolute right-2 top-2 bottom-2 px-5 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? '...' : 'Search'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex gap-1 bg-surface rounded-lg p-1">
              {(['all', 'professional', 'personal'] as FilterMode[]).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setMode(f)}
                  className={`px-4 py-1.5 rounded-md text-sm capitalize transition-colors ${
                    mode === f ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="City (optional)"
              className="bg-surface border border-border rounded-lg px-4 py-1.5 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
            />
          </div>
        </form>

        {loading && (
          <div className="text-center text-text-secondary py-12">Searching...</div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-text-secondary">No results found. Try a different search.</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {results.map(({ user, tags }) => (
              <ProfileCard key={user.id} user={user} tags={tags} />
            ))}
          </div>
        )}

        {!searched && !loading && (
          <div className="text-center py-16 text-text-secondary">
            <div className="text-5xl mb-4">🔍</div>
            <p>Search for people based on what makes them interesting</p>
          </div>
        )}
      </div>
    </div>
  )
}
