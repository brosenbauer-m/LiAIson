import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

type AccessScope = 'professional' | 'personal' | 'both'

const ACCEPTED_SCOPES: AccessScope[] = ['professional', 'personal', 'both']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { connectionId, accept, scope } = await request.json()

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

  let update: { status: 'accepted' | 'declined'; allowed_scope?: 'none' | AccessScope }

  if (!accept) {
    update = { status: 'declined' }
  } else {
    const { data: owner, error: ownerError } = await serviceSupabase
      .from('users')
      .select('public_scope')
      .eq('id', user.id)
      .single()

    if (ownerError || !owner) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 500 })
    }

    if (owner.public_scope === 'both') {
      update = { status: 'accepted', allowed_scope: 'both' }
    } else {
      if (typeof scope !== 'string' || !ACCEPTED_SCOPES.includes(scope as AccessScope)) {
        return NextResponse.json({ error: 'A valid access scope is required' }, { status: 400 })
      }
      update = { status: 'accepted', allowed_scope: scope as AccessScope }
    }
  }

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
