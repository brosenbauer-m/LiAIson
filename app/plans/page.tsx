'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  PLANS,
  PLAN_IDS,
  FEATURE_HELP,
  DEFAULT_PLAN_OPTIONS,
  butterflyFeeEur,
  formatEur,
  samePlanOptions,
  type PlanId,
  type PlanOptions,
} from '@/lib/plans'
import PlanFeatures from '@/components/plans/PlanFeatures'
import PlanSliders from '@/components/plans/PlanSliders'

type PlanState = {
  plan: PlanId
  options: PlanOptions | null
  feeEur: number
  pendingPlan: PlanId | null
  pendingFrom: string | null
  exempt: boolean
  inTrial: boolean
  trialEndsAt: string
  hasCard: boolean
  vaultChars: number
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/Vienna' })
}

// Plans page: compare plans, "Learn more" texts, and change plan when signed in.
export default function PlansPage() {
  const [state, setState] = useState<PlanState | null>(null)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [confirm, setConfirm] = useState<PlanId | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; needsCard?: boolean } | null>(null)
  // Social Butterfly slider choices shown on its card.
  const [sliders, setSliders] = useState<PlanOptions>(DEFAULT_PLAN_OPTIONS)
  const feeFor = (id: PlanId) => (id === 'butterfly' ? butterflyFeeEur(sliders) : PLANS[id].feeEur)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/plan', { cache: 'no-store' })
      if (res.status === 401) {
        setSignedIn(false)
        return
      }
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as PlanState
      setState(data)
      if (data.options) setSliders(data.options)
      setSignedIn(true)
    } catch {
      setSignedIn(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(load, 0)
    return () => clearTimeout(timer)
  }, [load])

  const choose = async (plan: PlanId) => {
    setConfirm(null)
    setMessage(null)
    setBusy(plan)
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plan === 'butterfly' ? { plan, options: sliders } : { plan }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Could not change your plan.', needsCard: !!data.needsCard })
      } else {
        setMessage({ type: 'success', text: data.message })
        if (data.state) {
          setState(data.state as PlanState)
          if ((data.state as PlanState).options) setSliders((data.state as PlanState).options as PlanOptions)
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Could not change your plan.' })
    } finally {
      setBusy(null)
    }
  }

  const buttonFor = (id: PlanId) => {
    const plan = PLANS[id]
    const isCurrent = state?.plan === id && !state.exempt
    if (!plan.available && !isCurrent) {
      return <p className="text-center text-sm font-medium text-text-secondary py-2.5">Coming soon</p>
    }
    if (signedIn === false) {
      return (
        <Link
          href={`/signup?plan=${id}`}
          className="block text-center px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft"
        >
          Start your free month
        </Link>
      )
    }
    if (!state) return null
    if (state.exempt) return null
    // Social Butterfly with new slider choices: change the current plan.
    const newChoices = id === 'butterfly' && id === state.plan && !samePlanOptions(sliders, state.options)
    if (id === state.plan && !newChoices) {
      if (state.pendingPlan) {
        return (
          <button
            type="button"
            onClick={() => choose(id)}
            disabled={busy !== null}
            className="w-full px-5 py-2.5 border-2 border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          >
            {busy === id ? 'Please wait…' : state.pendingPlan === id ? 'Keep current choices' : `Keep ${plan.name}`}
          </button>
        )
      }
      return <p className="text-center text-sm font-medium text-accent py-2.5">Your current plan</p>
    }
    if (id === state.pendingPlan) {
      return <p className="text-center text-sm text-text-secondary py-2.5">Starts {state.pendingFrom ? formatDay(state.pendingFrom) : 'next month'}</p>
    }
    const upgrade = newChoices ? feeFor(id) > state.feeEur : PLAN_IDS.indexOf(id) > PLAN_IDS.indexOf(state.plan)
    if (confirm === id) {
      return (
        <div className="space-y-2">
          <p className="text-xs text-text-secondary text-center">
            {state.inTrial
              ? `${newChoices ? 'Update your choices' : `Switch to ${plan.name}`}? It's free until your free month ends on ${formatDay(state.trialEndsAt)}.`
              : upgrade
                ? `${newChoices ? 'Update your choices' : `Switch to ${plan.name}`} now? ${formatEur(feeFor(id))}/month, charged at the end of each month with your messages.`
                : `${newChoices ? 'Update your choices' : `Switch to ${plan.name}`} from the start of next month?`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => choose(id)}
              disabled={busy !== null}
              className="flex-1 px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
            >
              {busy === id ? 'Please wait…' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="flex-1 px-4 py-2 border-2 border-border text-text-primary text-sm font-medium rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }
    return (
      <button
        type="button"
        onClick={() => { setMessage(null); setConfirm(id) }}
        disabled={busy !== null}
        className={`w-full px-5 py-2.5 text-sm font-medium rounded-lg transition-all disabled:opacity-50 ${
          upgrade ? 'bg-accent hover:bg-accent-light text-white shadow-soft' : 'border-2 border-border hover:border-accent text-text-primary'
        }`}
      >
        {newChoices ? `Update to ${formatEur(feeFor(id))} / month` : upgrade ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
      </button>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-text-primary mb-3">Plans</h1>
        <p className="text-text-secondary mb-2 max-w-2xl">
          Every plan starts with a free month. After that, your plan continues automatically and you&apos;ll need to save a card.
          On every plan, you also pay for the messages you send, usually between half a cent and two cents each.
        </p>

        {state?.exempt && (
          <p className="mt-4 text-sm bg-accent-tint text-accent border border-accent/20 rounded-lg px-4 py-3">
            Your account has every feature and is never billed.
          </p>
        )}
        {state && !state.exempt && state.inTrial && (
          <p className="mt-4 text-sm text-text-secondary">
            Your free month ends on {formatDay(state.trialEndsAt)}. Until then you can switch plans freely.
          </p>
        )}
        {state?.pendingPlan && state.pendingFrom && (
          <p className="mt-4 text-sm text-text-secondary">
            {state.pendingPlan === state.plan
              ? `Your new ${PLANS[state.plan].name} choices start on ${formatDay(state.pendingFrom)}.`
              : `You'll move to ${PLANS[state.pendingPlan].name} on ${formatDay(state.pendingFrom)}.`}
          </p>
        )}
        {message && (
          <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-error' : 'text-success'}`} role={message.type === 'error' ? 'alert' : 'status'}>
            {message.text}{' '}
            {message.needsCard && (
              <Link href="/settings" className="text-accent hover:underline font-medium">Add a card in Settings</Link>
            )}
          </p>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 mt-8">
          {PLAN_IDS.map(id => {
            const plan = PLANS[id]
            const current = state?.plan === id && !state.exempt
            return (
              <div
                key={id}
                className={`bg-card border rounded-xl p-6 flex flex-col gap-5 shadow-soft ${current ? 'border-accent' : 'border-border'}`}
              >
                <div>
                  <h2 className="text-xl font-semibold text-text-primary">{plan.name}</h2>
                  <p className="mt-1 text-sm text-text-secondary">{plan.tagline}</p>
                </div>
                <p className="text-3xl font-semibold text-text-primary">
                  {feeFor(id) === 0 ? 'Free' : formatEur(feeFor(id))}
                  <span className="text-sm font-normal text-text-secondary">{feeFor(id) === 0 ? '' : ' / month'}</span>
                  <span className="block text-xs font-normal text-text-secondary mt-1">plus the messages you send</span>
                </p>
                {id === 'butterfly' && <PlanSliders value={sliders} onChange={setSliders} />}
                <div className="flex-1">
                  <PlanFeatures plan={plan} />
                </div>
                {buttonFor(id)}
              </div>
            )
          })}
        </div>

        <h2 className="text-2xl font-semibold text-text-primary mt-14 mb-4">Learn more</h2>
        <div className="space-y-3">
          {FEATURE_HELP.map(f => (
            <details key={f.key} id={f.key} className="bg-card border border-border rounded-lg px-5 py-4">
              <summary className="cursor-pointer font-medium text-text-primary">{f.title}</summary>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">{f.text}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
