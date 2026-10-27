import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { underLimit } from '@/lib/redis'
import { paidUsePause } from '@/lib/usage/gate'
import { createInterestMap, getInterestMap, InterestMapError } from '@/lib/interests/map'
import { getPlanLimits } from '@/lib/billing/plan'

// Interest map on a LiAIson page (lib/interests/map.ts). Signed-in only;
// built only from what the viewer may see.
// Ambivert and up only (owner decision 2026-10-27; the viewer's tier).
// GET → { topics: [{label, score}] | null, empty }  (null = not made yet)
// POST → { topics } (the viewer pays when a new map is made)

export const maxDuration = 30

const PER_HOUR = 20

async function locked(viewerId: string): Promise<boolean> {
  return (await getPlanLimits(viewerId)).id === 'introvert'
}

async function owner(username: string) {
  const { data } = await createServiceClient().from('users').select('id').eq('username', username).maybeSingle<{ id: string }>()
  return data
}

export async function GET(_request: NextRequest, props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const target = await owner(username)
  if (!target) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (await locked(user.id)) return NextResponse.json({ error: 'Part of Ambivert and up.', locked: true }, { status: 403 })
  try {
    return NextResponse.json(await getInterestMap(target.id, user.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof InterestMapError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('INTEREST_MAP_READ_ERROR', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function POST(_request: NextRequest, props: { params: Promise<{ username: string }> }) {
  const { username } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })
  const target = await owner(username)
  if (!target) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (await locked(user.id)) return NextResponse.json({ error: 'Part of Ambivert and up.', locked: true }, { status: 403 })

  if (!(await underLimit(`imap:${user.id}`, PER_HOUR, 3600))) {
    return NextResponse.json({ error: 'Please wait a little before trying again.' }, { status: 429 })
  }
  const pause = await paidUsePause(user.id)
  if (pause) return NextResponse.json({ error: pause.error, needsCard: pause.needsCard }, { status: pause.status })

  try {
    const { topics } = await createInterestMap(target.id, user.id)
    return NextResponse.json({ topics }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof InterestMapError) return NextResponse.json({ error: err.message }, { status: err.status })
    console.error('INTEREST_MAP_ERROR', err)
    return NextResponse.json({ error: 'This is not available right now. Please try again.' }, { status: 500 })
  }
}
