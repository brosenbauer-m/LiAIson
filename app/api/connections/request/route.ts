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

  const { toUserId } = await request.json()

  if (!toUserId || toUserId === user.id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
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