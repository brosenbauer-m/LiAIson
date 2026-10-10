'use client'

import Link from 'next/link'
import { PLANS, PLAN_IDS, butterflyFeeEur, formatEur, type PlanId, type PlanOptions } from '@/lib/plans'
import PlanFeatures from '@/components/plans/PlanFeatures'
import PlanSliders from '@/components/plans/PlanSliders'

// Choose a tier (sign-up and Settings). One line per tier with its price;
// "More" opens what it includes. Social Butterfly shows its sliders when chosen.
export type TierChoice = { plan: PlanId; options: PlanOptions }

export function feeOfChoice(choice: TierChoice): number {
  return choice.plan === 'butterfly' ? butterflyFeeEur(choice.options) : PLANS[choice.plan].feeEur
}

export default function TierPicker({
  value,
  onChange,
  plans = PLAN_IDS,
  current,
}: {
  value: TierChoice
  onChange: (next: TierChoice) => void
  plans?: PlanId[]
  // The plan the person has now (marked "Current").
  current?: PlanId
}) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Tier">
      {plans.filter(id => PLANS[id].available || id === current).map(id => {
        const plan = PLANS[id]
        const selected = value.plan === id
        const fee = id === 'butterfly' ? butterflyFeeEur(value.options) : plan.feeEur
        return (
          <div
            key={id}
            className={`rounded-xl border transition-colors ${selected ? 'border-accent bg-accent-tint' : 'border-border bg-surface hover:border-accent/50'}`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ ...value, plan: id })}
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
            >
              <span
                aria-hidden="true"
                className={`h-4 w-4 flex-shrink-0 rounded-full border ${selected ? 'border-accent bg-accent shadow-[inset_0_0_0_3px_#FFFDF9]' : 'border-text-muted'}`}
              />
              <span className="flex-1 min-w-0">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-text-primary">
                    {plan.name}
                    {current === id && <span className="ml-2 text-xs font-normal text-text-muted">Current</span>}
                  </span>
                  <span className="text-sm text-text-primary tabular-nums whitespace-nowrap">
                    {fee === 0 ? 'Free' : `${formatEur(fee)}/month`}
                  </span>
                </span>
                <span className="block text-xs text-text-secondary mt-0.5">{plan.tagline}</span>
              </span>
            </button>
            {selected && id === 'butterfly' && (
              <div className="px-4 pb-4">
                <PlanSliders value={value.options} onChange={options => onChange({ ...value, options })} />
              </div>
            )}
            <details className="group px-4 pb-3 -mt-1">
              <summary className="cursor-pointer list-none text-xs text-accent hover:underline w-fit">
                <span className="group-open:hidden">More</span>
                <span className="hidden group-open:inline">Less</span>
              </summary>
              <div className="mt-2">
                <PlanFeatures plan={plan} />
              </div>
            </details>
          </div>
        )
      })}
      <p className="text-xs text-text-muted pt-1">
        Every tier starts with a free month. On every tier you also pay for the messages you send, usually between half a cent and two cents.{' '}
        <Link href="/#how-it-works" className="text-accent hover:underline">How LiAIson works</Link>
      </p>
    </div>
  )
}
