import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { allowedPlacement, connectBothWays } from '@/lib/connections/placement'

// Accept or ignore a connection request. Body { connectionId, accept,
// placement? } (placement = where you put the person: 'outer', 'inner' or an
// own circle id; `inner: true` is still understood). Accepting connects both
// ways (migration 36): the requester lands in your chosen circle and you in
// the circle they chose when asking.

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { connectionId, accept, inner, placement } = (await request.json().catch(() => ({}))) as { connectionId?: unknown; accept?: unknown; inner?: unknown; placement?: unknown }

  if (typeof connectionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(connectionId) || typeof accept !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  const { data: connection } = await serviceSupabase
    .from('connection_interests')
    .select('id, from_user_id, to_user_id, status, requester_placement')
    .eq('id', connectionId)
    .maybeSingle<{ id: string; from_user_id: string; to_user_id: string; status: string; requester_placement: string | null }>()

  if (!connection || connection.to_user_id !== user.id || connection.status !== 'pending') {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  if (accept) {
    try {
      const mine = await allowedPlacement(user.id, placement ?? (inner === true ? 'inner' : 'outer'))
      const theirs = await allowedPlacement(connection.from_user_id, connection.requester_placement)
      await connectBothWays(user.id, connection.from_user_id, mine, theirs)
      const { data: me } = await serviceSupabase.from('users').select('display_name').eq('id', user.id).maybeSingle<{ display_name: string }>()
      await serviceSupabase.from('notifications').insert({
        user_id: connection.from_user_id,
        type: 'connection_match',
        message: `${me?.display_name ?? 'Someone'} accepted your connection request.`,
        metadata: { connection_id: connectionId },
        read: false,
      })
    } catch {
      return NextResponse.json({ error: 'Failed to respond to connection request' }, { status: 500 })
    }
  } else {
    const { error: updateError } = await serviceSupabase
      .from('connection_interests')
      .update({ status: 'declined' })
      .eq('id', connectionId)
    if (updateError) {
      return NextResponse.json({ error: 'Failed to respond to connection request' }, { status: 500 })
    }
  }

  const { error: notificationError } = await serviceSupabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .filter('metadata->>connection_id', 'eq', connectionId)

  if (notificationError) {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }

  return NextResponse.json({ status: accept ? 'accepted' : 'declined' })
}
