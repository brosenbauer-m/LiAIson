'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import EchoesLocked from '@/components/plans/EchoesLocked'

type ReportCategory = { category: string; count: number; examples: string[]; change: number | null }
type ReportContent = {
  headline: string
  summary: string
  suggestions: string[]
  categories: ReportCategory[]
  total: number
  previousTotal: number | null
  busiestDay: string | null
  newTopics: string[]
}
type Report = {
  id: string
  period_type: 'week' | 'month'
  period_start: string
  period_end: string
  total: number
  report: ReportContent
}

const TZ = 'Europe/Vienna'

function periodLabel(r: Report): string {
  const start = new Date(r.period_start)
  if (r.period_type === 'month') {
    return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'long', year: 'numeric' }).format(start)
  }
  const lastDay = new Date(new Date(r.period_end).getTime() - 60 * 1000)
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' })
  const year = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric' }).format(lastDay)
  return `${fmt.format(start)} – ${fmt.format(lastDay)} ${year}`
}

function ReportCard({ r }: { r: Report }) {
  const c = r.report
  const max = c.categories[0]?.count ?? 0
  const diff = c.previousTotal === null ? null : c.total - c.previousTotal
  return (
    <article className="bg-card border border-border rounded-2xl p-6 shadow-soft space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide font-semibold text-text-muted">
          {r.period_type === 'week' ? 'Weekly Echo' : 'Monthly Echo'} · {periodLabel(r)}
        </p>
        <h2 className="text-2xl font-bold text-text-primary mt-1">{c.headline}</h2>
        {c.summary && <p className="text-text-secondary mt-2 leading-relaxed">{c.summary}</p>}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-accent-tint p-3">
          <p className="text-2xl font-bold text-text-primary tabular-nums">{c.total}</p>
          <p className="text-xs text-text-secondary">questions</p>
        </div>
        <div className="rounded-lg bg-accent-tint p-3">
          <p className="text-2xl font-bold text-text-primary tabular-nums">
            {diff === null ? '—' : `${diff > 0 ? '+' : ''}${diff}`}
          </p>
          <p className="text-xs text-text-secondary">vs previous {r.period_type}</p>
        </div>
        <div className="rounded-lg bg-accent-tint p-3">
          <p className="text-lg font-bold text-text-primary truncate">{c.busiestDay ?? '—'}</p>
          <p className="text-xs text-text-secondary">busiest day</p>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-text-primary">What people wanted to know</h3>
        {c.categories.map(cat => (
          <div key={cat.category}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-text-primary">
                {cat.category}
                {c.newTopics.includes(cat.category) && (
                  <span className="ml-2 text-xs font-semibold text-accent bg-accent-subtle rounded-full px-2 py-0.5">new</span>
                )}
              </span>
              <span className="text-text-secondary tabular-nums">
                {cat.count}
                {cat.change !== null && cat.change !== 0 && (
                  <span className="ml-1 text-xs">({cat.change > 0 ? '+' : ''}{cat.change})</span>
                )}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-accent-subtle overflow-hidden">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${max > 0 ? Math.max(4, Math.round((cat.count / max) * 100)) : 0}%` }}
              />
            </div>
            {cat.examples.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {cat.examples.map(e => (
                  <li key={e} className="text-sm text-text-secondary">• {e}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {c.suggestions.length > 0 && (
        <div className="rounded-lg border border-border p-4">
          <h3 className="font-semibold text-text-primary mb-2">Ideas for your Vault</h3>
          <ul className="space-y-1">
            {c.suggestions.map(s => (
              <li key={s} className="text-sm text-text-secondary">• {s}</li>
            ))}
          </ul>
          <Link href="/vault" className="inline-block mt-3 text-sm font-medium text-accent hover:underline">
            Open my Vault →
          </Link>
        </div>
      )}
    </article>
  )
}

export default function InsightsPage() {
  const [tab, setTab] = useState<'week' | 'month'>('week')
  const [reports, setReports] = useState<Report[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'signed-out' | 'error'>('loading')
  const [echoes, setEchoes] = useState<'none' | 'monthly' | 'weekly_monthly'>('weekly_monthly')

  useEffect(() => {
    fetch('/api/insights/reports', { cache: 'no-store' })
      .then(async res => {
        if (res.status === 401) { setStatus('signed-out'); return }
        const body = await res.json().catch(() => null)
        if (!res.ok || !body) { setStatus('error'); return }
        setReports(body.reports ?? [])
        if (body.echoes) setEchoes(body.echoes)
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
  }, [])

  const visible = (reports ?? []).filter(r => r.period_type === tab)
  const tabLocked = echoes === 'none' || (tab === 'week' && echoes === 'monthly')

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">Your Echoes</h1>
          <p className="text-text-secondary text-lg mt-2">
            What your LiAIson heard: a new weekly Echo every Monday and a monthly Echo on the 1st — what visitors wanted to know, in anonymous form.
          </p>
        </div>

        <div className="flex gap-1 bg-surface border border-border rounded-lg p-1 w-fit shadow-soft">
          {(['week', 'month'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-6 py-2.5 rounded-md text-sm font-medium transition-all ${
                tab === t ? 'bg-accent text-white shadow-soft' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t === 'week' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>

        {status === 'loading' && <p className="text-text-secondary">Loading...</p>}
        {status === 'signed-out' && (
          <p className="text-text-secondary">
            Please <Link href="/login?redirect=/insights" className="text-accent hover:underline">log in</Link> to see your Echoes.
          </p>
        )}
        {status === 'error' && <p className="text-error" role="alert">Could not load your Echoes right now.</p>}
        {status === 'ok' && tabLocked && <EchoesLocked period={tab} echoes={echoes} />}
        {status === 'ok' && !tabLocked && visible.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-soft">
            <p className="text-text-primary font-medium">No {tab === 'week' ? 'weekly' : 'monthly'} Echoes yet.</p>
            <p className="text-sm text-text-secondary mt-1">
              Your first one arrives {tab === 'week' ? 'on Monday' : 'on the 1st of next month'} if people ask your LiAIson questions.
            </p>
          </div>
        )}
        {status === 'ok' && visible.map(r => <ReportCard key={r.id} r={r} />)}
      </div>
    </div>
  )
}
