import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ status: 'signed_out' })
  }

  const username = request.nextUrl.searchParams.get('username')
  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  const { data: targetUser } = await serviceSupabase
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  if (targetUser.id === user.id) {
    return NextResponse.json({ status: 'self' })
  }

  const { data: connection, error } = await serviceSupabase
    .from('connection_interests')
    .select('status')
    .eq('from_user_id', user.id)
    .eq('to_user_id', targetUser.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Failed to check connection status' }, { status: 500 })
  }

  if (!connection) {
    return NextResponse.json({ status: 'none' })
  }

  return NextResponse.json({ status: connection.status === 'accepted' ? 'connected' : 'requested' })
}