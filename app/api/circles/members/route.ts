import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'

// Owner adds people to / removes them from one of their own circles.
// Body: { circleId, memberIds: string[], member: boolean }
// Only accepted connections (people who can already see the profile) can be
// added; resolveCircles checks the connection again on every visit.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null) as { circleId?: unknown; memberIds?: unknown; member?: unknown } | null
  const circleId = body?.circleId
  const memberIds = body?.memberIds
  if (
    typeof circleId !== 'string' || !UUID.test(circleId) ||
    typeof body?.member !== 'boolean' ||
    !Array.isArray(memberIds) || memberIds.length === 0 || memberIds.length > 200 ||
    memberIds.some(id => typeof id !== 'string' || !UUID.test(id))
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: circle } = await service
    .from('custom_circles')
    .select('id')
    .eq('id', circleId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })

  if (!body.member) {
    const { error } = await service.from('custom_circle_members').delete().eq('circle_id', circleId).in('member_id', memberIds)
    if (error) return NextResponse.json({ error: 'Could not update the circle. Please try again.' }, { status: 500 })
    return NextResponse.json({ updated: memberIds.length })
  }

  const limits = await getPlanLimits(user.id)
  if (limits.extraCircles <= 0) {
    return NextResponse.json({ error: 'Your own circles are part of Social Butterfly.', locked: true }, { status: 403 })
  }

  // Only people with an accepted connection to the owner.
  const { data: connections } = await service
    .from('connection_interests')
    .select('from_user_id')
    .eq('to_user_id', user.id)
    .eq('status', 'accepted')
    .in('from_user_id', memberIds as string[])
  const allowed = ((connections as { from_user_id: string }[] | null) ?? []).map(c => c.from_user_id)
  if (allowed.length === 0) return NextResponse.json({ error: 'Only your connections can be added to a circle.' }, { status: 400 })

  const { error } = await service
    .from('custom_circle_members')
    .upsert(allowed.map(member_id => ({ circle_id: circleId, member_id })), { onConflict: 'circle_id,member_id', ignoreDuplicates: true })
  if (error) return NextResponse.json({ error: 'Could not update the circle. Please try again.' }, { status: 500 })
  return NextResponse.json({ updated: allowed.length })
}
