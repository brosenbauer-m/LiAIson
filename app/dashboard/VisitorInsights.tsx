'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EchoesLocked from '@/components/plans/EchoesLocked'

type Category = { category: string; count: number; examples: string[] }
type Echoes = 'none' | 'monthly' | 'weekly_monthly'
type Data = { total: number; categories: Category[]; locked?: Echoes }

export default function VisitorInsights() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const choosePeriod = (p: 'week' | 'month') => {
    if (p === period) return
    setLoading(true)
    setError('')
    setPeriod(p)
  }

  useEffect(() => {
    let cancelled = false
    fetch(`/api/insights?period=${period}`, { cache: 'no-store' })
      .then(async res => {
        const body = await res.json().catch(() => null)
        if (cancelled) return
        if (!res.ok || !body) {
          setError('Could not load insights right now.')
          setData(null)
        } else {
          setData({ total: body.total ?? 0, categories: body.categories ?? [], locked: body.locked ? body.echoes : undefined })
        }
      })
      .catch(() => { if (!cancelled) setError('Could not load insights right now.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [period])

  const max = data?.categories[0]?.count ?? 0

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-soft space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">What visitors want to know</h2>
          <p className="text-sm text-text-secondary mt-1">
            Updated with every question. Anonymous — never who asked or their exact words.
          </p>
        </div>
        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
          {(['week', 'month'] as const).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => choosePeriod(p)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                period === p ? 'bg-accent text-white shadow-soft' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {p === 'week' ? 'This week' : 'This month'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-text-secondary">Loading...</p>
      ) : error ? (
        <p className="text-sm text-error" role="alert">{error}</p>
      ) : data?.locked ? (
        <EchoesLocked period={period} echoes={data.locked} />
      ) : !data || data.total === 0 ? (
        <p className="text-sm text-text-secondary">
          No questions yet {period === 'week' ? 'this week' : 'this month'}. Share your LiAIson link to get people asking.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">{data.total}</span>{' '}
            {data.total === 1 ? 'question' : 'questions'} {period === 'week' ? 'this week' : 'this month'}
          </p>
          <ul className="space-y-3">
            {data.categories.map(c => (
              <li key={c.category}>
                <button
                  type="button"
                  onClick={() => setOpen(open === c.category ? null : c.category)}
                  className="w-full text-left group"
                  aria-expanded={open === c.category}
                >
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-text-primary group-hover:text-accent">{c.category}</span>
                    <span className="text-text-secondary tabular-nums">{c.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-accent-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${max > 0 ? Math.max(4, Math.round((c.count / max) * 100)) : 0}%` }}
                    />
                  </div>
                </button>
                {open === c.category && c.examples.length > 0 && (
                  <ul className="mt-2 ml-1 space-y-1">
                    {c.examples.map(e => (
                      <li key={e} className="text-sm text-text-secondary">• {e}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-muted">Tap a topic to see what people want to know.</p>
        </div>
      )}

      <Link href="/insights" className="inline-block text-sm font-medium text-accent hover:underline">
        See your weekly and monthly Echoes →
      </Link>
    </div>
  )
}
