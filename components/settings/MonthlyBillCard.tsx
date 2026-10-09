'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Summary = {
  monthToDateEur: number
  chargeDate: string
  minChargeEur: number
  exempt: boolean
  inTrial: boolean
  trialEndsAt: string | null
  unpaid: { id: number; totalEur: number } | null
  testRunAvailable: boolean
}

function euros(n: number): string {
  return `€${n.toFixed(2)}`
}

const TEST_RESULTS: Record<string, string> = {
  nothing: 'Nothing to bill.',
  exists: 'A test bill for this month already exists — see your receipts.',
  carried_over: 'Below €5 — carried over to next month.',
  paid_from_credit: 'Paid entirely from prepaid credit ✓',
  charging: 'Charging your saved card… check your receipts in a moment.',
  paid: 'Charged to your saved card ✓',
  failed: 'Charge failed — the bill is now unpaid (see above).',
}

// Settings card: this month's bill so far, unpaid bills ("Pay now") and, for the
// owner in Mollie test mode only, a button to run a test bill.
export default function MonthlyBillCard() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [extra, setExtra] = useState('20')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/summary', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      setSummary((await res.json()) as Summary)
      setLoadError(false)
    } catch {
      setLoadError(true)
    }
  }, [])

  useEffect(() => {
    const returning = new URLSearchParams(window.location.search).get('bill') === 'return'
    const timer = setTimeout(() => {
      if (returning) window.history.replaceState(null, '', '/settings')
      load()
      if (returning) setTimeout(load, 4000)
    }, 0)
    return () => clearTimeout(timer)
  }, [load])

  const payNow = async () => {
    setMessage(null)
    setBusy(true)
    try {
      const res = await fetch('/api/billing/pay', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.checkoutUrl) {
        setMessage({ type: 'error', text: data.error ?? 'Could not start the payment.' })
        setBusy(false)
        return
      }
      window.location.assign(data.checkoutUrl)
    } catch {
      setMessage({ type: 'error', text: 'Could not start the payment.' })
      setBusy(false)
    }
  }

  const testRun = async () => {
    setMessage(null)
    setBusy(true)
    try {
      const res = await fetch('/api/billing/test-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extraUsageEur: Number(extra) || 0 }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMessage({ type: 'error', text: data.error ?? 'Test run failed.' })
      else setMessage({ type: data.result === 'failed' ? 'error' : 'success', text: TEST_RESULTS[data.result] ?? String(data.result) })
      await load()
    } catch {
      setMessage({ type: 'error', text: 'Test run failed.' })
    } finally {
      setBusy(false)
    }
  }

  const chargeDay = summary
    ? new Date(summary.chargeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/Vienna' })
    : ''

  return (
    <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-text-primary text-lg">Monthly bill</h2>
        <Link href="/billing/receipts" className="text-sm text-accent hover:underline">Receipts →</Link>
      </div>

      {!summary && !loadError && <p className="text-sm text-text-secondary">Loading...</p>}
      {loadError && !summary && <p className="text-sm text-error" role="alert">Could not load your bill right now.</p>}

      {summary && (
        <>
          {summary.unpaid && (
            <div className="space-y-3 bg-error/10 border border-error/20 rounded-lg px-4 py-3" role="alert">
              <p className="text-sm text-error">
                You have an unpaid bill of <span className="font-semibold">{euros(summary.unpaid.totalEur)}</span>. You can&apos;t send messages until it is paid.
              </p>
              <button
                type="button"
                onClick={payNow}
                disabled={busy}
                className="px-5 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {busy ? 'Please wait…' : `Pay ${euros(summary.unpaid.totalEur)} now`}
              </button>
            </div>
          )}

          {summary.exempt ? (
            <p className="text-sm text-text-secondary">Your account is not billed.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm text-text-secondary">This month so far</p>
                <p className="text-2xl font-semibold text-text-primary tabular-nums">{euros(summary.monthToDateEur)}</p>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                Charged once on {chargeDay} if it&apos;s {euros(summary.minChargeEur)} or more (after your prepaid credit); smaller amounts carry over.
                {summary.inTrial ? ' Messages during your free month are free (up to 5 per day) and not billed.' : ''}
              </p>
              {summary.inTrial && summary.trialEndsAt && (
                <p className="text-xs text-text-secondary leading-relaxed">
                  Your free month ends on {new Date(summary.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })}. After that, you need a saved payment method (below) to keep sending messages.
                </p>
              )}
            </>
          )}

          {summary.testRunAvailable && (
            <div className="space-y-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-text-primary">Owner test (test mode only)</p>
              <p className="text-xs text-text-secondary">Runs this month&apos;s bill now for your account, plus pretend usage, using your test card and prepaid credit.</p>
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="extra-usage" className="text-xs text-text-secondary">Pretend usage €</label>
                <input
                  id="extra-usage"
                  type="number"
                  min={0}
                  max={50}
                  value={extra}
                  onChange={e => setExtra(e.target.value)}
                  className="w-24 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={testRun}
                  disabled={busy}
                  className="px-4 py-1.5 border-2 border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {busy ? 'Running…' : 'Run test bill'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {message && (
        <p className={message.type === 'error' ? 'text-sm text-error' : 'text-sm text-success'} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </div>
  )
}
