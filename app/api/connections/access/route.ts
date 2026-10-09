import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// Owner moves accepted connections into or out of their Inner Circle.
// Body: { connectionIds: string[], inner: boolean }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { connectionIds, inner } = await request.json()

  if (
    typeof inner !== 'boolean' ||
    !Array.isArray(connectionIds) ||
    connectionIds.length === 0 ||
    connectionIds.length > 200 ||
    connectionIds.some(id => typeof id !== 'string')
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const serviceSupabase = createServiceClient()
  const { data, error } = await serviceSupabase
    .from('connection_interests')
    .update({ in_inner_circle: inner })
    .in('id', connectionIds)
    .eq('to_user_id', user.id)
    .eq('status', 'accepted')
    .select('id')

  if (error) {
    return NextResponse.json({ error: 'Failed to update connection access' }, { status: 500 })
  }

  return NextResponse.json({ updated: data?.length ?? 0 })
}
