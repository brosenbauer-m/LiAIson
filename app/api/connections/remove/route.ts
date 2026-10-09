import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// End a connection.
// - Owner side, body { connectionId }: someone who connected to you loses
//   access (Inner Circle and own circles included). The request is kept as
//   declined, so they can't send a new one (works like a block).
// - Your side, body { username }: you disconnect from someone's LiAIson you
//   were connected to. You can ask again later.
// Both remove the person from the owner's own circles.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function leaveOwnersCircles(service: ReturnType<typeof createServiceClient>, ownerId: string, memberId: string) {
  const { data: circles } = await service.from('custom_circles').select('id').eq('owner_id', ownerId)
  const ids = ((circles as { id: string }[] | null) ?? []).map(c => c.id)
  if (ids.length === 0) return
  const { error } = await service.from('custom_circle_members').delete().eq('member_id', memberId).in('circle_id', ids)
  if (error) throw new Error(error.message)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null) as { connectionId?: unknown; username?: unknown } | null
  const service = createServiceClient()

  try {
    if (typeof body?.connectionId === 'string' && UUID.test(body.connectionId)) {
      const { data: row } = await service
        .from('connection_interests')
        .select('id, from_user_id')
        .eq('id', body.connectionId)
        .eq('to_user_id', user.id)
        .eq('status', 'accepted')
        .maybeSingle<{ id: string; from_user_id: string }>()
      if (!row) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      const { error } = await service
        .from('connection_interests')
        .update({ status: 'declined', in_inner_circle: false })
        .eq('id', row.id)
      if (error) throw new Error(error.message)
      await leaveOwnersCircles(service, user.id, row.from_user_id)
      return NextResponse.json({ removed: true })
    }

    if (typeof body?.username === 'string' && /^[\w.-]{1,40}$/.test(body.username)) {
      const { data: owner } = await service.from('users').select('id').eq('username', body.username).maybeSingle<{ id: string }>()
      if (!owner) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
      const { data, error } = await service
        .from('connection_interests')
        .delete()
        .eq('from_user_id', user.id)
        .eq('to_user_id', owner.id)
        .eq('status', 'accepted')
        .select('id')
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
      await leaveOwnersCircles(service, owner.id, user.id)
      return NextResponse.json({ removed: true })
    }
  } catch (err) {
    console.error('CONNECTION_REMOVE_ERROR', err)
    return NextResponse.json({ error: 'Could not remove the connection. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
}
