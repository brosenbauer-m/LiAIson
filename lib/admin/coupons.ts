import { randomInt } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { isPlanId, normalizePlanOptions, type PlanId, type PlanOptions } from '@/lib/plans'
import { rawCostEur, MARKUP } from '@/lib/usage/spend'

// Event codes for the admin (owner decisions 2026-10-28): a campaign is one
// shared code with N seats, or N single-use codes. Server-only; the admin
// routes check requireAdmin first.

export type CampaignInput = {
  name: string
  organisation: string | null
  mode: 'shared' | 'individual'
  audience: 'new' | 'existing' | 'both'
  tier: PlanId
  planOptions: PlanOptions | null
  freeDays: number
  creditEur: number
  seats: number
  expiresAt: string | null
  code: string | null // shared: the code to use (else generated); individual: the prefix
  notes: string | null
}

export class CouponInputError extends Error {}

const CODE_RE = /^[A-Z0-9-]{4,40}$/
// No 0/O/1/I: codes get read out and typed from slides.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomPart(n: number): string {
  let s = ''
  for (let i = 0; i < n; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return s
}

function slug(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 16) || 'EVENT'
}

export function parseCampaignInput(raw: unknown): CampaignInput {
  const b = (raw ?? {}) as Record<string, unknown>
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : ''
  if (name.length < 2) throw new CouponInputError('Give the campaign a name.')
  const mode = b.mode === 'individual' ? 'individual' : b.mode === 'shared' ? 'shared' : null
  if (!mode) throw new CouponInputError('Choose one shared code or individual codes.')
  const audience = b.audience === 'new' || b.audience === 'existing' || b.audience === 'both' ? b.audience : null
  if (!audience) throw new CouponInputError('Choose who may use the code.')
  if (!isPlanId(b.tier)) throw new CouponInputError('Choose a tier.')
  const freeDays = Number(b.freeDays)
  if (!Number.isInteger(freeDays) || freeDays < 1 || freeDays > 365) throw new CouponInputError('Free days must be a whole number from 1 to 365.')
  const creditEur = Math.round(Number(b.creditEur ?? 0) * 100) / 100
  if (!Number.isFinite(creditEur) || creditEur < 0 || creditEur > 1000) throw new CouponInputError('Credit must be between €0 and €1,000.')
  const seats = Number(b.seats)
  if (!Number.isInteger(seats) || seats < 1 || seats > 10000) throw new CouponInputError('Seats must be a whole number from 1 to 10,000.')
  let expiresAt: string | null = null
  if (typeof b.expiresAt === 'string' && b.expiresAt.trim()) {
    const d = new Date(b.expiresAt)
    if (Number.isNaN(d.getTime())) throw new CouponInputError('The use-by date is not a valid date.')
    if (d.getTime() < Date.now()) throw new CouponInputError('The use-by date is in the past.')
    expiresAt = d.toISOString()
  }
  let code: string | null = null
  if (typeof b.code === 'string' && b.code.trim()) {
    code = b.code.trim().toUpperCase().replace(/\s+/g, '-')
    if (!CODE_RE.test(code)) throw new CouponInputError('Codes can have 4 to 40 letters, numbers and dashes.')
  }
  return {
    name,
    organisation: typeof b.organisation === 'string' && b.organisation.trim() ? b.organisation.trim().slice(0, 120) : null,
    mode,
    audience,
    tier: b.tier,
    planOptions: b.tier === 'butterfly' ? normalizePlanOptions(b.planOptions) : null,
    freeDays,
    creditEur,
    seats,
    expiresAt,
    code,
    notes: typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim().slice(0, 2000) : null,
  }
}

export async function createCampaign(adminId: string, input: CampaignInput): Promise<{ id: string; codes: string[] }> {
  const supabase = createServiceClient()
  const { data: campaign, error } = await supabase
    .from('coupon_campaigns')
    .insert({
      name: input.name,
      organisation: input.organisation,
      mode: input.mode,
      audience: input.audience,
      tier: input.tier,
      plan_options: input.planOptions,
      free_days: input.freeDays,
      credit_eur: input.creditEur,
      seats: input.seats,
      expires_at: input.expiresAt,
      notes: input.notes,
      created_by: adminId,
    })
    .select('id')
    .single<{ id: string }>()
  if (error || !campaign) throw new Error(error?.message ?? 'campaign not created')

  const codes: string[] = []
  try {
    if (input.mode === 'shared') {
      const code = input.code ?? `${slug(input.name)}-${randomPart(4)}`
      const { error: codeError } = await supabase.from('coupon_codes').insert({ campaign_id: campaign.id, code, max_uses: input.seats })
      if (codeError) throw new CouponInputError(codeError.code === '23505' ? 'That code is already in use. Choose another.' : codeError.message)
      codes.push(code)
    } else {
      const prefix = input.code ?? slug(input.name)
      const wanted = new Set<string>()
      while (wanted.size < input.seats) wanted.add(`${prefix}-${randomPart(4)}-${randomPart(4)}`)
      // In batches; a clash with an older campaign is simply replaced.
      let pending = [...wanted]
      for (let round = 0; pending.length && round < 5; round++) {
        const { data: existing } = await supabase.from('coupon_codes').select('code').in('code', pending)
        const taken = new Set(((existing as { code: string }[] | null) ?? []).map(r => r.code))
        const fresh = pending.filter(c => !taken.has(c))
        for (let i = 0; i < fresh.length; i += 500) {
          const { error: codeError } = await supabase.from('coupon_codes').insert(fresh.slice(i, i + 500).map(code => ({ campaign_id: campaign.id, code, max_uses: 1 })))
          if (codeError) throw new Error(codeError.message)
        }
        codes.push(...fresh)
        pending = []
        while (codes.length + pending.length < input.seats) pending.push(`${prefix}-${randomPart(4)}-${randomPart(4)}`)
      }
    }
  } catch (err) {
    await supabase.from('coupon_campaigns').delete().eq('id', campaign.id)
    throw err
  }
  return { id: campaign.id, codes }
}

export type CampaignRow = {
  id: string
  name: string
  organisation: string | null
  mode: 'shared' | 'individual'
  audience: 'new' | 'existing' | 'both'
  tier: PlanId
  plan_options: PlanOptions | null
  free_days: number
  credit_eur: number
  seats: number
  expires_at: string | null
  active: boolean
  archived_at: string | null
  notes: string | null
  created_at: string
}

export type CampaignSummary = CampaignRow & {
  used: number
  sharedCode: string | null
  // What the participants used during their sponsored period: our AI cost
  // and the value at user prices (what they would have paid).
  usageCostEur: number
  usageValueEur: number
}

export async function listCampaigns(archived: boolean): Promise<CampaignSummary[]> {
  const supabase = createServiceClient()
  let q = supabase.from('coupon_campaigns').select('*').order('created_at', { ascending: false }).limit(500)
  q = archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = ((data as CampaignRow[] | null) ?? []).map(r => ({ ...r, credit_eur: Number(r.credit_eur) }))
  if (!rows.length) return []
  const ids = rows.map(r => r.id)
  const [{ data: codes }, usage] = await Promise.all([
    supabase.from('coupon_codes').select('campaign_id, code, uses, max_uses').in('campaign_id', ids).limit(20000),
    Promise.all(rows.map(r => campaignUsage(r.id))),
  ])
  const byCampaign = new Map<string, { used: number; shared: string | null }>()
  for (const c of (codes as { campaign_id: string; code: string; uses: number; max_uses: number }[] | null) ?? []) {
    const cur = byCampaign.get(c.campaign_id) ?? { used: 0, shared: null }
    cur.used += c.uses
    if (c.max_uses > 1 || rows.find(r => r.id === c.campaign_id)?.mode === 'shared') cur.shared = c.code
    byCampaign.set(c.campaign_id, cur)
  }
  return rows.map((r, i) => ({
    ...r,
    used: byCampaign.get(r.id)?.used ?? 0,
    sharedCode: r.mode === 'shared' ? byCampaign.get(r.id)?.shared ?? null : null,
    ...usage[i],
  }))
}

async function campaignUsage(campaignId: string): Promise<{ usageCostEur: number; usageValueEur: number }> {
  const { data } = await createServiceClient().rpc('admin_usage_summary', {
    p_since: '2026-01-01T00:00:00Z',
    p_until: new Date(Date.now() + 86400_000).toISOString(),
    p_campaign: campaignId,
  })
  let cost = 0
  for (const r of (data as { feature: string; model: string; prompt_tokens: number; completion_tokens: number }[] | null) ?? []) {
    cost += rawCostEur(r.model, Number(r.prompt_tokens), Number(r.completion_tokens), r.feature)
  }
  return { usageCostEur: Math.round(cost * 100) / 100, usageValueEur: Math.round(cost * (1 + MARKUP) * 100) / 100 }
}

export async function setCampaign(id: string, patch: { active?: boolean; archived?: boolean }): Promise<void> {
  const supabase = createServiceClient()
  const update: Record<string, unknown> = {}
  if (typeof patch.active === 'boolean') update.active = patch.active
  if (typeof patch.archived === 'boolean') {
    update.archived_at = patch.archived ? new Date().toISOString() : null
    if (patch.archived) update.active = false
  }
  if (!Object.keys(update).length) return
  const { error } = await supabase.from('coupon_campaigns').update(update).eq('id', id)
  if (error) throw new Error(error.message)
}

// Codes of a campaign with who used them (CSV for the organisation).
export async function campaignCodesCsv(id: string): Promise<string> {
  const supabase = createServiceClient()
  const [{ data: codes }, { data: redemptions }] = await Promise.all([
    supabase.from('coupon_codes').select('id, code, uses, max_uses').eq('campaign_id', id).order('code').limit(20000),
    supabase.from('coupon_redemptions').select('code_id, redeemed_at, period_ends_at, user:users!coupon_redemptions_user_id_fkey(username)').eq('campaign_id', id).limit(20000),
  ])
  const byCode = new Map<string, { username: string; at: string; until: string }[]>()
  for (const r of (redemptions as { code_id: string; redeemed_at: string; period_ends_at: string; user: { username: string } | { username: string }[] | null }[] | null) ?? []) {
    const u = Array.isArray(r.user) ? r.user[0] : r.user
    const list = byCode.get(r.code_id) ?? []
    list.push({ username: u?.username ?? '(deleted)', at: r.redeemed_at, until: r.period_ends_at })
    byCode.set(r.code_id, list)
  }
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const lines = ['code,seats,used,used by,used on,period ends']
  for (const c of (codes as { id: string; code: string; uses: number; max_uses: number }[] | null) ?? []) {
    const uses = byCode.get(c.id) ?? []
    if (!uses.length) lines.push([c.code, c.max_uses, c.uses, '', '', ''].join(','))
    for (const u of uses) lines.push([c.code, c.max_uses, c.uses, esc(u.username), u.at.slice(0, 10), u.until.slice(0, 10)].join(','))
  }
  return lines.join('\n') + '\n'
}
