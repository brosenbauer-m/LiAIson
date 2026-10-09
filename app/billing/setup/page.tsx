'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import PaymentMethodCard from '@/components/settings/PaymentMethodCard'
import PlanFeatures from '@/components/plans/PlanFeatures'
import { PLANS, PLAN_IDS, type PlanId } from '@/lib/plans'

type PlanState = {
  plan: PlanId
  exempt: boolean
  inTrial: boolean
  hasCard: boolean
  vaultChars: number
}

// After the free month: the person adds a card to keep using LiAIson, and can
// change their plan first. The app pages send people here until a card is saved
// (proxy.ts + lib/billing/access.ts).
export default function BillingSetupPage() {
  const [state, setState] = useState<PlanState | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [error, setError] = useState('')
  const [cardSaved, setCardSaved] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/plan', { cache: 'no-store' }).catch(() => null)
    if (res?.status === 401) { setSignedOut(true); return }
    if (res?.ok) setState((await res.json()) as PlanState)
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const choose = async (plan: PlanId) => {
    setError('')
    setBusy(plan)
    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    if (!res?.ok) setError(data.error ?? 'Could not change your plan. Please try again.')
    else if (data.state) setState(data.state as PlanState)
    setBusy(null)
  }

  const onSaved = useCallback(() => setCardSaved(true), [])
  const done = cardSaved || state?.hasCard || state?.exempt || state?.inTrial

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">
            {done ? 'You’re all set' : 'Your free month has ended'}
          </h1>
          <p className="text-text-secondary mt-3 leading-relaxed">
            {done
              ? 'You can keep using LiAIson as before.'
              : 'To keep using LiAIson, please save a card. You can also change your plan first. Your plan fee and the messages you send are charged once at the end of each month.'}
          </p>
          {done && (
            <Link href="/dashboard" className="inline-block mt-5 px-6 py-3 bg-accent hover:bg-accent-light text-white font-medium rounded-lg shadow-soft">
              Continue to LiAIson
            </Link>
          )}
        </div>

        {signedOut && (
          <p className="text-text-secondary">
            Please <Link href="/login?redirect=/billing/setup" className="text-accent hover:underline">log in</Link> first.
          </p>
        )}

        {state && !state.exempt && (
          <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
            <h2 className="font-semibold text-text-primary text-lg">Your plan</h2>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_IDS.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => id !== state.plan && choose(id)}
                  disabled={busy !== null}
                  aria-pressed={id === state.plan}
                  className={`rounded-lg border px-3 py-2.5 text-center transition-all disabled:opacity-60 ${
                    id === state.plan ? 'border-accent bg-accent-tint' : 'border-border bg-surface hover:border-accent/60'
                  }`}
                >
                  <span className="block text-sm font-medium text-text-primary">{PLANS[id].name}</span>
                  <span className="block text-xs text-text-secondary">
                    {busy === id ? 'Please wait…' : PLANS[id].feeEur === 0 ? 'Free' : `€${PLANS[id].feeEur}/month`}
                  </span>
                </button>
              ))}
            </div>
            <PlanFeatures plan={PLANS[state.plan]} />
            {error && <p className="text-sm text-error" role="alert">{error}</p>}
          </div>
        )}

        {state && !state.exempt && (
          <PaymentMethodCard returnPath="/billing/setup" onSaved={onSaved} />
        )}
      </div>
    </div>
  )
}
