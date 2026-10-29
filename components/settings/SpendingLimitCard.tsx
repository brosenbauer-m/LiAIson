'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUnsavedChanges } from '@/lib/unsaved'
import { CURRENCIES, CURRENCY_NAMES, formatMoney, isCurrency, type Currency } from '@/lib/currency'

type Usage = {
  messages: number
  costCents: number
  limitCents: number
  creditCents: number
  paused: boolean
  inTrial: boolean
  sponsoredUntil?: string | null
  periodEnd: string
  currency: Currency
  rate: number
}

// Settings card: this month's usage, the monthly spending limit, the display
// currency (billing stays in euros) and what the asterisks (*) mean.
export default function SpendingLimitCard({ bare = false }: { bare?: boolean } = {}) {
  const [supabase] = useState(() => createClient())
  const [usage, setUsage] = useState<Usage | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [limitInput, setLimitInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = () =>
    fetch('/api/usage', { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error('failed')
        const data = (await res.json()) as Usage
        setUsage(data)
        setLimitInput(String(Math.round(data.limitCents / 100)))
        setStatus('ok')
      })
      .catch(() => setStatus('error'))

  useEffect(() => { void load() }, [])

  const money = (cents: number) => formatMoney(cents / 100, usage?.currency ?? 'EUR', usage?.rate ?? 1)

  const handleSave = async (): Promise<boolean> => {
    const limitEuros = Number(limitInput)
    if (limitInput.trim() === '' || !Number.isInteger(limitEuros) || limitEuros < 0 || limitEuros > 500) {
      setMessage({ type: 'error', text: 'Please enter a whole number between 0 and 500.' })
      return false
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitEuros }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Could not save the limit.' })
        return false
      }
      setUsage(prev => (prev ? { ...prev, limitCents: data.limitCents, paused: prev.costCents >= data.limitCents + prev.creditCents } : prev))
      setMessage({ type: 'success', text: 'Saved ✓' })
      setTimeout(() => setMessage(null), 3000)
      window.dispatchEvent(new Event('liaison:usage-changed'))
      return true
    } catch {
      setMessage({ type: 'error', text: 'Could not save the limit.' })
      return false
    } finally {
      setSaving(false)
    }
  }

  useUnsavedChanges(!!usage && (limitInput.trim() === '' || Number(limitInput) !== Math.round(usage.limitCents / 100)), handleSave)

  const changeCurrency = async (value: string) => {
    if (!isCurrency(value)) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('users').update({ display_currency: value }).eq('id', user.id)
    if (error) {
      setMessage({ type: 'error', text: 'Could not change the currency.' })
      return
    }
    await load()
    window.dispatchEvent(new Event('liaison:usage-changed'))
  }

  const percent = usage && usage.limitCents > 0
    ? Math.min(100, Math.round((usage.costCents / usage.limitCents) * 100))
    : 100

  return (
    <div className={bare ? 'space-y-5' : 'bg-card border border-border rounded-2xl p-8 space-y-5 shadow-soft'}>
      <h2 className="font-semibold text-text-primary text-lg">Usage &amp; Spending Limit</h2>

      {status === 'loading' && <p className="text-sm text-text-secondary">Loading...</p>}
      {status === 'error' && <p className="text-sm text-error" role="alert">Could not load your usage right now.</p>}

      {status === 'ok' && usage && (
        <>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm text-text-secondary">This month</p>
              <p className="text-sm text-text-primary tabular-nums">
                {money(usage.costCents)} of {money(usage.limitCents)}
                {usage.creditCents > 0 && <span className="text-text-muted"> + {money(usage.creditCents)} credit</span>}
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-border overflow-hidden" aria-hidden="true">
              <div className={`h-full rounded-full ${usage.paused ? 'bg-error' : 'bg-accent'}`} style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-text-secondary">
              {usage.messages} {usage.messages === 1 ? 'message' : 'messages'} sent by you this month.
            </p>
          </div>

          {usage.paused && (
            <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-4 py-3" role="status">
              You&apos;ve reached your limit, so you can&apos;t send more messages until the 1st of next month. Raise the limit or add credit to keep chatting.
            </p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="spend-limit" className="block text-sm font-medium text-text-primary">Monthly limit (€)</label>
              <div className="flex gap-3">
                <input
                  id="spend-limit"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={500}
                  step={1}
                  value={limitInput}
                  onChange={e => setLimitInput(e.target.value)}
                  className="w-28 bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-5 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="display-currency" className="block text-sm font-medium text-text-primary">Show amounts in</label>
              <div className="relative max-w-[16rem]">
                <select
                  id="display-currency"
                  value={usage.currency}
                  onChange={e => changeCurrency(e.target.value)}
                  className="block w-full appearance-none bg-surface border border-border rounded-lg pl-4 pr-10 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c} · {CURRENCY_NAMES[c]}</option>)}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg>
              </div>
            </div>
          </div>
          {message && (
            <p className={message.type === 'error' ? 'text-sm text-error' : 'text-sm text-success'} role={message.type === 'error' ? 'alert' : 'status'}>
              {message.text}
            </p>
          )}
          {usage.currency !== 'EUR' && (
            <p className="text-xs text-text-muted">
              Shown in {usage.currency} at the European Central Bank&apos;s daily rate (updated every working day). You are always billed in euros.
            </p>
          )}

          <div className="space-y-2 text-xs text-text-secondary leading-relaxed">
            <p>
              You only pay for the messages you send to any LiAIson, including your own. Others chatting with your LiAIson never cost
              you anything. When this month&apos;s usage reaches your limit, you can&apos;t send more messages until the 1st of next
              month, until you raise the limit, or until credit is added.
              {usage.sponsoredUntil ? ' During your event period, your usage is paid from your event credit.' : usage.inTrial ? ' Payments aren’t switched on yet, so nothing is charged for now.' : ''}
            </p>
            <p>
              <span className="font-semibold text-text-primary">*</span> Buttons and features marked with an asterisk use AI and count
              towards your usage.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
