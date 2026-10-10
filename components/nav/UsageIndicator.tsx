'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatMoney, type Currency } from '@/lib/currency'

// Header: this month's usage, always visible when signed in (not on the home
// page). The ring fills towards the spending limit (plus any credit); the
// amount is in the person's display currency. Refreshes after a message
// ('liaison:usage-changed') and every few minutes.

type Usage = { costCents: number; limitCents: number; creditCents: number; paused: boolean; currency: Currency; rate: number }

export default function UsageIndicator() {
  const [usage, setUsage] = useState<Usage | null>(null)

  const load = useCallback(() => {
    fetch('/api/usage', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((u: Usage | null) => { if (u) setUsage(u) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 0)
    const every = setInterval(load, 5 * 60 * 1000)
    window.addEventListener('liaison:usage-changed', load)
    return () => { clearTimeout(t); clearInterval(every); window.removeEventListener('liaison:usage-changed', load) }
  }, [load])

  if (!usage) return null
  const cap = usage.limitCents + usage.creditCents
  const pct = cap > 0 ? Math.min(1, usage.costCents / cap) : 0
  const amount = formatMoney(usage.costCents / 100, usage.currency, usage.rate)
  const r = 7
  const c = 2 * Math.PI * r
  const title = cap > 0
    ? `${amount} used this month of ${formatMoney(usage.limitCents / 100, usage.currency, usage.rate)} limit${usage.creditCents > 0 ? ` + ${formatMoney(usage.creditCents / 100, usage.currency, usage.rate)} credit` : ''}`
    : `${amount} used this month`

  return (
    <Link
      href="/settings#subscription"
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums whitespace-nowrap ${
        usage.paused ? 'border-error/40 text-error' : 'border-border text-text-secondary hover:text-text-primary hover:border-accent/50'
      }`}
    >
      {cap > 0 && (
        <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true" className="-rotate-90">
          <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.2" />
          <circle cx="9" cy="9" r={r} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className={usage.paused ? '' : 'text-accent'} />
        </svg>
      )}
      {amount}
    </Link>
  )
}
