'use client'

import { useEffect, useState } from 'react'

type Usage = {
  messages: number
  costCents: number
  limitCents: number
  paused: boolean
  periodEnd: string
}

function euros(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`
}

// Settings card: this month's AI usage of your LiAIson and your monthly
// spending limit (pay-as-you-go foundation; no payments are taken yet).
export default function SpendingLimitCard() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [limitInput, setLimitInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/usage', { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error('failed')
        const data = (await res.json()) as Usage
        setUsage(data)
        setLimitInput(String(Math.round(data.limitCents / 100)))
        setStatus('ok')
      })
      .catch(() => setStatus('error'))
  }, [])

  const handleSave = async () => {
    const limitEuros = Number(limitInput)
    if (!Number.isInteger(limitEuros) || limitEuros < 0 || limitEuros > 500) {
      setMessage({ type: 'error', text: 'Please enter a whole number between 0 and 500.' })
      return
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
        return
      }
      setUsage(prev => (prev ? { ...prev, limitCents: data.limitCents, paused: prev.costCents >= data.limitCents } : prev))
      setMessage({ type: 'success', text: 'Saved ✓' })
      setTimeout(() => setMessage(null), 3000)
    } catch {
      setMessage({ type: 'error', text: 'Could not save the limit.' })
    } finally {
      setSaving(false)
    }
  }

  const percent = usage && usage.limitCents > 0
    ? Math.min(100, Math.round((usage.costCents / usage.limitCents) * 100))
    : 100

  return (
    <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
      <h2 className="font-semibold text-text-primary text-lg">Usage &amp; spending limit</h2>

      {status === 'loading' && <p className="text-sm text-text-secondary">Loading...</p>}
      {status === 'error' && <p className="text-sm text-error" role="alert">Could not load your usage right now.</p>}

      {status === 'ok' && usage && (
        <>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm text-text-secondary">This month</p>
              <p className="text-sm text-text-primary tabular-nums">
                {euros(usage.costCents)} of {euros(usage.limitCents)}
              </p>
            </div>
            <div className="h-2 w-full rounded-full bg-border overflow-hidden" aria-hidden="true">
              <div
                className={`h-full rounded-full ${usage.paused ? 'bg-error' : 'bg-accent'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-xs text-text-secondary">
              {usage.messages} {usage.messages === 1 ? 'message' : 'messages'} answered by your LiAIson this month.
            </p>
          </div>

          {usage.paused && (
            <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-4 py-3" role="status">
              Your LiAIson has reached its limit and is paused for visitors until the 1st of next month. Raise the limit to turn it back on.
            </p>
          )}

          <div className="space-y-2">
            <label htmlFor="spend-limit" className="text-sm font-medium text-text-primary">Monthly limit (€)</label>
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
                className="w-32 bg-surface border border-border rounded-lg px-4 py-2 text-text-primary focus:outline-none focus:border-accent"
              />
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {message && (
              <p className={message.type === 'error' ? 'text-sm text-error' : 'text-sm text-success'} role={message.type === 'error' ? 'alert' : 'status'}>
                {message.text}
              </p>
            )}
          </div>

          <p className="text-xs text-text-secondary leading-relaxed">
            You pay for the AI your LiAIson uses when people chat with it. When this month&apos;s usage reaches your limit, your LiAIson pauses for visitors until the 1st of next month or until you raise the limit. Payments aren&apos;t switched on yet, so nothing is charged for now.
          </p>
        </>
      )}
    </div>
  )
}
