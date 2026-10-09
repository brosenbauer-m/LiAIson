import { createServiceClient } from '@/lib/supabase/service'
import { currentPeriod } from '@/lib/insights/periods'
import { PLANS, isPlanId, planRank, type PlanId } from '@/lib/plans'

// Plan state and plan changes (server-only; owner decisions 2026-10-09).
// - plan_changes is the source of truth: the plan at time T is the latest row
//   with effective_at <= T. A scheduled downgrade is a row dated in the future
//   (start of next month). users.plan / pending_plan are kept in sync as a cache.
// - Upgrades apply at once. Downgrades apply at the start of next month, or at
//   once during the free month. A downgrade is refused while the Vault is
//   bigger than the new plan allows.
// - After the free month, a paid plan needs a valid saved card.
// - billing_exempt accounts keep every feature and can't change plan.

export type PlanState = {
  plan: PlanId
  pendingPlan: PlanId | null
  pendingFrom: string | null
  exempt: boolean
  inTrial: boolean
  trialEndsAt: string
  hasCard: boolean
  vaultChars: number
  // Vault size allowed now: the plan's limit, or the smaller one of a scheduled
  // downgrade (same rule as the database trigger enforce_vault_char_limit).
  vaultLimit: number
}

type ChangeRow = { id: number; to_plan: string; effective_at: string }

export async function getVaultChars(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('vault_sections').select('content').eq('user_id', userId)
  if (error) throw new Error(error.message)
  // Counted like the database (characters, not UTF-16 units).
  return ((data as { content: string | null }[] | null) ?? []).reduce((n, r) => n + Array.from(r.content ?? '').length, 0)
}

export async function getPlanState(userId: string): Promise<PlanState> {
  const supabase = createServiceClient()
  const now = new Date()

  const { data: user, error } = await supabase
    .from('users')
    .select('plan, pending_plan, billing_exempt, trial_ends_at')
    .eq('id', userId)
    .single<{ plan: string; pending_plan: string | null; billing_exempt: boolean; trial_ends_at: string }>()
  if (error || !user) throw new Error(error?.message ?? 'user not found')

  const { data: changes } = await supabase
    .from('plan_changes')
    .select('id, to_plan, effective_at')
    .eq('user_id', userId)
    .order('effective_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(10)
  const rows = (changes as ChangeRow[] | null) ?? []
  const currentRow = rows.find(r => new Date(r.effective_at) <= now)
  const futureRow = rows.filter(r => new Date(r.effective_at) > now).pop() ?? null

  const plan: PlanId = currentRow && isPlanId(currentRow.to_plan) ? currentRow.to_plan : isPlanId(user.plan) ? user.plan : 'introvert'
  const pendingPlan: PlanId | null = futureRow && isPlanId(futureRow.to_plan) && futureRow.to_plan !== plan ? futureRow.to_plan : null

  // Keep the cached columns in sync (e.g. after a downgrade took effect).
  if (user.plan !== plan || (user.pending_plan ?? null) !== pendingPlan) {
    await supabase.from('users').update({ plan, pending_plan: pendingPlan }).eq('id', userId)
  }

  const { data: account } = await supabase
    .from('billing_accounts')
    .select('mandate_status, mandate_id')
    .eq('user_id', userId)
    .maybeSingle<{ mandate_status: string; mandate_id: string | null }>()

  return {
    plan,
    pendingPlan,
    pendingFrom: pendingPlan && futureRow ? futureRow.effective_at : null,
    exempt: user.billing_exempt === true,
    inTrial: new Date(user.trial_ends_at) > now,
    trialEndsAt: user.trial_ends_at,
    hasCard: account?.mandate_status === 'valid' && !!account.mandate_id,
    vaultChars: await getVaultChars(userId),
    vaultLimit: Math.min(PLANS[plan].vaultChars, pendingPlan ? PLANS[pendingPlan].vaultChars : Infinity),
  }
}

export type ChangeResult =
  | { ok: true; message: string; state: PlanState }
  | { ok: false; status: number; error: string; needsCard?: boolean }

export async function changePlan(userId: string, target: PlanId): Promise<ChangeResult> {
  const supabase = createServiceClient()
  const state = await getPlanState(userId)
  const now = new Date()

  if (state.exempt) return { ok: false, status: 400, error: 'Your account already has every feature.' }

  const removeScheduled = async () => {
    const { error } = await supabase.from('plan_changes').delete().eq('user_id', userId).gt('effective_at', now.toISOString())
    if (error) throw new Error(error.message)
  }
  const addChange = async (from: PlanId, to: PlanId, effectiveAt: Date) => {
    const { error } = await supabase
      .from('plan_changes')
      .insert({ user_id: userId, from_plan: from, to_plan: to, effective_at: effectiveAt.toISOString() })
    if (error) throw new Error(error.message)
  }

  if (target === state.plan) {
    if (!state.pendingPlan) return { ok: false, status: 400, error: `You're already on ${PLANS[target].name}.` }
    await removeScheduled()
    return { ok: true, message: `You'll stay on ${PLANS[target].name}.`, state: await getPlanState(userId) }
  }

  // Upgrade: right away.
  if (planRank(target) > planRank(state.plan)) {
    if (!state.inTrial && PLANS[target].feeEur > 0 && !state.hasCard) {
      return { ok: false, status: 402, error: 'Please add a payment method first.', needsCard: true }
    }
    await removeScheduled()
    await addChange(state.plan, target, now)
    return { ok: true, message: `You're now on ${PLANS[target].name}.`, state: await getPlanState(userId) }
  }

  // Downgrade: the Vault must fit the smaller plan first.
  const limit = PLANS[target].vaultChars
  if (state.vaultChars > limit) {
    return {
      ok: false,
      status: 409,
      error: `Your Vault has ${state.vaultChars.toLocaleString('en-GB')} characters; ${PLANS[target].name} allows ${limit.toLocaleString('en-GB')}. Please shorten your Vault first.`,
    }
  }
  await removeScheduled()
  if (state.inTrial) {
    await addChange(state.plan, target, now)
    return { ok: true, message: `You're now on ${PLANS[target].name}.`, state: await getPlanState(userId) }
  }
  const nextMonth = currentPeriod('month', now).end
  await addChange(state.plan, target, nextMonth)
  const day = nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/Vienna' })
  return {
    ok: true,
    message: `You'll move to ${PLANS[target].name} on ${day}. Until then you keep ${PLANS[state.plan].name}.`,
    state: await getPlanState(userId),
  }
}
