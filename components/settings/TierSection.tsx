'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import TierPicker, { feeOfChoice, type TierChoice } from '@/components/plans/TierPicker'
import {
  PLANS,
  BUTTERFLY_SLIDERS,
  DEFAULT_PLAN_OPTIONS,
  SLIDER_KEYS,
  formatChars,
  formatEur,
  samePlanOptions,
  type PlanId,
  type PlanOptions,
} from '@/lib/plans'

// Settings → Subscription → Tier: current tier, Vault space, and changing the
// tier (rules in lib/billing/plan.ts: more = now, less = next month).
type PlanState = {
  plan: PlanId
  options: PlanOptions | null
  feeEur: number
  pendingPlan: PlanId | null
  pendingFeeEur: number | null
  pendingFrom: string | null
  exempt: boolean
  inTrial: boolean
  trialEndsAt: string
  vaultChars: number
  vaultLimit: number
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })
}

export default function TierSection() {
  const [state, setState] = useState<PlanState | null>(null)
  const [error, setError] = useState('')
  const [changing, setChanging] = useState(false)
  const [choice, setChoice] = useState<TierChoice>({ plan: 'introvert', options: DEFAULT_PLAN_OPTIONS })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; needsCard?: boolean } | null>(null)

  const apply = useCallback((s: PlanState) => {
    setState(s)
    setChoice({ plan: s.plan, options: s.options ?? DEFAULT_PLAN_OPTIONS })
  }, [])

  useEffect(() => {
    fetch('/api/plan', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((s: PlanState) => apply(s))
      .catch(() => setError('Could not load your tier right now.'))
  }, [apply])

  const unchanged = !!state && choice.plan === state.plan && (choice.plan !== 'butterfly' || samePlanOptions(choice.options, state.options))
  // With a scheduled change, choosing the current tier again keeps it.
  const keep = unchanged && !!state?.pendingPlan

  const confirm = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(choice.plan === 'butterfly' ? { plan: choice.plan, options: choice.options } : { plan: choice.plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Could not change your tier.', needsCard: !!data.needsCard })
        return
      }
      setMessage({ type: 'success', text: data.message })
      if (data.state) apply(data.state as PlanState)
      setChanging(false)
    } catch {
      setMessage({ type: 'error', text: 'Could not change your tier.' })
    } finally {
      setBusy(false)
    }
  }

  if (!state) {
    return <p className={`text-sm ${error ? 'text-error' : 'text-text-secondary'}`}>{error || 'Loading...'}</p>
  }

  const plan = PLANS[state.plan]
  const used = Math.min(100, Math.round((state.vaultChars / Math.max(1, state.vaultLimit)) * 100))

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold text-text-primary text-lg">Tier</h3>
        <p className="text-sm text-text-secondary">
          {state.exempt ? 'Not billed' : state.feeEur === 0 ? 'Free' : `${formatEur(state.feeEur)} / month`}
        </p>
      </div>
      <p className="font-display text-3xl text-text-primary">{plan.name}</p>

      {state.options && (
        <ul className="text-sm text-text-secondary space-y-0.5">
          {SLIDER_KEYS.map(key => (
            <li key={key} className="flex justify-between gap-4">
              <span>{BUTTERFLY_SLIDERS[key].label}</span>
              <span className="tabular-nums text-text-primary">{state.options![key].toLocaleString('en-GB')}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-text-secondary">
          <span>Vault</span>
          <span className="tabular-nums">{formatChars(state.vaultChars)} / {formatChars(state.vaultLimit)} characters</span>
        </div>
        <div className="h-2 bg-accent-subtle rounded-full overflow-hidden" aria-hidden="true">
          <div className={`h-full rounded-full ${used >= 100 ? 'bg-error' : 'bg-accent'}`} style={{ width: `${used}%` }} />
        </div>
      </div>

      {state.pendingPlan && state.pendingFrom && (
        <p className="text-sm text-text-secondary">
          {state.pendingPlan === state.plan
            ? `Your new choices start on ${formatDay(state.pendingFrom)}.`
            : `You'll move to ${PLANS[state.pendingPlan].name} on ${formatDay(state.pendingFrom)}.`}
        </p>
      )}
      {!state.exempt && state.inTrial && (
        <p className="text-xs text-text-secondary leading-relaxed">
          Free until {formatDay(state.trialEndsAt)}. After that, you need a saved card (below) to keep using LiAIson
          {state.feeEur > 0 ? `, and ${formatEur(state.feeEur)} per month is charged at the end of each month with your messages` : ''}.
        </p>
      )}

      {!state.exempt && (
        changing ? (
          <div className="space-y-3">
            <TierPicker value={choice} onChange={setChoice} current={state.plan} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirm}
                disabled={busy || (unchanged && !keep)}
                className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg disabled:opacity-50"
              >
                {busy ? 'Please wait…' : keep ? 'Keep current tier' : unchanged ? 'Choose a different tier' : `Confirm · ${feeOfChoice(choice) === 0 ? 'Free' : `${formatEur(feeOfChoice(choice))}/month`}`}
              </button>
              <button
                type="button"
                onClick={() => { setChanging(false); apply(state) }}
                className="px-4 py-2.5 border border-border text-text-primary text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-text-muted">More takes effect right away. Less starts at the beginning of next month.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setMessage(null); setChanging(true) }}
            className="w-full px-4 py-2.5 border border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg"
          >
            {state.pendingPlan ? 'Change or keep tier' : 'Change tier'}
          </button>
        )
      )}

      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-error' : 'text-success'}`} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}{' '}
          {message.needsCard && <Link href="#payment" className="text-accent hover:underline font-medium">Add a card below</Link>}
        </p>
      )}
    </div>
  )
}
