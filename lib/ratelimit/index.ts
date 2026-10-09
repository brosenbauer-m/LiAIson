import { getRedis } from '@/lib/redis'

export async function checkRateLimit(
  ip: string,
  userId: string,
  limit = 15
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `chat:${ip}:${userId}`
  const r = getRedis()

  const current = await r.incr(key)
  if (current === 1) {
    await r.expire(key, 86400) // 24 hours
  }

  const remaining = Math.max(0, limit - current)
  return { allowed: current <= limit, remaining }
}
