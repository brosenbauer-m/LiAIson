import { createServiceClient } from '@/lib/supabase/service'
import { CHAT_MODEL, FAST_MODEL } from '@/lib/mistral/client'
import { currentPeriod } from '@/lib/insights/periods'
import { getBalanceEur } from '@/lib/billing/topup'

// Pay-as-you-go foundation: what a user's own messages cost this month, and
// whether they have reached their monthly spending limit. The sender of a
// message pays for it; nobody pays for others chatting with their LiAIson.
//
// Prices: Mistral EUR prices per 1M tokens for EU regional inference
// (docs.mistral.ai/inference/pricing, checked 2026-10-08; Mistral bills us in EUR):
// Medium 3.5 = €1.4025 in / €7.0125 out, Small 4 = €0.14025 in / €0.561 out.
// Cached-input discounts are not counted yet (safe side).
// Users pay the AI cost + MARKUP (owner decision: cost + 30%); costCents below
// and the spending limit are always the price incl. markup.
// No payments are taken yet; this only measures and enforces the limit.

const PRICES_EUR_PER_MILLION: Record<string, { input: number; output: number }> = {
  [CHAT_MODEL]: { input: 1.4025, output: 7.0125 },
  [FAST_MODEL]: { input: 0.14025, output: 0.561 },
}
const FALLBACK_PRICE = PRICES_EUR_PER_MILLION[CHAT_MODEL]

// Voice (Mistral Voxtral, 2026-10-27) is priced per second of audio heard and
// per character read aloud, whichever Voxtral model is set (lib/voice/server.ts).
// Prices from Mistral's announcements, taking the higher published figure
// (safe side), USD × 0.935 like the token prices above:
// transcription $0.004/min, read-aloud $16 per 1M characters.
// To confirm on docs.mistral.ai/inference/pricing.
const VOICE_PRICES_EUR_PER_MILLION_UNITS: Record<string, number> = {
  voice_transcribe: (0.004 * 0.935 / 60) * 1_000_000, // per million seconds
  voice_speech: 16 * 0.935, // per million characters
}

export const MARKUP = 0.3

// Raw AI cost in EUR of one call (or a sum of calls) for a model. For voice
// features promptTokens is seconds or characters (lib/usage/log.ts).
export function rawCostEur(model: string, promptTokens: number, completionTokens: number, feature?: string): number {
  const voice = feature ? VOICE_PRICES_EUR_PER_MILLION_UNITS[feature] : undefined
  if (voice !== undefined) return ((promptTokens || 0) / 1_000_000) * voice
  const price = PRICES_EUR_PER_MILLION[model] ?? FALLBACK_PRICE
  return ((promptTokens || 0) / 1_000_000) * price.input + ((completionTokens || 0) / 1_000_000) * price.output
}

export function isMeteredFeature(feature: string): boolean {
  return METERED_FEATURES.has(feature)
}

// Features billed pay-as-you-go (to the sender / the person using them):
// chat messages (incl. the Similarities LiAIson), Vault Optimize Text (logged as 'proofread') and Learn More on the Similarities Chart ('similarity_topic'). 'topic' = the interest map on a LiAIson page (2026-10-27; earlier a legacy feature). Insight capture and Echoes ('insight', 'echo') are logged to the
// LiAIson owner but belong to the Echoes feature subscription, so not metered.
// Voice in the chat ('voice_transcribe', 'voice_speech') is paid by the person speaking / listening.
export const METERED_FEATURE_LIST = ['chat', 'topic', 'proofread', 'similarity_topic', 'voice_transcribe', 'voice_speech'] as const
const METERED_FEATURES = new Set<string>(METERED_FEATURE_LIST)

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
    costEur += rawCostEur(row.model, Number(row.prompt_tokens) || 0, Number(row.completion_tokens) || 0, row.feature)
  }
  costEur *= 1 + MARKUP

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

// True when this month's metered usage has reached the user's own limit and
// their credit balance doesn't cover more (owner decision 2026-10-10: adding
// credit lets people keep sending beyond the limit, up to the credit).
// Fails open (returns false) if usage cannot be read, so a database problem
// never takes every LiAIson offline.
export async function isOverSpendLimit(userId: string): Promise<boolean> {
  try {
    const [usage, limitCents, creditEur] = await Promise.all([
      getMonthUsage(userId),
      getSpendLimitCents(userId),
      getBalanceEur(userId).catch(() => 0),
    ])
    return usage.costCents >= limitCents + Math.max(0, creditEur) * 100
  } catch (err) {
    console.error('SPEND_LIMIT_CHECK_ERROR', err)
    return false
  }
}
