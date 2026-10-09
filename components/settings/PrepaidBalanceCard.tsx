'use client'

import { useCallback, useEffect, useState } from 'react'
import { EU_COUNTRIES } from '@/lib/billing/countries'

type Receipt = { receiptNumber: string; kind: 'topup' | 'monthly'; totalEur: number; paidAt: string }
type BalanceState = {
  balanceEur: number
  amounts: number[]
  receipts: Receipt[]
  billingCountry: string | null
}

function euros(n: number): string {
  return `€${n.toFixed(2)}`
}

// Settings card: prepaid credit. Top-ups are paid on Mollie's checkout page and
// used first when the monthly bill is made.
export default function PrepaidBalanceCard() {
  const [state, setState] = useState<BalanceState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [country, setCountry] = useState('')
  const [busyAmount, setBusyAmount] = useState<number | null>(null)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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

  useEffect(() => {
    const returning = new URLSearchParams(window.location.search).get('topup') === 'return'
    let stopped = false
    let tries = 0
    // Back from Mollie: poll until the new credit shows up (max ~16 s).
    const tick = async () => {
      if (stopped) return
      tries += 1
      if (tries === 1) setChecking(true)
      const data = await load()
      if (stopped) return
      const latest = data?.receipts[0]
      const fresh = latest && latest.kind === 'topup' && Date.now() - new Date(latest.paidAt).getTime() < 10 * 60 * 1000
      if (data && tries > 1 && fresh) {
        setChecking(false)
        setMessage({ type: 'success', text: `Top-up received ✓ Your balance is ${euros(data.balanceEur)}.` })
        window.history.replaceState(null, '', '/settings')
        return
      }
      if (tries >= 8) {
        setChecking(false)
        setMessage({ type: 'error', text: 'We haven’t received this top-up yet. If you paid, it will show up shortly.' })
        window.history.replaceState(null, '', '/settings')
        return
      }
      setTimeout(tick, 2000)
    }
    const timer = setTimeout(returning ? tick : load, 0)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [load])

  const handleTopUp = async (amount: number) => {
    setMessage(null)
    if (!state?.billingCountry && !country) {
      setMessage({ type: 'error', text: 'Please choose your country first.' })
      return
    }
    setBusyAmount(amount)
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, country: state?.billingCountry ? undefined : country }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.checkoutUrl) {
        setMessage({ type: 'error', text: data.error ?? 'Could not start the top-up.' })
        setBusyAmount(null)
        return
      }
      window.location.assign(data.checkoutUrl)
    } catch {
      setMessage({ type: 'error', text: 'Could not start the top-up.' })
      setBusyAmount(null)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
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

          <div className="space-y-2">
            <p className="text-sm font-medium text-text-primary">Add credit</p>
            <div className="flex flex-wrap gap-3">
              {state.amounts.map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => handleTopUp(a)}
                  disabled={busyAmount !== null}
                  className="px-5 py-2 border-2 border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg transition-all disabled:opacity-50"
                >
                  {busyAmount === a ? 'Please wait…' : `+ ${euros(a)}`}
                </button>
              ))}
            </div>
          </div>

          {state.receipts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Recent receipts</p>
              <ul className="divide-y divide-border border border-border rounded-lg">
                {state.receipts.map(r => (
                  <li key={r.receiptNumber} className="flex items-center justify-between gap-4 px-4 py-2 text-sm">
                    <span className="text-text-secondary">
                      {new Date(r.paidAt).toLocaleDateString()} · {r.kind === 'topup' ? 'Top-up' : 'Monthly bill'} · {r.receiptNumber}
                    </span>
                    <span className="text-text-primary tabular-nums">{euros(r.totalEur)}</span>
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
        Prepaid credit is used first for your monthly usage. You pay on Mollie&apos;s secure page (Netherlands, EU).
        Payments are in test mode for now.
      </p>
    </div>
  )
}
