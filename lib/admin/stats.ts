import { createServiceClient } from '@/lib/supabase/service'
import { rawCostEur, MARKUP, isMeteredFeature } from '@/lib/usage/spend'
import type { PlanId } from '@/lib/plans'

// Numbers for the admin pages (owner request 2026-10-28). Everything is read
// from what the app already stores; nothing extra is tracked. Server-only.

const DAY = 86400_000
const round2 = (n: number) => Math.round(n * 100) / 100

type UsageRow = { month: string; feature: string; model: string; calls: number; prompt_tokens: number; completion_tokens: number; users: number }

async function usageRows(since: Date, until: Date): Promise<UsageRow[]> {
  const { data, error } = await createServiceClient().rpc('admin_usage_summary', { p_since: since.toISOString(), p_until: until.toISOString() })
  if (error) throw new Error(error.message)
  return ((data as UsageRow[] | null) ?? []).map(r => ({ ...r, calls: Number(r.calls), prompt_tokens: Number(r.prompt_tokens), completion_tokens: Number(r.completion_tokens), users: Number(r.users) }))
}

export type Overview = {
  accounts: { total: number; confirmed: number; newWeek: number; newMonth: number; withCard: number; inFreeMonth: number; sponsored: number; exempt: number }
  plans: Record<PlanId, number>
  // Last 30 days.
  activity: { feature: string; calls: number; users: number }[]
  aiCostEur: number
  aiValueEur: number
  activeUsers30: number
  activeUsers7: number
  coupons: { campaigns: number; seatsUsed: number; seats: number }
}

export async function getOverview(now = new Date()): Promise<Overview> {
  const supabase = createServiceClient()
  const since30 = new Date(now.getTime() - 30 * DAY)
  const since7 = new Date(now.getTime() - 7 * DAY)
  const iso = now.toISOString()

  const count = async (build: (q: ReturnType<typeof supabase.from>) => unknown) => {
    const q = supabase.from('users')
    const { count: n } = await (build(q) as unknown as Promise<{ count: number | null }>)
    return n ?? 0
  }
  const [total, newWeek, newMonth, inFreeMonth, sponsored, exempt, { data: planRows }, { count: withCard }, { data: campaigns }] = await Promise.all([
    count(q => q.select('id', { count: 'exact', head: true }).eq('is_admin', false)),
    count(q => q.select('id', { count: 'exact', head: true }).eq('is_admin', false).gte('created_at', since7.toISOString())),
    count(q => q.select('id', { count: 'exact', head: true }).eq('is_admin', false).gte('created_at', since30.toISOString())),
    count(q => q.select('id', { count: 'exact', head: true }).eq('is_admin', false).eq('billing_exempt', false).gt('trial_ends_at', iso)),
    count(q => q.select('id', { count: 'exact', head: true }).eq('is_admin', false).gt('sponsored_until', iso)),
    count(q => q.select('id', { count: 'exact', head: true }).eq('is_admin', false).eq('billing_exempt', true)),
    supabase.from('users').select('plan').eq('is_admin', false).limit(100000),
    supabase.from('billing_accounts').select('user_id', { count: 'exact', head: true }).eq('mandate_status', 'valid'),
    supabase.from('coupon_campaigns').select('id, seats').is('archived_at', null),
  ])

  const plans: Record<PlanId, number> = { introvert: 0, ambivert: 0, extrovert: 0, butterfly: 0 }
  for (const r of (planRows as { plan: PlanId }[] | null) ?? []) if (r.plan in plans) plans[r.plan]++

  // Confirmed accounts: from the auth list (small site; capped).
  let confirmed = 0
  for (let page = 1; page <= 10; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    const users = data?.users ?? []
    confirmed += users.filter(u => u.email_confirmed_at).length
    if (users.length < 1000) break
  }

  const [rows30, rows7] = await Promise.all([usageRows(since30, now), usageRows(since7, now)])
  const byFeature = new Map<string, { calls: number; users: number }>()
  let cost = 0
  let value = 0
  for (const r of rows30) {
    const cur = byFeature.get(r.feature) ?? { calls: 0, users: 0 }
    cur.calls += r.calls
    cur.users = Math.max(cur.users, r.users)
    byFeature.set(r.feature, cur)
    const c = rawCostEur(r.model, r.prompt_tokens, r.completion_tokens, r.feature)
    cost += c
    if (isMeteredFeature(r.feature)) value += c * (1 + MARKUP)
  }
  const activeUsers = (rows: UsageRow[]) => Math.max(0, ...rows.filter(r => r.feature === 'chat').map(r => r.users))

  const campaignRows = (campaigns as { id: string; seats: number }[] | null) ?? []
  let seatsUsed = 0
  if (campaignRows.length) {
    const { data: codes } = await supabase.from('coupon_codes').select('uses').in('campaign_id', campaignRows.map(c => c.id)).limit(20000)
    for (const c of (codes as { uses: number }[] | null) ?? []) seatsUsed += c.uses
  }

  return {
    accounts: { total, confirmed, newWeek, newMonth, withCard: withCard ?? 0, inFreeMonth, sponsored, exempt },
    plans,
    activity: [...byFeature.entries()].map(([feature, v]) => ({ feature, ...v })).sort((a, b) => b.calls - a.calls),
    aiCostEur: round2(cost),
    aiValueEur: round2(value),
    activeUsers30: activeUsers(rows30),
    activeUsers7: activeUsers(rows7),
    coupons: { campaigns: campaignRows.length, seatsUsed, seats: campaignRows.reduce((s, c) => s + c.seats, 0) },
  }
}

export type MonthMoney = {
  month: string // YYYY-MM
  billsIssued: number
  billedUsageEur: number
  billedFeesEur: number
  billsPaidEur: number
  billsOpenEur: number // pending + failed + carried over
  topUpsEur: number
  couponCreditEur: number
  aiCostEur: number
  aiValueEur: number // all metered usage at user prices, incl. free months
}

export async function getMoney(months = 12, now = new Date()): Promise<MonthMoney[]> {
  const supabase = createServiceClient()
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1))
  const [{ data: bills }, { data: balance }, usage] = await Promise.all([
    supabase.rpc('admin_billing_summary', { p_since: since.toISOString() }),
    supabase.rpc('admin_balance_summary', { p_since: since.toISOString() }),
    usageRows(since, new Date(now.getTime() + DAY)),
  ])
  const out = new Map<string, MonthMoney>()
  const get = (month: string) => {
    const key = month.slice(0, 7)
    let m = out.get(key)
    if (!m) {
      m = { month: key, billsIssued: 0, billedUsageEur: 0, billedFeesEur: 0, billsPaidEur: 0, billsOpenEur: 0, topUpsEur: 0, couponCreditEur: 0, aiCostEur: 0, aiValueEur: 0 }
      out.set(key, m)
    }
    return m
  }
  for (const b of (bills as { month: string; kind: string; status: string; documents: number; usage_eur: number; plan_fee_eur: number; total_eur: number }[] | null) ?? []) {
    const m = get(b.month)
    if (b.kind === 'monthly') {
      m.billsIssued += Number(b.documents)
      m.billedUsageEur += Number(b.usage_eur)
      m.billedFeesEur += Number(b.plan_fee_eur)
      if (b.status === 'paid') m.billsPaidEur += Number(b.total_eur)
      else if (b.status === 'pending' || b.status === 'failed' || b.status === 'carried_over') m.billsOpenEur += Number(b.total_eur)
    } else if (b.kind === 'topup' && b.status === 'paid') {
      m.topUpsEur += Number(b.total_eur)
    }
  }
  for (const e of (balance as { month: string; kind: string; amount_eur: number }[] | null) ?? []) {
    if (e.kind === 'coupon') get(e.month).couponCreditEur += Number(e.amount_eur)
  }
  for (const r of usage) {
    const m = get(r.month)
    const c = rawCostEur(r.model, r.prompt_tokens, r.completion_tokens, r.feature)
    m.aiCostEur += c
    if (isMeteredFeature(r.feature)) m.aiValueEur += c * (1 + MARKUP)
  }
  return [...out.values()]
    .map(m => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === 'number' && k !== 'billsIssued' ? round2(v) : v])) as MonthMoney)
    .sort((a, b) => (a.month < b.month ? 1 : -1))
}

export type AccountRow = {
  id: string
  username: string
  displayName: string
  email: string | null
  confirmed: boolean
  banned: boolean
  createdAt: string
  lastSignIn: string | null
  plan: PlanId
  trialEndsAt: string
  sponsoredUntil: string | null
  exempt: boolean
  card: boolean
  spendLimitCents: number
  monthCostEur: number // at user prices
  coupon: string | null
}

// Every account (small site) with its billing state and this month's usage.
export async function listAccounts(now = new Date()): Promise<AccountRow[]> {
  const supabase = createServiceClient()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const [{ data: users, error }, { data: cards }, { data: usage }, { data: redemptions }] = await Promise.all([
    supabase.from('users').select('id, username, display_name, created_at, plan, trial_ends_at, sponsored_until, billing_exempt, monthly_spend_limit_cents').eq('is_admin', false).order('created_at', { ascending: false }).limit(5000),
    supabase.from('billing_accounts').select('user_id, mandate_status, mandate_id').limit(5000),
    supabase.rpc('admin_usage_by_user', { p_since: monthStart.toISOString() }),
    supabase.from('coupon_redemptions').select('user_id, campaign:coupon_campaigns!coupon_redemptions_campaign_id_fkey(name)').order('redeemed_at', { ascending: false }).limit(10000),
  ])
  if (error) throw new Error(error.message)

  const auth = new Map<string, { email: string | null; confirmed: boolean; banned: boolean; lastSignIn: string | null }>()
  for (let page = 1; page <= 10; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    const list = data?.users ?? []
    for (const u of list) {
      const bannedUntil = (u as { banned_until?: string | null }).banned_until
      auth.set(u.id, { email: u.email ?? null, confirmed: !!u.email_confirmed_at, banned: !!bannedUntil && new Date(bannedUntil) > now, lastSignIn: u.last_sign_in_at ?? null })
    }
    if (list.length < 1000) break
  }
  const withCard = new Set(((cards as { user_id: string; mandate_status: string; mandate_id: string | null }[] | null) ?? []).filter(c => c.mandate_status === 'valid' && c.mandate_id).map(c => c.user_id))
  const cost = new Map<string, number>()
  for (const r of (usage as { user_id: string; feature: string; model: string; prompt_tokens: number; completion_tokens: number }[] | null) ?? []) {
    if (!isMeteredFeature(r.feature)) continue
    cost.set(r.user_id, (cost.get(r.user_id) ?? 0) + rawCostEur(r.model, Number(r.prompt_tokens), Number(r.completion_tokens), r.feature) * (1 + MARKUP))
  }
  const coupon = new Map<string, string>()
  for (const r of (redemptions as { user_id: string; campaign: { name: string } | { name: string }[] | null }[] | null) ?? []) {
    const c = Array.isArray(r.campaign) ? r.campaign[0] : r.campaign
    if (c && !coupon.has(r.user_id)) coupon.set(r.user_id, c.name)
  }

  type Row = { id: string; username: string; display_name: string; created_at: string; plan: PlanId; trial_ends_at: string; sponsored_until: string | null; billing_exempt: boolean; monthly_spend_limit_cents: number }
  return ((users as Row[] | null) ?? []).map(u => {
    const a = auth.get(u.id)
    return {
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      email: a?.email ?? null,
      confirmed: a?.confirmed ?? false,
      banned: a?.banned ?? false,
      createdAt: u.created_at,
      lastSignIn: a?.lastSignIn ?? null,
      plan: u.plan,
      trialEndsAt: u.trial_ends_at,
      sponsoredUntil: u.sponsored_until,
      exempt: u.billing_exempt,
      card: withCard.has(u.id),
      spendLimitCents: u.monthly_spend_limit_cents,
      monthCostEur: round2(cost.get(u.id) ?? 0),
      coupon: coupon.get(u.id) ?? null,
    }
  })
}
