import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // inner: put the person in the owner's Inner Circle (lib/circles.ts).
  const { connectionId, accept, inner } = await request.json()

  if (!connectionId || typeof accept !== 'boolean') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  const { data: connection } = await serviceSupabase
    .from('connection_interests')
    .select('id, to_user_id, status')
    .eq('id', connectionId)
    .maybeSingle()

  if (!connection || connection.to_user_id !== user.id || connection.status !== 'pending') {
    return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  }

  // allowed_scope is kept at 'both' for old code paths only; access now
  // comes from the circle (in_inner_circle), see lib/access/resolveScope.ts.
  const update: { status: 'accepted' | 'declined'; allowed_scope?: 'both'; in_inner_circle?: boolean } = accept
    ? { status: 'accepted', allowed_scope: 'both', in_inner_circle: inner === true }
    : { status: 'declined' }

  const { error: updateError } = await serviceSupabase
    .from('connection_interests')
    .update(update)
    .eq('id', connectionId)

  if (updateError) {
    return NextResponse.json({ error: 'Failed to respond to connection request' }, { status: 500 })
  }

  const { error: notificationError } = await serviceSupabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .filter('metadata->>connection_id', 'eq', connectionId)

  if (notificationError) {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 })
  }

  return NextResponse.json({ status: update.status })
}
