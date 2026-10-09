'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { EU_COUNTRIES } from '@/lib/billing/countries'

type CardState = {
  status: 'none' | 'pending' | 'valid' | 'invalid'
  cardLabel: string | null
  billingCountry: string | null
}

// Settings card: the saved card used for monthly usage charges (Mollie).
// Adding a card runs a €0 check on Mollie's secure page; nothing is charged.
// returnPath: the page Mollie sends the person back to after the card check.
// onSaved: called once the card is confirmed.
export default function PaymentMethodCard({ returnPath = '/settings', onSaved }: { returnPath?: '/settings' | '/billing/setup'; onSaved?: () => void } = {}) {
  const onSavedRef = useRef(onSaved)
  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])
  const [card, setCard] = useState<CardState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [country, setCountry] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async (): Promise<CardState | null> => {
    try {
      const res = await fetch('/api/billing/card', { cache: 'no-store' })
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as CardState
      setCard(data)
      setLoadError(false)
      if (data.billingCountry) setCountry(prev => prev || data.billingCountry || '')
      return data
    } catch {
      setLoadError(true)
      return null
    }
  }, [])

  useEffect(() => {
    const returning = new URLSearchParams(window.location.search).get('card') === 'return'
    let stopped = false
    let tries = 0
    // Back from Mollie: poll for a few seconds until the result is confirmed.
    const tick = async () => {
      if (stopped) return
      tries += 1
      if (tries === 1) setChecking(true)
      const data = await load()
      if (stopped) return
      if (data && data.status !== 'pending' && tries > 1) {
        setChecking(false)
        if (data.status === 'valid') {
          setMessage({ type: 'success', text: 'Your card is saved ✓' })
          onSavedRef.current?.()
        } else setMessage({ type: 'error', text: 'The card check didn’t go through. You can try again.' })
        window.history.replaceState(null, '', returnPath)
        return
      }
      if (tries >= 8) {
        setChecking(false)
        window.history.replaceState(null, '', returnPath)
        return
      }
      setTimeout(tick, 2000)
    }
    const timer = setTimeout(returning ? tick : load, 0)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [load, returnPath])

  const handleAdd = async () => {
    setMessage(null)
    if (!country) {
      setMessage({ type: 'error', text: 'Please choose your country first.' })
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/billing/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country, returnTo: returnPath }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.checkoutUrl) {
        setMessage({ type: 'error', text: data.error ?? 'Could not start the card check.' })
        setBusy(false)
        return
      }
      window.location.href = data.checkoutUrl
    } catch {
      setMessage({ type: 'error', text: 'Could not start the card check.' })
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!window.confirm('Remove your saved card?')) return
    setMessage(null)
    setBusy(true)
    try {
      const res = await fetch('/api/billing/card', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Could not remove your card.' })
      } else {
        setCard(data as CardState)
        setMessage({ type: 'success', text: 'Card removed.' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not remove your card.' })
    } finally {
      setBusy(false)
    }
  }

  const hasCard = card?.status === 'valid' && !!card.cardLabel

  return (
    <div className="bg-card border border-border rounded-2xl p-8 space-y-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-text-primary text-lg">Payment method</h2>
        <Link href="/billing/receipts" className="text-sm text-accent hover:underline">View receipts →</Link>
      </div>

      {!card && !loadError && <p className="text-sm text-text-secondary">Loading...</p>}
      {loadError && !card && <p className="text-sm text-error" role="alert">Could not load your payment method right now.</p>}

      {checking && (
        <p className="text-sm text-text-secondary" role="status">Checking your card with Mollie…</p>
      )}

      {card && !checking && (
        <>
          {hasCard ? (
            <div className="flex items-center justify-between gap-4 bg-surface border border-border rounded-lg px-4 py-3">
              <p className="text-sm text-text-primary font-medium">{card.cardLabel}</p>
              <button
                type="button"
                onClick={handleRemove}
                disabled={busy}
                className="text-sm text-text-secondary hover:text-error transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">No card saved yet.</p>
          )}

          <div className="space-y-2">
            <label htmlFor="billing-country" className="text-sm font-medium text-text-primary">Country you live in</label>
            <div className="flex flex-wrap gap-3">
              <select
                id="billing-country"
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="min-w-[12rem] bg-surface border border-border rounded-lg px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                <option value="">Choose…</option>
                {EU_COUNTRIES.map(c => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAdd}
                disabled={busy}
                className="px-5 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
              >
                {busy ? 'Please wait…' : hasCard ? 'Replace card' : 'Add a card'}
              </button>
            </div>
          </div>
        </>
      )}

      {message && (
        <p className={message.type === 'error' ? 'text-sm text-error' : 'text-sm text-success'} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}

      <p className="text-xs text-text-secondary leading-relaxed">
        Your card is checked and saved securely by Mollie (Netherlands, EU) — nothing is charged now, and LiAIson never sees your card number.
        Later, your usage is charged once at the end of the month, and only when it adds up to €5 or more; smaller amounts carry over.
        Payments aren&apos;t switched on yet.
      </p>
    </div>
  )
}
