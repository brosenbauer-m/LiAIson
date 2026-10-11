import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { underLimit } from '@/lib/redis'
import { allowedPlacement, connectBothWays } from '@/lib/connections/placement'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Connection requests per person per hour (each one notifies someone).
const PER_HOUR = 30

// Body { toUserId, placement? }: placement = the circle the requester puts the
// other person in once they accept ('outer', 'inner' or an own circle id;
// ignored on one-circle tiers). If the other person already asked you, this
// accepts both ways at once (connections go both ways, migration 36).

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { toUserId?: unknown; placement?: unknown } | null
  const toUserId = body?.toUserId
  if (typeof toUserId !== 'string' || !UUID.test(toUserId) || toUserId === user.id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!(await underLimit(`connreq:${user.id}`, PER_HOUR, 3600))) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  const serviceSupabase = createServiceClient()
  const { data: targetUser } = await serviceSupabase
    .from('users')
    .select('id')
    .eq('id', toUserId)
    .maybeSingle()

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: existing, error: existingError } = await serviceSupabase
    .from('connection_interests')
    .select('id, status')
    .eq('from_user_id', user.id)
    .eq('to_user_id', toUserId)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: 'Failed to check connection request' }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ status: existing.status === 'accepted' ? 'connected' : 'requested' })
  }

  const placement = await allowedPlacement(user.id, body?.placement)

  // They already asked you: accept both ways now.
  const { data: theirs } = await serviceSupabase
    .from('connection_interests')
    .select('id, status, requester_placement')
    .eq('from_user_id', toUserId)
    .eq('to_user_id', user.id)
    .maybeSingle<{ id: string; status: string; requester_placement: string | null }>()
  if (theirs?.status === 'pending') {
    try {
      await connectBothWays(user.id, toUserId, placement, await allowedPlacement(toUserId, theirs.requester_placement))
    } catch {
      return NextResponse.json({ error: 'Failed to connect' }, { status: 500 })
    }
    await serviceSupabase.from('notifications').update({ read: true }).eq('user_id', user.id).filter('metadata->>connection_id', 'eq', theirs.id)
    return NextResponse.json({ status: 'connected' })
  }

  const { data: requester, error: requesterError } = await serviceSupabase
    .from('users')
    .select('display_name, username')
    .eq('id', user.id)
    .single()

  if (requesterError || !requester) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 500 })
  }

  const { data: connection, error: insertError } = await serviceSupabase
    .from('connection_interests')
    .insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      status: 'pending',
      allowed_scope: 'none',
      requester_placement: placement,
    })
    .select('id')
    .single()

  if (insertError || !connection) {
    return NextResponse.json({ error: 'Failed to create connection request' }, { status: 500 })
  }

  const { error: notificationError } = await serviceSupabase
    .from('notifications')
    .insert({
      user_id: toUserId,
      type: 'connection_interest',
      message: `${requester.display_name} (@${requester.username}) wants to connect with you.`,
      metadata: { connection_id: connection.id, from_user_id: user.id },
      read: false,
    })

  if (notificationError) {
    return NextResponse.json({ error: 'Failed to notify user' }, { status: 500 })
  }

  return NextResponse.json({ status: 'requested' })
}