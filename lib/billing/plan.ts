import { createServiceClient } from '@/lib/supabase/service'
import { currentPeriod } from '@/lib/insights/periods'
import {
  PLANS,
  formatEur,
  isPlanId,
  normalizePlanOptions,
  planLimits,
  planRank,
  samePlanOptions,
  type PlanId,
  type PlanLimits,
  type PlanOptions,
} from '@/lib/plans'

// Plan state and plan changes (server-only; owner decisions 2026-10-09).
// - plan_changes is the source of truth: the plan at time T is the latest row
//   with effective_at <= T. A scheduled downgrade is a row dated in the future
//   (start of next month). users.plan / pending_plan are kept in sync as a cache.
// - Upgrades apply at once. Downgrades apply at the start of next month, or at
//   once during the free month. A downgrade is refused while the Vault is
//   bigger than the new plan allows.
// - During the free month, and while no card is saved (account locked to
//   /billing/setup, no fee yet), every change applies at once.
// - billing_exempt accounts keep every feature and can't change plan.
// - Social Butterfly: slider choices are kept with each change
//   (plan_changes.options). A change that raises the fee is an upgrade (at
//   once); one that doesn't is a downgrade (next month). Fewer own circles than
//   the person has is refused until they delete some. Leaving Social Butterfly
//   turns sections in own circles into drafts (circles are kept for later).

export type PlanState = {
  plan: PlanId
  // Social Butterfly slider choices (null on other plans).
  options: PlanOptions | null
  feeEur: number
  pendingPlan: PlanId | null
  pendingOptions: PlanOptions | null
  pendingFeeEur: number | null
  pendingFrom: string | null
  exempt: boolean
  inTrial: boolean
  trialEndsAt: string
  hasCard: boolean
  vaultChars: number
  // Vault size allowed now: the plan's limit, or the smaller one of a scheduled
  // downgrade (same rule as the database trigger enforce_vault_char_limit).
  vaultLimit: number
  // 1 = Outer Circle only (Introvert); 2 = Inner + Outer.
  circles: 1 | 2
  // Own circles allowed now (Social Butterfly) and how many the person has.
  extraCircles: number
  customCircles: number
}

type ChangeRow = { id: number; to_plan: string; options: unknown; effective_at: string }

export async function getVaultChars(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('vault_sections').select('content').eq('user_id', userId)
  if (error) throw new Error(error.message)
  // Counted like the database (characters, not UTF-16 units).
  return ((data as { content: string | null }[] | null) ?? []).reduce((n, r) => n + Array.from(r.content ?? '').length, 0)
}

// The plan (and Social Butterfly slider choices) a user had at a given moment
// (default: now), from plan_changes.
export async function getPlanWithOptionsAt(
  userId: string,
  at: Date = new Date()
): Promise<{ plan: PlanId; options: PlanOptions | null }> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('plan_changes')
    .select('to_plan, options')
    .eq('user_id', userId)
    .lte('effective_at', at.toISOString())
    .order('effective_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle<{ to_plan: string; options: unknown }>()
  if (data && isPlanId(data.to_plan)) return { plan: data.to_plan, options: planLimits(data.to_plan, data.options).options }
  const { data: user } = await supabase
    .from('users')
    .select('plan, plan_options')
    .eq('id', userId)
    .maybeSingle<{ plan: string; plan_options: unknown }>()
  if (user && isPlanId(user.plan)) return { plan: user.plan, options: planLimits(user.plan, user.plan_options).options }
  return { plan: 'introvert', options: null }
}

export async function getPlanAt(userId: string, at: Date = new Date()): Promise<PlanId> {
  return (await getPlanWithOptionsAt(userId, at)).plan
}

// Limits in effect now (incl. Social Butterfly slider choices).
export async function getPlanLimits(userId: string): Promise<PlanLimits> {
  const { plan, options } = await getPlanWithOptionsAt(userId)
  return planLimits(plan, options)
}

export async function countCustomCircles(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count, error } = await supabase
    .from('custom_circles')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function getPlanState(userId: string): Promise<PlanState> {
  const supabase = createServiceClient()
  const now = new Date()

  const { data: user, error } = await supabase
    .from('users')
    .select('plan, pending_plan, plan_options, billing_exempt, trial_ends_at')
    .eq('id', userId)
    .single<{ plan: string; pending_plan: string | null; plan_options: unknown; billing_exempt: boolean; trial_ends_at: string }>()
  if (error || !user) throw new Error(error?.message ?? 'user not found')

  const { data: changes } = await supabase
    .from('plan_changes')
    .select('id, to_plan, options, effective_at')
    .eq('user_id', userId)
    .order('effective_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(10)
  const rows = (changes as ChangeRow[] | null) ?? []
  const currentRow = rows.find(r => new Date(r.effective_at) <= now)
  const futureRow = rows.filter(r => new Date(r.effective_at) > now).pop() ?? null

  const plan: PlanId = currentRow && isPlanId(currentRow.to_plan) ? currentRow.to_plan : isPlanId(user.plan) ? user.plan : 'introvert'
  const current = planLimits(plan, currentRow ? currentRow.options : user.plan_options)
  const future = futureRow && isPlanId(futureRow.to_plan) ? planLimits(futureRow.to_plan, futureRow.options) : null
  const pending = future && (future.id !== plan || !samePlanOptions(future.options, current.options)) ? future : null
  const pendingPlan: PlanId | null = pending ? pending.id : null

  // Keep the cached columns in sync (e.g. after a downgrade took effect).
  if (
    user.plan !== plan ||
    (user.pending_plan ?? null) !== pendingPlan ||
    !samePlanOptions(current.options, user.plan_options == null ? null : planLimits(plan, user.plan_options).options)
  ) {
    await supabase.from('users').update({ plan, pending_plan: pendingPlan, plan_options: current.options }).eq('id', userId)
  }

  // One-circle plan (Introvert): Inner Circle sections become drafts (owner
  // decision). They are already hidden from everyone by resolveCircles.
  if (PLANS[plan].circles === 1 && user.billing_exempt !== true) {
    await supabase.from('vault_sections').update({ circle: 'draft' }).eq('user_id', userId).eq('circle', 'inner')
  }
  // No own circles on this plan: their sections become drafts (the circles
  // and their members are kept for a later upgrade).
  if (current.extraCircles === 0 && user.billing_exempt !== true) {
    await supabase
      .from('vault_sections')
      .update({ circle: 'draft', custom_circle_id: null })
      .eq('user_id', userId)
      .eq('circle', 'custom')
  }

  const { data: account } = await supabase
    .from('billing_accounts')
    .select('mandate_status, mandate_id')
    .eq('user_id', userId)
    .maybeSingle<{ mandate_status: string; mandate_id: string | null }>()

  return {
    plan,
    options: current.options,
    feeEur: current.feeEur,
    pendingPlan,
    pendingOptions: pending ? pending.options : null,
    pendingFeeEur: pending ? pending.feeEur : null,
    pendingFrom: pending && futureRow ? futureRow.effective_at : null,
    exempt: user.billing_exempt === true,
    inTrial: new Date(user.trial_ends_at) > now,
    trialEndsAt: user.trial_ends_at,
    hasCard: account?.mandate_status === 'valid' && !!account.mandate_id,
    vaultChars: await getVaultChars(userId),
    vaultLimit: Math.min(PLANS[plan].vaultChars, pendingPlan ? PLANS[pendingPlan].vaultChars : Infinity),
    circles: PLANS[plan].circles,
    extraCircles: current.extraCircles,
    customCircles: await countCustomCircles(userId),
  }
}

export type ChangeResult =
  | { ok: true; message: string; state: PlanState }
  | { ok: false; status: number; error: string; needsCard?: boolean }

export async function changePlan(userId: string, target: PlanId, rawOptions?: unknown): Promise<ChangeResult> {
  const supabase = createServiceClient()
  const state = await getPlanState(userId)
  const now = new Date()

  if (state.exempt) return { ok: false, status: 400, error: 'Your account already has every feature.' }
  if (!PLANS[target].available && target !== state.plan) {
    return { ok: false, status: 403, error: `${PLANS[target].name} is coming soon.` }
  }

  // Slider choices: as sent, else the current ones, else the defaults.
  const next = planLimits(target, target === 'butterfly' ? normalizePlanOptions(rawOptions, state.options ?? undefined) : null)
  const name = PLANS[target].name

  const removeScheduled = async () => {
    const { error } = await supabase.from('plan_changes').delete().eq('user_id', userId).gt('effective_at', now.toISOString())
    if (error) throw new Error(error.message)
  }
  const addChange = async (effectiveAt: Date) => {
    const { error } = await supabase.from('plan_changes').insert({
      user_id: userId,
      from_plan: state.plan,
      to_plan: target,
      options: next.options,
      effective_at: effectiveAt.toISOString(),
    })
    if (error) throw new Error(error.message)
  }

  if (target === state.plan && samePlanOptions(next.options, state.options)) {
    if (!state.pendingPlan) return { ok: false, status: 400, error: `You're already on ${name}.` }
    await removeScheduled()
    return { ok: true, message: `You'll stay on ${name}.`, state: await getPlanState(userId) }
  }

  // Upgrade (a higher plan, or slider choices that cost more): right away.
  const upgrade = target === state.plan ? next.feeEur > state.feeEur : planRank(target) > planRank(state.plan)
  if (upgrade) {
    await removeScheduled()
    await addChange(now)
    const what = target === state.plan ? `Your ${name} plan is now ${formatEur(next.feeEur)} per month.` : `You're now on ${name}.`
    return { ok: true, message: what, state: await getPlanState(userId) }
  }

  // Downgrade: the Vault must fit the smaller plan first.
  const limit = PLANS[target].vaultChars
  if (state.vaultChars > limit) {
    return {
      ok: false,
      status: 409,
      error: `Your Vault has ${state.vaultChars.toLocaleString('en-GB')} characters; ${name} allows ${limit.toLocaleString('en-GB')}. Please shorten your Vault first.`,
    }
  }
  // Fewer own circles on Social Butterfly: delete some first. (Leaving Social
  // Butterfly keeps them for later; their sections become drafts.)
  if (target === 'butterfly' && state.customCircles > next.extraCircles) {
    return {
      ok: false,
      status: 409,
      error: `You have ${state.customCircles} circles of your own. Please delete some on the Connections page first, or keep at least ${state.customCircles}.`,
    }
  }
  await removeScheduled()
  if (state.inTrial || !state.hasCard) {
    await addChange(now)
    return { ok: true, message: target === state.plan ? 'Your plan has been updated.' : `You're now on ${name}.`, state: await getPlanState(userId) }
  }
  const nextMonth = currentPeriod('month', now).end
  await addChange(nextMonth)
  const day = nextMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/Vienna' })
  return {
    ok: true,
    message: target === state.plan
      ? `Your new choices start on ${day}. Until then you keep your current ones.`
      : `You'll move to ${name} on ${day}. Until then you keep ${PLANS[state.plan].name}.`,
    state: await getPlanState(userId),
  }
}
