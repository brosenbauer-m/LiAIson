'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { EU_COUNTRIES } from '@/lib/billing/countries'

type Receipt = { receiptNumber: string; kind: 'topup' | 'monthly'; totalEur: number; paidAt: string }
type BalanceState = {
  balanceEur: number
  amounts: number[]
  receipts: Receipt[]
  billingCountry: string | null
  savedCard: string | null
}

function euros(n: number): string {
  return `€${n.toFixed(2)}`
}

// Settings card: prepaid credit. Top-ups are paid with the saved card (after a
// confirmation prompt) or on Mollie's checkout page, and are used first when
// the monthly bill is made.
export default function PrepaidBalanceCard() {
  const [state, setState] = useState<BalanceState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [country, setCountry] = useState('')
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const stoppedRef = useRef(false)

  const load = useCallback(async (): Promise<BalanceState | null> => {
    try {
      const res = await fetch('/api/billing/topup', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as BalanceState
      setState(data)
      setLoadError(false)
      return data
    } catch {
      setLoadError(true)
      return null
    }
  }, [])

  // Polls until a top-up receipt from the last `lookbackMs` shows up (max ~16 s).
  const waitForTopUp = useCallback((lookbackMs: number) => {
    let tries = 0
    let since = 0
    setChecking(true)
    const tick = async () => {
      if (stoppedRef.current) return
      tries += 1
      const data = await load()
      if (stoppedRef.current) return
      const latest = data?.receipts[0]
      const arrived = latest && latest.kind === 'topup' && new Date(latest.paidAt).getTime() >= since
      if (data && arrived) {
        setChecking(false)
        setMessage({ type: 'success', text: `Top-up received ✓ Your balance is ${euros(data.balanceEur)}.` })
        return
      }
      if (tries >= 8) {
        setChecking(false)
        setMessage({ type: 'error', text: 'We haven’t received this top-up yet. If you paid, it will show up shortly.' })
        return
      }
      setTimeout(tick, 2000)
    }
    setTimeout(() => {
      since = Date.now() - lookbackMs
      tick()
    }, 1000)
  }, [load])

  useEffect(() => {
    stoppedRef.current = false
    const returning = new URLSearchParams(window.location.search).get('topup') === 'return'
    const timer = setTimeout(() => {
      if (returning) {
        window.history.replaceState(null, '', '/settings')
        waitForTopUp(10 * 60 * 1000)
      } else {
        load()
      }
    }, 0)
    return () => {
      stoppedRef.current = true
      clearTimeout(timer)
    }
  }, [load, waitForTopUp])

  const startTopUp = async (amount: number, useSavedCard: boolean) => {
    setMessage(null)
    if (!state?.billingCountry && !country) {
      setMessage({ type: 'error', text: 'Please choose your country first.' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, useSavedCard, country: state?.billingCountry ? undefined : country }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Could not start the top-up.' })
        setBusy(false)
        return
      }
      if (useSavedCard) {
        setConfirmAmount(null)
        setBusy(false)
        waitForTopUp(15_000)
        return
      }
      if (!data.checkoutUrl) {
        setMessage({ type: 'error', text: 'Could not start the top-up.' })
        setBusy(false)
        return
      }
      window.location.assign(data.checkoutUrl)
    } catch {
      setMessage({ type: 'error', text: 'Could not start the top-up.' })
      setBusy(false)
    }
  }

  const handleAmount = (amount: number) => {
    setMessage(null)
    if (state?.savedCard) setConfirmAmount(amount)
    else startTopUp(amount, false)
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-8 space-y-5 shadow-soft">
      <h2 className="font-semibold text-text-primary text-lg">Prepaid balance</h2>

      {!state && !loadError && <p className="text-sm text-text-secondary">Loading...</p>}
      {loadError && !state && <p className="text-sm text-error" role="alert">Could not load your balance right now.</p>}

      {checking && <p className="text-sm text-text-secondary" role="status">Waiting for Mollie to confirm your top-up…</p>}

      {state && !checking && (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-text-secondary">Balance</p>
            <p className="text-2xl font-semibold text-text-primary tabular-nums">{euros(state.balanceEur)}</p>
          </div>

          {!state.billingCountry && (
            <div className="space-y-2">
              <label htmlFor="topup-country" className="text-sm font-medium text-text-primary">Country you live in</label>
              <select
                id="topup-country"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="min-w-[12rem] bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Choose…</option>
                {EU_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {confirmAmount !== null && state.savedCard ? (
            <div className="space-y-3 bg-surface border border-border rounded-lg p-4" role="dialog" aria-label="Confirm top-up">
              <p className="text-sm text-text-primary">
                Pay <span className="font-semibold">{euros(confirmAmount)}</span> with <span className="font-semibold">{state.savedCard}</span>?
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => startTopUp(confirmAmount, true)}
                  disabled={busy}
                  className="px-5 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {busy ? 'Paying…' : `Pay ${euros(confirmAmount)}`}
                </button>
                <button
                  type="button"
                  onClick={() => startTopUp(confirmAmount, false)}
                  disabled={busy}
                  className="px-5 py-2 border-2 border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  Use another payment method
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAmount(null)}
                  disabled={busy}
                  className="px-3 py-2 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Add credit</p>
              <div className="flex flex-wrap gap-3">
                {state.amounts.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => handleAmount(a)}
                    disabled={busy}
                    className="px-5 py-2 border-2 border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                  >
                    {`+ ${euros(a)}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.receipts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-text-primary">Recent receipts</p>
                <Link href="/billing/receipts" className="text-sm text-accent hover:underline">All receipts →</Link>
              </div>
              <ul className="divide-y divide-border border border-border rounded-lg">
                {state.receipts.map(r => (
                  <li key={r.receiptNumber}>
                    <Link
                      href={`/billing/receipts/${r.receiptNumber}`}
                      className="flex items-center justify-between gap-4 px-4 py-2 text-sm hover:bg-surface/60 transition-colors"
                    >
                      <span className="text-text-secondary">
                        {new Date(r.paidAt).toLocaleDateString()} · {r.kind === 'topup' ? 'Top-up' : 'Monthly bill'} · {r.receiptNumber}
                      </span>
                      <span className="text-text-primary tabular-nums">{euros(r.totalEur)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {message && (
        <p className={message.type === 'error' ? 'text-sm text-error' : 'text-sm text-success'} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}

      <p className="text-xs text-text-secondary leading-relaxed">
        Prepaid credit is used first for your monthly usage. Payments are handled by Mollie (Netherlands, EU).
        Payments are in test mode for now.
      </p>
    </div>
  )
}
