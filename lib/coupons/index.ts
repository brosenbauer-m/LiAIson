import { createServiceClient } from '@/lib/supabase/service'
import { changePlan } from '@/lib/billing/plan'
import { PLANS, planRank, isPlanId, formatEur, type PlanId, type PlanOptions } from '@/lib/plans'

// Event codes for the people using them (owner decisions 2026-10-28):
// - at sign-up the code is checked here (preview) and redeemed by the database
//   while the account is made (handle_new_user, migration 42);
// - signed-in people redeem in Settings (redeemForUser): the database takes
//   the seat, adds the credit and sets the period; the tier is raised here
//   when the code's tier is higher than theirs (never lowered).
// Server-only.

export const CODE_RE = /^[A-Z0-9-]{4,40}$/

export function cleanCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase().replace(/\s+/g, '-')
  return CODE_RE.test(code) ? code : null
}

export type CouponPreview = {
  ok: boolean
  reason?: string
  name?: string
  tier?: PlanId
  freeDays?: number
  creditEur?: number
  summary?: string
}

export const REASONS: Record<string, string> = {
  coupon_not_found: "We don't know this code. Please check the spelling.",
  coupon_inactive: 'This code is no longer in use.',
  coupon_expired: 'This code has passed its use-by date.',
  coupon_full: 'All seats for this code have been taken.',
  coupon_new_accounts_only: 'This code is for new accounts only.',
  coupon_existing_accounts_only: 'This code is for existing accounts. Create your account first, then enter it in Settings.',
  coupon_already_used: "You've already used this code.",
}

export function summary(tier: PlanId, freeDays: number, creditEur: number): string {
  return `${PLANS[tier].name} free for ${freeDays} days${creditEur > 0 ? ` + ${formatEur(creditEur)} of AI credit` : ''}`
}

// What a code gives, and whether it can be used (for a new account, or by this
// person). Reads only; nothing is taken.
export async function previewCoupon(rawCode: unknown, who: { newAccount: true } | { newAccount: false; userId: string }): Promise<CouponPreview> {
  const code = cleanCode(rawCode)
  if (!code) return { ok: false, reason: REASONS.coupon_not_found }
  const supabase = createServiceClient()
  const { data: row, error } = await supabase
    .from('coupon_codes')
    .select('uses, max_uses, campaign:coupon_campaigns!coupon_codes_campaign_id_fkey(id, name, tier, free_days, credit_eur, audience, active, archived_at, expires_at)')
    .eq('code', code)
    .maybeSingle<{ uses: number; max_uses: number; campaign: { id: string; name: string; tier: string; free_days: number; credit_eur: number; audience: string; active: boolean; archived_at: string | null; expires_at: string | null } | null }>()
  if (error) throw new Error(error.message)
  const c = row?.campaign
  if (!row || !c || !isPlanId(c.tier)) return { ok: false, reason: REASONS.coupon_not_found }
  const base = { name: c.name, tier: c.tier, freeDays: c.free_days, creditEur: Number(c.credit_eur), summary: summary(c.tier, c.free_days, Number(c.credit_eur)) }
  if (!c.active || c.archived_at) return { ok: false, reason: REASONS.coupon_inactive, ...base }
  if (c.expires_at && new Date(c.expires_at).getTime() < Date.now()) return { ok: false, reason: REASONS.coupon_expired, ...base }
  if (c.audience === 'new' && !who.newAccount) return { ok: false, reason: REASONS.coupon_new_accounts_only, ...base }
  if (c.audience === 'existing' && who.newAccount) return { ok: false, reason: REASONS.coupon_existing_accounts_only, ...base }
  if (!who.newAccount) {
    const { data: used } = await supabase.from('coupon_redemptions').select('id').eq('campaign_id', c.id).eq('user_id', who.userId).maybeSingle()
    if (used) return { ok: false, reason: REASONS.coupon_already_used, ...base }
  }
  if (row.uses >= row.max_uses) return { ok: false, reason: REASONS.coupon_full, ...base }
  return { ok: true, ...base }
}

export type RedeemResult = { ok: true; summary: string; tierRaised: boolean; periodEndsAt: string } | { ok: false; error: string }

// Signed-in person redeems a code (Settings).
export async function redeemForUser(userId: string, rawCode: unknown): Promise<RedeemResult> {
  const code = cleanCode(rawCode)
  if (!code) return { ok: false, error: REASONS.coupon_not_found }
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('redeem_coupon', { p_code: code, p_user_id: userId, p_new_account: false })
  if (error) {
    const key = Object.keys(REASONS).find(k => error.message.includes(k))
    if (key) return { ok: false, error: REASONS[key] }
    console.error('COUPON_REDEEM_ERROR', error.message)
    return { ok: false, error: 'The code could not be used right now. Please try again.' }
  }
  const row = (Array.isArray(data) ? data[0] : data) as { tier: string; plan_options: PlanOptions | null; free_days: number; credit_eur: number; period_ends_at: string } | undefined
  if (!row || !isPlanId(row.tier)) return { ok: false, error: 'The code could not be used right now. Please try again.' }

  // The code's tier, when higher than theirs (an upgrade applies at once).
  let tierRaised = false
  const { data: user } = await supabase.from('users').select('plan').eq('id', userId).maybeSingle<{ plan: PlanId }>()
  if (user && planRank(row.tier) > planRank(user.plan)) {
    const changed = await changePlan(userId, row.tier, row.plan_options ?? undefined).catch(err => {
      console.error('COUPON_PLAN_ERROR', err)
      return null
    })
    tierRaised = !!changed?.ok
  }
  return { ok: true, summary: summary(row.tier, row.free_days, Number(row.credit_eur)), tierRaised, periodEndsAt: row.period_ends_at }
}
