import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { underLimit } from '@/lib/redis'
import { paidUsePause } from '@/lib/usage/gate'
import { SimilarityError } from '@/lib/similarity/compare'
import { cleanTalk, groupTalkReply } from '@/lib/similarity/talk'

// Similarities Chart → a LiAIson to talk to about everyone in the chart
// (lib/similarity/talk.ts). POST { usernames, includeMe, messages } →
// { reply }. Each message is paid by the sender, like any chat message.

export const maxDuration = 45

const PER_HOUR = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in first' }, { status: 401 })

  const body = await request.json().catch(() => null) as { usernames?: unknown; includeMe?: unknown; messages?: unknown } | null
  const messages = cleanTalk(body?.messages)
  if (!messages) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const usernames = (Array.isArray(body?.usernames) ? body.usernames : [])
    .filter((u): u is string => typeof u === 'string' && /^[\w.-]{1,40}$/.test(u))
    .slice(0, 10)

  if (!(await underLimit(`simtalk:${user.id}`, PER_HOUR, 3600))) {
    return NextResponse.json({ error: 'Please wait a little before sending more messages.' }, { status: 429 })
  }
  const pause = await paidUsePause(user.id, { message: true })
  if (pause) return NextResponse.json({ error: pause.error, needsCard: pause.needsCard }, { status: pause.status })

  try {
    const reply = await groupTalkReply(user.id, usernames, body?.includeMe === true, messages)
    return NextResponse.json({ reply }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    if (err instanceof SimilarityError) return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status })
    console.error('SIMILARITY_TALK_ERROR', err)
    return NextResponse.json({ error: 'The LiAIson could not answer right now. Please try again.' }, { status: 500 })
  }
}
