import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRedis } from '@/lib/search/redis'
import { needsCard } from '@/lib/billing/access'
import {
  compareWith,
  getCachedSimilarity,
  getSimilarityQuota,
  SimilarityError,
} from '@/lib/similarity/compare'

// Similarity with one person (Extrovert; see lib/similarity/compare.ts).
// GET  → { quota, used, result } — result only when a kept one is still up to date (no AI).
// POST → { result, quota, used } — works it out when needed (counts towards the monthly limit).
// Sign-in required. Only what the viewer may see of the other person is used.

export const maxDuration = 30

const PER_MINUTE = 5

async function load(username: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Sign in to compare' }, { status: 401 }) }
  const { data: target } = await createServiceClient()
    .from('users')
    .select('id, display_name')
    .eq('username', username)
    .maybeSingle<{ id: string; display_name: string }>()
  if (!target) return { error: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) }
  return { viewerId: user.id, target }
}

export async function GET(_request: NextRequest, props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const loaded = await load(username)
  if ('error' in loaded) return loaded.error
  try {
    const { quota, used } = await getSimilarityQuota(loaded.viewerId)
    const result = quota > 0 ? await getCachedSimilarity(loaded.viewerId, loaded.target.id, loaded.target.display_name) : null
    return NextResponse.json({ quota, used, result }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(_request: NextRequest, props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const loaded = await load(username)
  if ('error' in loaded) return loaded.error

  // Free month ended without a saved card: same lock as the rest of the app.
  if (await needsCard(loaded.viewerId).catch(() => false)) {
    return NextResponse.json({ error: 'Add a payment method in Settings to keep using LiAIson.', needsCard: true }, { status: 402 })
  }

  // A few comparisons per minute at most (double clicks and scripts).
  try {
    const r = getRedis()
    const key = `simq:${loaded.viewerId}`
    const n = await r.incr(key)
    if (n === 1) await r.expire(key, 60)
    if (n > PER_MINUTE) {
      return NextResponse.json({ error: 'Please wait a minute before comparing again.' }, { status: 429 })
    }
  } catch {
    // Redis unavailable: the monthly limit still applies.
  }

  try {
    const { result, quota } = await compareWith(loaded.viewerId, loaded.target.id, loaded.target.display_name)
    return NextResponse.json({ result, quota: quota.quota, used: quota.used }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof SimilarityError) {
      return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status })
    }
    console.error('SIMILARITY_ERROR', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
