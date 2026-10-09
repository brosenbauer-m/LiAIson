import { Redis } from '@upstash/redis'

// Redis for Discover search (index locks and limits). Own keys only
// (searchidx:*, searchq:*, simq:* for Similarity); never touches the chat rate-limit keys.
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
