'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PLANS, formatChars, type PlanId } from '@/lib/plans'

type PlanState = {
  plan: PlanId
  pendingPlan: PlanId | null
  pendingFrom: string | null
  exempt: boolean
  inTrial: boolean
  trialEndsAt: string
  vaultChars: number
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })
}

// Settings card: current plan, Vault space used and any scheduled change.
export default function PlanCard() {
  const [state, setState] = useState<PlanState | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/plan', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((d: PlanState) => setState(d))
      .catch(() => setError(true))
  }, [])

  const plan = state ? PLANS[state.plan] : null
  const used = state && plan ? Math.min(100, Math.round((state.vaultChars / plan.vaultChars) * 100)) : 0

  return (
    <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-text-primary text-lg">Your plan</h2>
        <Link href="/plans" className="text-sm text-accent hover:underline">Change plan →</Link>
      </div>

      {!state && !error && <p className="text-sm text-text-secondary">Loading...</p>}
      {error && !state && <p className="text-sm text-error" role="alert">Could not load your plan right now.</p>}

      {state && plan && (
        <>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-2xl font-semibold text-text-primary">{plan.name}</p>
            <p className="text-sm text-text-secondary">
              {state.exempt ? 'Not billed' : plan.feeEur === 0 ? 'Free' : `€${plan.feeEur} / month`}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Vault</span>
              <span className="tabular-nums">{formatChars(state.vaultChars)} / {formatChars(plan.vaultChars)} characters</span>
            </div>
            <div className="h-2 bg-surface rounded-full overflow-hidden" aria-hidden="true">
              <div className={`h-full ${used >= 100 ? 'bg-error' : 'bg-accent'}`} style={{ width: `${used}%` }} />
            </div>
          </div>

          {state.pendingPlan && state.pendingFrom && (
            <p className="text-sm text-text-secondary">
              You&apos;ll move to {PLANS[state.pendingPlan].name} on {formatDay(state.pendingFrom)}.
            </p>
          )}
          {!state.exempt && state.inTrial && (
            <p className="text-xs text-text-secondary leading-relaxed">
              Free until {formatDay(state.trialEndsAt)}. After that, {plan.feeEur > 0 ? `€${plan.feeEur} per month is charged at the end of each month with your messages, and ` : ''}you need a saved card (below) to keep using LiAIson.
            </p>
          )}
        </>
      )}
    </div>
  )
}
