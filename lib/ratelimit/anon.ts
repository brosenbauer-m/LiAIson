import { Redis } from '@upstash/redis'

// Separate limiter for signed-out visitors: max 3 messages per visitor IP
// per profile per 24 hours. Uses its own key prefix ("anonchat:") and does
// NOT touch the existing `chat:${ip}:${userId}` keys in lib/ratelimit/index.ts.

export const ANON_MESSAGE_LIMIT = 3
const WINDOW_SECONDS = 86400 // 24 hours

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

export async function checkAnonMessageLimit(
  ip: string,
  profileUserId: string
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `anonchat:${ip}:${profileUserId}`
  const r = getRedis()

  const current = await r.incr(key)
  if (current === 1) {
    await r.expire(key, WINDOW_SECONDS)
  }

  const remaining = Math.max(0, ANON_MESSAGE_LIMIT - current)
  return { allowed: current <= ANON_MESSAGE_LIMIT, remaining }
}
