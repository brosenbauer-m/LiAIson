import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'

// Circles page: move people into one circle (drag and drop or "Move to").
// Body: { memberIds: string[] (user ids), target: 'outer' | 'inner' | <own circle id> }
// A move puts each person in exactly that circle: Inner Circle on/off, and out
// of every other own circle. Through the hierarchy they still see every circle
// around it (lib/access/resolveScope.ts). Only accepted connections are moved.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null) as { memberIds?: unknown; target?: unknown } | null
  const memberIds = body?.memberIds
  const target = body?.target
  if (
    !Array.isArray(memberIds) || memberIds.length === 0 || memberIds.length > 500 ||
    memberIds.some(id => typeof id !== 'string' || !UUID.test(id)) ||
    (target !== 'outer' && target !== 'inner' && (typeof target !== 'string' || !UUID.test(target)))
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient()
  const limits = await getPlanLimits(user.id)
  if (limits.circles !== 2) return NextResponse.json({ error: 'Circles are part of the higher tiers.', locked: true }, { status: 403 })

  const { data: own } = await service.from('custom_circles').select('id').eq('owner_id', user.id)
  const ownIds = ((own as { id: string }[] | null) ?? []).map(c => c.id)
  if (target !== 'outer' && target !== 'inner') {
    if (limits.extraCircles <= 0) return NextResponse.json({ error: 'Your own circles are part of Social Butterfly.', locked: true }, { status: 403 })
    if (!ownIds.includes(target)) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
  }

  // Only people with an accepted connection to the owner.
  const { data: connections } = await service
    .from('connection_interests')
    .select('from_user_id')
    .eq('to_user_id', user.id)
    .eq('status', 'accepted')
    .in('from_user_id', memberIds as string[])
  const ids = ((connections as { from_user_id: string }[] | null) ?? []).map(c => c.from_user_id)
  if (ids.length === 0) return NextResponse.json({ error: 'Only your connections can be moved.' }, { status: 400 })

  const { error: innerError } = await service
    .from('connection_interests')
    .update({ in_inner_circle: target === 'inner' })
    .eq('to_user_id', user.id)
    .eq('status', 'accepted')
    .in('from_user_id', ids)
  if (innerError) return NextResponse.json({ error: 'Could not move them. Please try again.' }, { status: 500 })

  if (ownIds.length > 0) {
    const { error } = await service.from('custom_circle_members').delete().in('circle_id', ownIds).in('member_id', ids)
    if (error) return NextResponse.json({ error: 'Could not move them. Please try again.' }, { status: 500 })
  }
  if (target !== 'outer' && target !== 'inner') {
    const { error } = await service
      .from('custom_circle_members')
      .upsert(ids.map(member_id => ({ circle_id: target, member_id })), { onConflict: 'circle_id,member_id', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: 'Could not move them. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ moved: ids })
}
