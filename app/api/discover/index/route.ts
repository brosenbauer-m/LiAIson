import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { indexUser } from '@/lib/search/indexer'
import { getRedis } from '@/lib/search/redis'

// Refresh the signed-in user's own Discover search index after they change
// their Vault or their Public / Discoverable settings. Only their own data.
// Privacy never depends on this call: searches re-check every passage in the
// database, and a daily sweep (billing cron) catches anything missed.

const PER_HOUR = 60

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const r = getRedis()
    const key = `searchidx:calls:${user.id}`
    const n = await r.incr(key)
    if (n === 1) await r.expire(key, 3600)
    if (n > PER_HOUR) return NextResponse.json({ ok: false, later: true }, { status: 202 })
  } catch {
    // Redis unavailable: still index (only changed sections cost anything).
  }

  waitUntil(indexUser(user.id))
  return NextResponse.json({ ok: true }, { status: 202 })
}
