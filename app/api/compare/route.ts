import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { underLimit } from '@/lib/redis'
import { needsCard } from '@/lib/billing/access'
import { getPlanLimits } from '@/lib/billing/plan'
import { getSimilarityQuota, SimilarityError } from '@/lib/similarity/compare'
import { compareGroup, getCachedGroup } from '@/lib/similarity/group'

// Compare yourself with several people at once (Social Butterfly; see
// lib/similarity/group.ts).
// GET ?u=a,b&me=1 → { groupCompare, quota, used, me, candidates, people?, result? }
//   candidates = people whose profile the viewer reached through an accepted
//   connection request; result only when a kept one is still up to date (no AI).
// POST { usernames, includeMe } → { people, result, quota, used }. The viewer
// is part of the chart only with includeMe (off by default).

export const maxDuration = 45

const PER_MINUTE = 5

function parseUsernames(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return list.filter((u): u is string => typeof u === 'string').map(u => u.trim()).filter(u => /^[\w.-]{1,40}$/.test(u)).slice(0, 10)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to compare' }, { status: 401 })
  try {
    const service = createServiceClient()
    const [limits, quota, { data: rows }, { data: me }] = await Promise.all([
      getPlanLimits(user.id),
      getSimilarityQuota(user.id),
      service
        .from('connection_interests')
        .select('to_user:users!connection_interests_to_user_id_fkey(username, display_name, avatar_url, plan)')
        .eq('from_user_id', user.id)
        .eq('status', 'accepted')
        .limit(500),
      service.from('users').select('display_name, avatar_url').eq('id', user.id).maybeSingle<{ display_name: string; avatar_url: string | null }>(),
    ])
    type Candidate = { username: string; display_name: string; avatar_url: string | null; plan: string | null }
    const candidates = ((rows as { to_user: Candidate | Candidate[] | null }[] | null) ?? [])
      .map(r => (Array.isArray(r.to_user) ? r.to_user[0] : r.to_user))
      .filter((c): c is Candidate => !!c)
      .sort((a, b) => a.display_name.localeCompare(b.display_name))
    const usernames = parseUsernames(request.nextUrl.searchParams.get('u'))
    const includeMe = request.nextUrl.searchParams.get('me') === '1'
    const cached = limits.groupCompare >= 2 && usernames.length >= 2 ? await getCachedGroup(user.id, usernames, includeMe) : null
    return NextResponse.json(
      {
        groupCompare: limits.groupCompare,
        quota: quota.quota,
        used: quota.used,
        me: { name: me?.display_name ?? 'You', avatarUrl: me?.avatar_url ?? null },
        candidates,
        people: cached?.people ?? null,
        result: cached?.result ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to compare' }, { status: 401 })

  if (await needsCard(user.id).catch(() => false)) {
    return NextResponse.json({ error: 'Add a payment method in Settings to keep using LiAIson.', needsCard: true }, { status: 402 })
  }

  if (!(await underLimit(`simq:${user.id}`, PER_MINUTE, 60))) {
    return NextResponse.json({ error: 'Please wait a minute before comparing again.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null) as { usernames?: unknown; includeMe?: unknown } | null
  try {
    const out = await compareGroup(user.id, parseUsernames(body?.usernames), body?.includeMe === true)
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof SimilarityError) return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status })
    console.error('SIMILARITY_GROUP_ERROR', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
