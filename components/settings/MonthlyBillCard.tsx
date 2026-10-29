'use client'

import { useCallback, useEffect, useState } from 'react'

type Summary = {
  monthToDateEur: number
  planFeeEur: number
  planName: string | null
  chargeDate: string
  minChargeEur: number
  exempt: boolean
  inTrial: boolean
  sponsoredUntil?: string | null
  trialEndsAt: string | null
  unpaid: { id: number; totalEur: number } | null
}

function euros(n: number): string {
  return `€${n.toFixed(2)}`
}

// Settings card: this month's bill so far and unpaid bills ("Pay now").
export default function MonthlyBillCard({ bare = false }: { bare?: boolean } = {}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
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

  const chargeDay = summary
    ? new Date(summary.chargeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/Vienna' })
    : ''

  return (
    <div className={bare ? 'space-y-5' : 'bg-card border border-border rounded-2xl p-8 space-y-5 shadow-soft'}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-text-primary text-lg">Monthly Bill</h2>
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
                {busy ? 'Please wait…' : `Pay ${euros(summary.unpaid.totalEur)} Now`}
              </button>
            </div>
          )}

          {summary.exempt ? (
            <p className="text-sm text-text-secondary">Your account is not billed.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-sm text-text-secondary">Messages you sent this month</p>
                <p className="text-2xl font-semibold text-text-primary tabular-nums">{euros(summary.monthToDateEur)}</p>
              </div>
              {summary.planFeeEur > 0 && (
                <div className="flex items-baseline justify-between gap-4">
                  <p className="text-sm text-text-secondary">{summary.planName} plan this month</p>
                  <p className="text-sm font-medium text-text-primary tabular-nums">{euros(summary.planFeeEur)}</p>
                </div>
              )}
              <p className="text-xs text-text-secondary leading-relaxed">
                Charged once on {chargeDay} if it&apos;s {euros(summary.minChargeEur)} or more (after your credit balance); smaller amounts carry over.
                {summary.inTrial && !summary.sponsoredUntil ? ' During your free month, you can send up to 5 free messages a day.' : ''}
                {summary.sponsoredUntil ? ` Until ${new Date(summary.sponsoredUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })} your messages are paid from your event credit; whatever is left of it then expires.` : ''}
              </p>
              {summary.inTrial && summary.trialEndsAt && (
                <p className="text-xs text-text-secondary leading-relaxed">
                  Your free month ends on {new Date(summary.trialEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })}. After that, you need a saved payment method (below) to keep sending messages.
                </p>
              )}
            </>
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
