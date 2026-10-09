import { createServiceClient } from '@/lib/supabase/service'
import { PLANS, isPlanId, type PlanId } from '@/lib/plans'
import { getPlanAt } from '@/lib/billing/plan'

// Monthly plan fee for a billing period (owner decisions 2026-10-09):
// - No fee during the free month, and none before a card was saved
//   (billing_accounts.mandate_since): the fee starts at the later of the two.
// - The fee is that of the most expensive plan held during the period
//   (upgrades apply at once; downgrades only take effect at month start).
// - In the month the fee starts, it is pro-rated by day; after that, full.
// billing_exempt accounts are handled by the caller (never billed).

const round2 = (n: number) => Math.round(n * 100) / 100

export type PlanFee = { plan: PlanId | null; feeEur: number }

export async function planFeeFor(
  userId: string,
  period: { start: Date; end: Date },
  opts: { ignoreTrial?: boolean } = {}
): Promise<PlanFee> {
  const supabase = createServiceClient()
  const { data: user } = await supabase
    .from('users')
    .select('trial_ends_at')
    .eq('id', userId)
    .maybeSingle<{ trial_ends_at: string }>()
  const { data: account } = await supabase
    .from('billing_accounts')
    .select('mandate_since')
    .eq('user_id', userId)
    .maybeSingle<{ mandate_since: string | null }>()
  if (!account?.mandate_since) return { plan: null, feeEur: 0 }

  const starts = [period.start.getTime(), new Date(account.mandate_since).getTime()]
  if (!opts.ignoreTrial && user?.trial_ends_at) starts.push(new Date(user.trial_ends_at).getTime())
  const feeStart = new Date(Math.max(...starts))
  if (feeStart >= period.end) return { plan: null, feeEur: 0 }

  const held: PlanId[] = [await getPlanAt(userId, feeStart)]
  const { data: changes } = await supabase
    .from('plan_changes')
    .select('to_plan')
    .eq('user_id', userId)
    .gt('effective_at', feeStart.toISOString())
    .lt('effective_at', period.end.toISOString())
  for (const c of (changes as { to_plan: string }[] | null) ?? []) if (isPlanId(c.to_plan)) held.push(c.to_plan)

  const plan = held.reduce((a, b) => (PLANS[b].feeEur > PLANS[a].feeEur ? b : a))
  const fullFee = PLANS[plan].feeEur
  if (fullFee <= 0) return { plan, feeEur: 0 }

  const share = feeStart > period.start
    ? (period.end.getTime() - feeStart.getTime()) / (period.end.getTime() - period.start.getTime())
    : 1
  return { plan, feeEur: round2(fullFee * share) }
}
