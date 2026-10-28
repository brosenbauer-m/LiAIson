'use client'

import { useEffect, useState } from 'react'
import type { CampaignSummary } from '@/lib/admin/coupons'
import { PLANS, PLAN_IDS, formatEur } from '@/lib/plans'

// Event codes: create a campaign (one shared code or individual codes), see
// seats used and what the participants used, switch off, archive, export.

type Form = { name: string; organisation: string; mode: 'shared' | 'individual'; audience: 'new' | 'existing' | 'both'; tier: string; freeDays: string; creditEur: string; seats: string; expiresAt: string; code: string; notes: string }
const EMPTY: Form = { name: '', organisation: '', mode: 'shared', audience: 'both', tier: 'extrovert', freeDays: '30', creditEur: '5', seats: '100', expiresAt: '', code: '', notes: '' }

const AUDIENCE: Record<Form['audience'], string> = { new: 'new accounts', existing: 'existing accounts', both: 'new and existing accounts' }
const field = 'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent'
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null)

export default function CouponsPanel() {
  const [rows, setRows] = useState<CampaignSummary[] | null>(null)
  const [archived, setArchived] = useState(false)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [made, setMade] = useState<{ id: string; codes: string[] } | null>(null)
  const [now, setNow] = useState(0)

  const load = (arch = archived) =>
    fetch(`/api/admin/coupons?archived=${arch ? 1 : 0}`, { cache: 'no-store' })
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRows(d.campaigns); setNow(Date.now()) })
      .catch(e => setError(e instanceof Error ? e.message : 'Could not load the campaigns.'))
  useEffect(() => { void load(archived) }, [archived]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, freeDays: Number(form.freeDays), creditEur: Number(form.creditEur), seats: Number(form.seats) }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error)
      setMade(d)
      setForm(EMPTY)
      setCreating(false)
      await load(false)
      setArchived(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The campaign could not be created.')
    } finally {
      setBusy(false)
    }
  }

  const patch = async (id: string, body: { active?: boolean; archived?: boolean }) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/coupons/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The change could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const signupLink = (code: string) => `${typeof window !== 'undefined' ? window.location.origin : ''}/signup?code=${encodeURIComponent(code)}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setCreating(c => !c); setMade(null) }} className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-full shadow-soft">
          {creating ? 'Cancel' : 'New Campaign'}
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Show archived
        </label>
      </div>
      {error && <p className="text-sm text-error" role="alert">{error}</p>}

      {made && (
        <div className="bg-accent-tint border border-accent/20 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-text-primary font-medium">Campaign created. {made.codes.length === 1 ? 'The code:' : `${made.codes.length} codes — download them below or copy from here:`}</p>
          {made.codes.length === 1 ? (
            <div className="space-y-1">
              <p className="font-mono text-2xl text-accent">{made.codes[0]}</p>
              <p className="text-xs text-text-secondary">Sign-up link that fills it in: <span className="font-mono">{signupLink(made.codes[0])}</span></p>
            </div>
          ) : (
            <textarea readOnly value={made.codes.join('\n')} rows={6} className={`${field} font-mono`} />
          )}
          <div className="flex gap-3">
            <a href={`/api/admin/coupons/${made.id}`} className="text-sm text-accent hover:underline">Download CSV</a>
            <button type="button" onClick={() => setMade(null)} className="text-sm text-text-secondary hover:text-text-primary">Done</button>
          </div>
        </div>
      )}

      {creating && (
        <form onSubmit={create} className="bg-card border border-border rounded-2xl p-6 shadow-soft grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-text-secondary">Campaign name<input required value={form.name} onChange={set('name')} className={`${field} mt-1`} placeholder="Web Summit 2026" /></label>
          <label className="text-sm text-text-secondary">Organisation (who pays)<input value={form.organisation} onChange={set('organisation')} className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary">Codes
            <select value={form.mode} onChange={set('mode')} className={`${field} mt-1`}>
              <option value="shared">One shared code for everyone</option>
              <option value="individual">Individual single-use codes</option>
            </select>
          </label>
          <label className="text-sm text-text-secondary">Who may use it
            <select value={form.audience} onChange={set('audience')} className={`${field} mt-1`}>
              <option value="both">New and existing accounts</option>
              <option value="new">New accounts only</option>
              <option value="existing">Existing accounts only</option>
            </select>
          </label>
          <label className="text-sm text-text-secondary">Tier
            <select value={form.tier} onChange={set('tier')} className={`${field} mt-1`}>
              {PLAN_IDS.map(id => <option key={id} value={id}>{PLANS[id].name}{PLANS[id].feeEur ? ` (${formatEur(PLANS[id].feeEur)}/month)` : ''}</option>)}
            </select>
          </label>
          <label className="text-sm text-text-secondary">Free days<input type="number" min={1} max={365} required value={form.freeDays} onChange={set('freeDays')} className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary">AI credit per person (€)<input type="number" min={0} max={1000} step="0.5" required value={form.creditEur} onChange={set('creditEur')} className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary">{form.mode === 'shared' ? 'Seats (how many people)' : 'Number of codes'}<input type="number" min={1} max={10000} required value={form.seats} onChange={set('seats')} className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary">Use by (optional)<input type="date" value={form.expiresAt} onChange={set('expiresAt')} className={`${field} mt-1`} /></label>
          <label className="text-sm text-text-secondary">{form.mode === 'shared' ? 'Code (optional, else generated)' : 'Code prefix (optional)'}<input value={form.code} onChange={set('code')} className={`${field} mt-1 font-mono uppercase`} placeholder={form.mode === 'shared' ? 'WEBSUMMIT26' : 'WEBSUMMIT'} /></label>
          <label className="text-sm text-text-secondary md:col-span-2">Notes (only you see them)<textarea value={form.notes} onChange={set('notes')} rows={2} className={`${field} mt-1`} /></label>
          <p className="md:col-span-2 text-xs text-text-muted">
            Each person gets {PLANS[form.tier as keyof typeof PLANS]?.name ?? form.tier} free for {form.freeDays || '…'} days and €{form.creditEur || '0'} of AI credit; for {AUDIENCE[form.audience]}. Leftover credit expires when the period ends.
            {form.tier === 'butterfly' && ' Social Butterfly comes with its standard slider settings.'}
          </p>
          <div className="md:col-span-2 flex justify-end">
            <button type="submit" disabled={busy} className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-full shadow-soft disabled:opacity-50">Create Campaign</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {rows === null && !error && <p className="text-sm text-text-muted">Loading…</p>}
        {rows?.length === 0 && <p className="text-sm text-text-muted">{archived ? 'Nothing archived.' : 'No campaigns yet.'}</p>}
        {rows?.map(c => {
          const expired = !!c.expires_at && new Date(c.expires_at).getTime() < now
          const status = c.archived_at ? 'archived' : !c.active ? 'off' : expired ? 'past use-by date' : c.used >= c.seats ? 'full' : 'running'
          return (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-5 shadow-soft space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-xl text-text-primary">{c.name} <span className={`ml-2 align-middle rounded-full px-2 py-0.5 text-[11px] ${status === 'running' ? 'bg-success/10 text-success' : 'bg-accent-subtle text-text-secondary'}`}>{status}</span></h3>
                  <p className="text-sm text-text-secondary">{c.organisation ? `${c.organisation} · ` : ''}{PLANS[c.tier]?.name ?? c.tier} free for {c.free_days} days + {formatEur(c.credit_eur)} credit · {AUDIENCE[c.audience]}{c.expires_at ? ` · use by ${day(c.expires_at)}` : ''} · created {day(c.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-display text-text-primary tabular-nums">{c.used} / {c.seats}</p>
                  <p className="text-xs text-text-muted">{c.mode === 'shared' ? 'seats used' : 'codes used'}</p>
                </div>
              </div>
              {c.sharedCode && (
                <p className="text-sm"><span className="font-mono text-lg text-accent">{c.sharedCode}</span> <span className="text-xs text-text-muted ml-2 font-mono">{signupLink(c.sharedCode)}</span></p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-text-secondary">Participants used {formatEur(c.usageValueEur)} at user prices (cost to us {formatEur(c.usageCostEur)})</span>
                <span className="ml-auto flex flex-wrap gap-2">
                  <a href={`/api/admin/coupons/${c.id}`} className="rounded-full border border-border px-3 py-1 hover:border-accent">Download CSV</a>
                  {!c.archived_at && <button type="button" disabled={busy} onClick={() => patch(c.id, { active: !c.active })} className="rounded-full border border-border px-3 py-1 hover:border-accent disabled:opacity-50">{c.active ? 'Switch Off' : 'Switch On'}</button>}
                  <button type="button" disabled={busy} onClick={() => patch(c.id, { archived: !c.archived_at })} className="rounded-full border border-border px-3 py-1 hover:border-accent disabled:opacity-50">{c.archived_at ? 'Restore' : 'Archive'}</button>
                </span>
              </div>
              {c.notes && <p className="text-xs text-text-muted whitespace-pre-line">{c.notes}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
