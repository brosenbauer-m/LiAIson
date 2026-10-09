import { Redis } from '@upstash/redis'

// One Upstash Redis client for the whole app. Key prefixes in use:
// chat:* (chat rate limit, lib/ratelimit), searchidx:* / searchq:* / searchcache:*
// (Discover), simq:* (Similarity), connreq:* (connection requests).
let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    })
  }
  return redis
}

// Fixed-window counter: true while `key` has been hit at most `limit` times in
// the current window. Fails open (true) when Redis is unavailable.
export async function underLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const r = getRedis()
    const n = await r.incr(key)
    if (n === 1) await r.expire(key, windowSeconds)
    return n <= limit
  } catch {
    return true
  }
}
