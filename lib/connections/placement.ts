import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'

// Where someone puts a connection (owner decision 2026-10-11: connections go
// both ways and each person chooses the circle for the other). A placement is
// 'outer', 'inner' or one of the owner's own circle ids. The row
// member → owner in connection_interests carries the Inner Circle flag; own
// circles are custom_circle_members rows.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// A placement the owner's tier allows (anything else becomes 'outer').
export async function allowedPlacement(ownerId: string, raw: unknown): Promise<string> {
  if (raw !== 'inner' && !(typeof raw === 'string' && UUID.test(raw))) return 'outer'
  const limits = await getPlanLimits(ownerId)
  if (limits.circles !== 2) return 'outer'
  if (raw === 'inner') return 'inner'
  if (limits.extraCircles <= 0) return 'outer'
  const { data } = await createServiceClient().from('custom_circles').select('id').eq('id', raw).eq('owner_id', ownerId).maybeSingle()
  return data ? raw : 'outer'
}

// Puts `memberId` in the owner's chosen circle (the member → owner row must exist).
export async function applyPlacement(ownerId: string, memberId: string, placement: string): Promise<void> {
  const service = createServiceClient()
  const { error } = await service
    .from('connection_interests')
    .update({ in_inner_circle: placement === 'inner' })
    .eq('from_user_id', memberId)
    .eq('to_user_id', ownerId)
  if (error) throw new Error(error.message)
  if (UUID.test(placement)) {
    const { error: memberError } = await service
      .from('custom_circle_members')
      .upsert({ circle_id: placement, member_id: memberId }, { onConflict: 'circle_id,member_id', ignoreDuplicates: true })
    if (memberError) throw new Error(memberError.message)
  }
}

// Makes the connection between two people accepted in both directions:
// `a` puts `b` in placementForB, `b` puts `a` in placementForA.
export async function connectBothWays(a: string, b: string, placementForB: string, placementForA: string): Promise<void> {
  const service = createServiceClient()
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const accept = () => service.from('connection_interests').update({ status: 'accepted', allowed_scope: 'both' }).eq('from_user_id', from).eq('to_user_id', to)
    const { data: row } = await service.from('connection_interests').select('id').eq('from_user_id', from).eq('to_user_id', to).maybeSingle<{ id: string }>()
    let { error } = row
      ? await accept()
      : await service.from('connection_interests').insert({ from_user_id: from, to_user_id: to, status: 'accepted', allowed_scope: 'both', in_inner_circle: false })
    // Created at the same moment by another request (one row per pair, migration 37).
    if (error?.code === '23505') ({ error } = await accept())
    if (error) throw new Error(error.message)
  }
  // b → a is seen by a: a's choice for b; a → b is seen by b: b's choice for a.
  await applyPlacement(a, b, placementForB)
  await applyPlacement(b, a, placementForA)
}
