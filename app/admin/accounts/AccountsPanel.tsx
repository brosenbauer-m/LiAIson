'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import type { AccountRow } from '@/lib/admin/stats'
import { PLANS } from '@/lib/plans'

// Every account: search, see billing state and this month's usage, and act
// (never billed, extend the free month, block sign-in).

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')

export default function AccountsPanel() {
  const [rows, setRows] = useState<AccountRow[] | null>(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(0)

  const load = () =>
    fetch('/api/admin/accounts', { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRows(d.accounts); setNow(Date.now()) })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load the accounts.'))
  useEffect(() => { void load() }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!rows) return []
    if (!q) return rows
    return rows.filter(r => r.username.includes(q) || r.displayName.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q) || (r.coupon ?? '').toLowerCase().includes(q))
  }, [rows, query])

  const change = async (id: string, patch: { exempt?: boolean; extendDays?: number; blocked?: boolean }) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, username, email or event…" className="flex-1 min-w-[16rem] bg-surface border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent" />
        <p className="text-sm text-text-muted">{rows ? `${shown.length} of ${rows.length}` : 'Loading…'}</p>
      </div>
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
      <div className="bg-card border border-border rounded-2xl shadow-soft overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Free until</th>
              <th className="px-4 py-3">Card</th>
              <th className="px-4 py-3 text-right">This month</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows && shown.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-text-muted">No accounts match.</td></tr>}
            {shown.map(r => (
              <Fragment key={r.id}>
                <tr className={`border-t border-border ${r.banned ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2.5">
                    <span className="text-text-primary">{r.displayName}</span> <span className="text-text-muted">@{r.username}</span>
                    {r.banned && <span className="ml-2 rounded-full bg-error/10 px-2 py-0.5 text-[11px] text-error">blocked</span>}
                    {!r.confirmed && <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 text-[11px] text-warning">unconfirmed</span>}
                  </td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.email ?? '—'}</td>
                  <td className="px-4 py-2.5">{PLANS[r.plan]?.name ?? r.plan}{r.exempt && <span className="ml-1 text-xs text-text-muted">(never billed)</span>}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{day(r.createdAt)}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{new Date(r.trialEndsAt).getTime() > now ? day(r.trialEndsAt) : <span className="text-text-muted">over</span>}{r.sponsoredUntil && new Date(r.sponsoredUntil).getTime() > now && <span className="ml-1 text-xs text-accent">event</span>}</td>
                  <td className="px-4 py-2.5">{r.card ? 'yes' : <span className="text-text-muted">no</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">€{r.monthCostEur.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{r.coupon ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} className="text-accent hover:underline">{open === r.id ? 'Close' : 'Manage'}</button>
                  </td>
                </tr>
                {open === r.id && (
                  <tr className="bg-surface/60">
                    <td colSpan={9} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-text-muted mr-2">Last sign-in {day(r.lastSignIn)} · spending limit €{(r.spendLimitCents / 100).toFixed(0)}</span>
                        <button type="button" disabled={busy} onClick={() => change(r.id, { extendDays: 30 })} className="rounded-full border border-border px-3 py-1 hover:border-accent disabled:opacity-50">Free Month +30 Days</button>
                        <button type="button" disabled={busy} onClick={() => change(r.id, { exempt: !r.exempt })} className="rounded-full border border-border px-3 py-1 hover:border-accent disabled:opacity-50">{r.exempt ? 'Bill Normally' : 'Never Bill'}</button>
                        <button type="button" disabled={busy} onClick={() => { if (r.banned || confirm(`Block ${r.displayName} from signing in?`)) void change(r.id, { blocked: !r.banned }) }} className={`rounded-full border px-3 py-1 disabled:opacity-50 ${r.banned ? 'border-border hover:border-accent' : 'border-error/40 text-error hover:bg-error hover:text-white'}`}>{r.banned ? 'Unblock' : 'Block Sign-In'}</button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
