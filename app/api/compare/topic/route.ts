import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { underLimit } from '@/lib/redis'
import { paidUsePause } from '@/lib/usage/gate'
import { SimilarityError } from '@/lib/similarity/compare'
import { topicSummary } from '@/lib/similarity/talk'

// Similarities Chart → Learn More* on a topic (lib/similarity/talk.ts).
// POST { usernames, includeMe, label, people } → { summary }. Paid per use;
// the same topic for unchanged people is reused for free.

export const maxDuration = 30

const PER_HOUR = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const body = await request.json().catch(() => null) as { usernames?: unknown; includeMe?: unknown; label?: unknown; people?: unknown } | null
  const usernames = (Array.isArray(body?.usernames) ? body.usernames : [])
    .filter((u): u is string => typeof u === 'string' && /^[\w.-]{1,40}$/.test(u))
    .slice(0, 10)

  if (!(await underLimit(`simtopic:${user.id}`, PER_HOUR, 3600))) {
    return NextResponse.json({ error: 'Please wait a little before asking again.' }, { status: 429 })
  }
  const pause = await paidUsePause(user.id)
  if (pause) return NextResponse.json({ error: pause.error, needsCard: pause.needsCard }, { status: pause.status })

  try {
    const out = await topicSummary(user.id, usernames, body?.includeMe === true, body?.label, body?.people)
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof SimilarityError) return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status })
    console.error('SIMILARITY_TOPIC_ERROR', err)
    return NextResponse.json({ error: 'Elaborate is not available right now.' }, { status: 500 })
  }
}
