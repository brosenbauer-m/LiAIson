'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { EU_COUNTRIES } from '@/lib/billing/countries'

type Receipt = { receiptNumber: string; kind: 'topup' | 'monthly'; totalEur: number; paidAt: string }
type BalanceState = {
  balanceEur: number
  amounts: number[]
  min: number
  max: number
  receipts: Receipt[]
  billingCountry: string | null
  savedCard: string | null
}

function euros(n: number): string {
  return `€${n.toFixed(2)}`
}

// Settings card: Credit Balance (prepaid credit). Top-ups (a quick amount or
// any whole amount) are paid with the saved card (after a confirmation prompt)
// or on Mollie's checkout page, and are used first when the monthly bill is made.
export default function CreditBalanceCard({ bare = false }: { bare?: boolean } = {}) {
  const [state, setState] = useState<BalanceState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [country, setCountry] = useState('')
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null)
  const [custom, setCustom] = useState('')
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
    if (state && (!Number.isInteger(amount) || amount < state.min || amount > state.max)) {
      setMessage({ type: 'error', text: `Please enter a whole amount from €${state.min} to €${state.max}.` })
      return
    }
    if (state?.savedCard) setConfirmAmount(amount)
    else startTopUp(amount, false)
  }

  return (
    <div className={bare ? 'space-y-5' : 'bg-card border border-border rounded-2xl p-8 space-y-5 shadow-soft'}>
      <h2 className="font-semibold text-text-primary text-lg">Credit Balance</h2>

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
            <div>
              <label htmlFor="topup-country" className="block text-sm font-medium text-text-primary mb-1.5">Country you live in</label>
              <div className="relative max-w-xs">
                <select
                  id="topup-country"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  className="block w-full appearance-none bg-surface border border-border rounded-lg pl-4 pr-10 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Choose…</option>
                  {EU_COUNTRIES.map(c => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  <path d="m3 4.5 3 3 3-3" />
                </svg>
              </div>
            </div>
          )}

          {confirmAmount !== null && state.savedCard ? (
            <div className="space-y-3 bg-surface border border-border rounded-lg p-4" role="dialog" aria-label="Confirm Top-Up">
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
                  Use Another Payment Method
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
              <div className="flex flex-wrap items-center gap-3">
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
                <form
                  className="flex items-center gap-2"
                  onSubmit={e => { e.preventDefault(); if (custom) handleAmount(Number(custom)) }}
                >
                  <label className="relative">
                    <span className="sr-only">Other amount in euros</span>
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">€</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={state.min}
                      max={state.max}
                      step={1}
                      value={custom}
                      onChange={e => setCustom(e.target.value)}
                      placeholder="Other"
                      className="w-28 bg-surface border-2 border-border rounded-lg pl-7 pr-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy || !custom}
                    className="px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    Add
                  </button>
                </form>
              </div>
              <p className="text-xs text-text-muted">Any whole amount from €{state.min} to €{state.max}.</p>
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
        Your credit is used first for your monthly usage. Payments are handled by Mollie (Netherlands, EU).
        Payments are in test mode for now.
      </p>
    </div>
  )
}
