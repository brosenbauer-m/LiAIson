import { Redis } from '@upstash/redis'
import { createServiceClient } from '@/lib/supabase/service'

// Free trial limits (owner decisions 2026-10-08). The person who sends a
// message pays for it, so these limits apply to the SENDER:
// - during the free month: max 3 messages per day to each LiAIson and max 15
//   messages per day in total (calendar day, Europe/Vienna);
// - after the free month: no messages until a payment method is added
//   (payments are not built yet).
// Accounts marked billing_exempt have no trial limits.
// Uses its own key prefix ("trialchat:") and does NOT touch the existing
// `chat:${ip}:${userId}` keys in lib/ratelimit/index.ts.

export const TRIAL_PER_LIAISON_DAILY = 3
export const TRIAL_TOTAL_DAILY = 15
const KEY_TTL_SECONDS = 2 * 86400

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  }
  return redis
}

function viennaDay(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(now)
}

export type SenderPlan =
  | { kind: 'exempt' }
  | { kind: 'trial'; trialEndsAt: string }
  | { kind: 'trial_ended' }

// Reads the sender's billing status. If it can't be read, the sender is treated
// as being in the trial (limits apply), never as exempt.
export async function getSenderPlan(senderId: string): Promise<SenderPlan> {
  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('users')
      .select('billing_exempt, trial_ends_at')
      .eq('id', senderId)
      .single<{ billing_exempt: boolean; trial_ends_at: string }>()
    if (error || !data) return { kind: 'trial', trialEndsAt: '' }
    if (data.billing_exempt === true) return { kind: 'exempt' }
    const ends = new Date(data.trial_ends_at)
    if (!Number.isNaN(ends.getTime()) && ends.getTime() <= Date.now()) return { kind: 'trial_ended' }
    return { kind: 'trial', trialEndsAt: data.trial_ends_at }
  } catch {
    return { kind: 'trial', trialEndsAt: '' }
  }
}

// Checks and, if allowed, counts one trial message from senderId to the
// LiAIson of profileUserId.
export async function checkTrialMessageLimit(
  senderId: string,
  profileUserId: string
): Promise<{ allowed: boolean; reason?: 'per_liaison' | 'total' }> {
  const day = viennaDay()
  const perKey = `trialchat:${senderId}:${profileUserId}:${day}`
  const totalKey = `trialchat:${senderId}:all:${day}`
  const r = getRedis()

  const [perRaw, totalRaw] = await r.mget<(number | string | null)[]>(perKey, totalKey)
  const per = Number(perRaw) || 0
  const total = Number(totalRaw) || 0
  if (total >= TRIAL_TOTAL_DAILY) return { allowed: false, reason: 'total' }
  if (per >= TRIAL_PER_LIAISON_DAILY) return { allowed: false, reason: 'per_liaison' }

  const p = r.pipeline()
  p.incr(perKey)
  p.expire(perKey, KEY_TTL_SECONDS)
  p.incr(totalKey)
  p.expire(totalKey, KEY_TTL_SECONDS)
  await p.exec()
  return { allowed: true }
}
