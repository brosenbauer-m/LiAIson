import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createClient } from '@/lib/supabase/server'
import { indexUser } from '@/lib/search/indexer'
import { underLimit } from '@/lib/redis'

// Refresh the signed-in user's own Discover search index after they change
// their Vault or their Public / Discoverable settings. Only their own data.
// Privacy never depends on this call: searches re-check every passage in the
// database, and a daily sweep (billing cron) catches anything missed.

const PER_HOUR = 60

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Redis unavailable: still index (only changed sections cost anything).
  if (!(await underLimit(`searchidx:calls:${user.id}`, PER_HOUR, 3600))) {
    return NextResponse.json({ ok: false, later: true }, { status: 202 })
  }

  waitUntil(indexUser(user.id))
  return NextResponse.json({ ok: true }, { status: 202 })
}
