'use client'

import { useEffect, useState } from 'react'
import { orderCircles, type CustomCircle } from '@/lib/circles'

// Choose the circle for a connection (owner decision 2026-10-11): when
// sending a request (subtext: they are added once they accept) and when
// accepting one. Circle names only. One-circle tiers (Introvert) never see
// it: it picks the Outer Circle at once.

type Loaded = { innerAllowed: boolean; circles: CustomCircle[] }

export default function CirclePicker({
  title,
  subtext,
  busy = false,
  onPick,
  onCancel,
}: {
  title: string
  subtext?: string
  busy?: boolean
  onPick: (placement: string) => void
  onCancel: () => void
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let done = false
    fetch('/api/circles', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { innerAllowed?: boolean; extraCircles?: number; circles?: CustomCircle[] } | null) => {
        if (done) return
        const innerAllowed = d?.innerAllowed === true
        if (!innerAllowed) { onPick('outer'); return }
        setLoaded({ innerAllowed, circles: (d?.extraCircles ?? 0) > 0 ? orderCircles(d?.circles ?? []) : [] })
      })
      .catch(() => { if (!done) onPick('outer') })
    return () => { done = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!loaded) return <p className="text-sm text-text-muted">Loading…</p>
  const options = [
    { id: 'outer', name: 'Outer Circle' },
    { id: 'inner', name: 'Inner Circle' },
    ...loaded.circles.map(c => ({ id: c.id, name: c.name })),
  ]
  return (
    <div className="space-y-3" role="group" aria-label={title}>
      <div>
        <p className="text-sm font-medium text-text-primary">{title}</p>
        {subtext && <p className="text-xs text-text-muted mt-0.5">{subtext}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(o.id)}
            className="px-4 py-2 rounded-full border border-border text-sm font-medium text-text-primary hover:border-accent hover:bg-accent-tint disabled:opacity-50"
          >
            {o.name}
          </button>
        ))}
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
      </div>
    </div>
  )
}
