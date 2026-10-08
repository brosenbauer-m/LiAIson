import { createServiceClient } from '@/lib/supabase/service'
import { CHAT_MODEL, FAST_MODEL } from '@/lib/mistral/client'
import { currentPeriod } from '@/lib/insights/periods'

// Pay-as-you-go foundation: what a user's own messages cost this month, and
// whether they have reached their monthly spending limit. The sender of a
// message pays for it; nobody pays for others chatting with their LiAIson.
//
// Prices: Mistral EUR prices per 1M tokens for EU regional inference
// (docs.mistral.ai/inference/pricing, checked 2026-10-08; Mistral bills us in EUR):
// Medium 3.5 = €1.4025 in / €7.0125 out, Small 4 = €0.14025 in / €0.561 out.
// Cached-input discounts are not counted yet (safe side).
// No payments are taken yet; this only measures and enforces the limit.

const PRICES_EUR_PER_MILLION: Record<string, { input: number; output: number }> = {
  [CHAT_MODEL]: { input: 1.4025, output: 7.0125 },
  [FAST_MODEL]: { input: 0.14025, output: 0.561 },
}
const FALLBACK_PRICE = PRICES_EUR_PER_MILLION[CHAT_MODEL]

// Features billed pay-as-you-go (to the sender). 'topic' is legacy (no longer
// produced). Insight capture and Echoes ('insight', 'echo') are logged to the
// LiAIson owner but belong to the Echoes feature subscription, so not metered.
const METERED_FEATURES = new Set(['chat', 'topic'])

export const DEFAULT_SPEND_LIMIT_CENTS = 1500
export const MAX_SPEND_LIMIT_CENTS = 50000

type UsageRow = {
  feature: string
  model: string
  calls: number | string
  prompt_tokens: number | string
  completion_tokens: number | string
}

export type MonthUsage = {
  messages: number
  costCents: number
  periodStart: string
  periodEnd: string
}

export async function getMonthUsage(userId: string): Promise<MonthUsage> {
  const period = currentPeriod('month')
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('ai_usage_since', {
    p_user_id: userId,
    p_since: period.start.toISOString(),
  })
  if (error) throw new Error(error.message)

  let messages = 0
  let costEur = 0
  for (const row of (data ?? []) as UsageRow[]) {
    if (row.feature === 'chat') messages += Number(row.calls) || 0
    if (!METERED_FEATURES.has(row.feature)) continue
    const price = PRICES_EUR_PER_MILLION[row.model] ?? FALLBACK_PRICE
    costEur +=
      ((Number(row.prompt_tokens) || 0) / 1_000_000) * price.input +
      ((Number(row.completion_tokens) || 0) / 1_000_000) * price.output
  }

  return {
    messages,
    costCents: Math.round(costEur * 100 * 100) / 100,
    periodStart: period.start.toISOString(),
    periodEnd: period.end.toISOString(),
  }
}

export async function getSpendLimitCents(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('monthly_spend_limit_cents')
    .eq('id', userId)
    .single<{ monthly_spend_limit_cents: number | null }>()
  if (error || !data || typeof data.monthly_spend_limit_cents !== 'number') {
    return DEFAULT_SPEND_LIMIT_CENTS
  }
  return data.monthly_spend_limit_cents
}

// True when this month's metered usage has reached the user's own limit.
// Fails open (returns false) if usage cannot be read, so a database problem
// never takes every LiAIson offline.
export async function isOverSpendLimit(userId: string): Promise<boolean> {
  try {
    const [usage, limitCents] = await Promise.all([getMonthUsage(userId), getSpendLimitCents(userId)])
    return usage.costCents >= limitCents
  } catch (err) {
    console.error('SPEND_LIMIT_CHECK_ERROR', err)
    return false
  }
}
