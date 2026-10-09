import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSearchQuota, searchPeople } from '@/lib/search/search'
import { underLimit } from '@/lib/redis'

// Discover AI search: find people by what they share.
// GET  → { quota, used } for the signed-in user (quota 0 = not in their plan).
// POST { q } → { results, quota, used }. Sign-in required; monthly quota per plan.
// Only the Outer Circle of Public + Discoverable profiles is searched, and
// results never contain Vault text (see lib/search/search.ts).

export const maxDuration = 30

const MIN_QUERY = 3
const MAX_QUERY = 200
const PER_MINUTE = 5

async function signedInUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  const userId = await signedInUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in to search' }, { status: 401 })
  try {
    const { quota, used } = await getSearchQuota(userId)
    return NextResponse.json({ quota, used }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await signedInUserId()
  if (!userId) return NextResponse.json({ error: 'Sign in to search' }, { status: 401 })

  const body = await request.json().catch(() => null) as { q?: unknown } | null
  const q = typeof body?.q === 'string' ? body.q.replace(/\s+/g, ' ').trim() : ''
  if (q.length < MIN_QUERY || q.length > MAX_QUERY) {
    return NextResponse.json({ error: `Please write between ${MIN_QUERY} and ${MAX_QUERY} characters.` }, { status: 400 })
  }

  let quota: number
  let used: number
  try {
    ({ quota, used } = await getSearchQuota(userId))
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
  if (quota <= 0) {
    return NextResponse.json({ error: 'Searching by what people share is part of Ambivert and Extrovert.', locked: true, quota, used }, { status: 403 })
  }
  if (used >= quota) {
    return NextResponse.json({ error: `You have used all ${quota} searches for this month.`, quotaReached: true, quota, used }, { status: 429 })
  }

  // A few searches per minute at most (protects the AI quota from double clicks
  // and scripts). Redis unavailable: the monthly quota still applies.
  if (!(await underLimit(`searchq:${userId}`, PER_MINUTE, 60))) {
    return NextResponse.json({ error: 'Please wait a minute before searching again.' }, { status: 429 })
  }

  try {
    const results = await searchPeople(userId, q)
    const after = await getSearchQuota(userId).catch(() => ({ quota, used: used + 1 }))
    return NextResponse.json({ results, quota: after.quota, used: after.used }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('SEARCH_ERROR', err)
    return NextResponse.json({ error: 'Search failed. Please try again.' }, { status: 500 })
  }
}
