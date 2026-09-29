'use client'

import { useState } from 'react'

export default function VisitorSummary() {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSummarize = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/insights/visitor-summary', { method: 'POST' })
      const data = await res.json().catch(() => null) as { summary?: string | null; error?: string } | null
      if (!res.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.')
      } else {
        setSummary(data?.summary ?? 'Not enough visitor questions yet to summarize.')
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {summary ? (
        <p className="text-sm text-text-primary leading-relaxed">{summary}</p>
      ) : (
        <button
          type="button"
          onClick={handleSummarize}
          disabled={loading}
          className="w-full py-2.5 border-2 border-border hover:border-accent text-text-primary hover:text-accent text-sm font-medium rounded-lg transition-all disabled:opacity-60"
        >
          {loading ? 'Summarizing...' : 'Summarize what visitors ask'}
        </button>
      )}
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
      <p className="text-xs text-text-muted">Only you can see this. Based on anonymous topics — never on who asked.</p>
    </div>
  )
}
