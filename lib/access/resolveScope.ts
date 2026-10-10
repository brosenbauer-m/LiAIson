import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'
import { circleChain, type CircleNode, type VisibleCircle } from '@/lib/circles'

// Which parts of the owner's Vault a visitor may see (see lib/circles.ts).
// - The owner sees everything except drafts (never drafts through their LiAIson).
// - Public profile (users.public_scope !== 'none'): everyone sees the Outer Circle.
// - Private profile: only accepted connections see anything.
// - Accepted connections in the owner's Inner Circle also see the Inner Circle,
//   but only while the owner's plan has two circles (Ambivert and up).
// - Accepted connections in one of the owner's own circles (Social Butterfly)
//   also see the sections in that circle and in every circle around it
//   (circles are nested, migration 30): an own circle placed in the Inner
//   Circle gives its members the Inner Circle too. Only while the owner's plan
//   has own circles. Membership without an accepted connection counts for nothing.
// Returns null when the visitor may see nothing (no chat, no sections).
export type VisibleScope = {
  circles: VisibleCircle[]
  // Own circles (custom_circles.id) whose sections this visitor may see.
  customCircleIds: string[]
}

export async function resolveCircles(
  ownerId: string,
  options: { visitorUserId?: string }
): Promise<VisibleScope | null> {
  const supabase = createServiceClient()

  if (options.visitorUserId && options.visitorUserId === ownerId) {
    const { data: own } = await supabase.from('custom_circles').select('id').eq('owner_id', ownerId)
    return { circles: ['outer', 'inner'], customCircleIds: ((own as { id: string }[] | null) ?? []).map(c => c.id) }
  }

  const { data: owner } = await supabase
    .from('users')
    .select('public_scope')
    .eq('id', ownerId)
    .single<{ public_scope: string | null }>()

  const isPublic = !!owner?.public_scope && owner.public_scope !== 'none'

  let connected = false
  let inner = false
  if (options.visitorUserId) {
    const { data: connection } = await supabase
      .from('connection_interests')
      .select('in_inner_circle')
      .eq('from_user_id', options.visitorUserId)
      .eq('to_user_id', ownerId)
      .eq('status', 'accepted')
      .maybeSingle<{ in_inner_circle: boolean }>()
    if (connection) {
      connected = true
      inner = connection.in_inner_circle === true
    }
  }

  if (!isPublic && !connected) return null
  if (!connected) return { circles: ['outer'], customCircleIds: [] }

  const limits = await getPlanLimits(ownerId)

  let customCircleIds: string[] = []
  let innerThroughCircle = false
  if (limits.extraCircles > 0) {
    const [{ data: own }, { data: memberships }] = await Promise.all([
      supabase.from('custom_circles').select('id, parent_id, in_inner').eq('owner_id', ownerId),
      supabase.from('custom_circle_members').select('circle_id').eq('member_id', options.visitorUserId!),
    ])
    const byId = new Map(((own as CircleNode[] | null) ?? []).map(c => [c.id, c]))
    const visible = new Set<string>()
    for (const { circle_id } of (memberships as { circle_id: string }[] | null) ?? []) {
      const chain = circleChain(circle_id, byId)
      chain.forEach(c => visible.add(c.id))
      if (chain.length > 0 && chain[chain.length - 1].in_inner) innerThroughCircle = true
    }
    customCircleIds = [...visible]
  }

  const circles: VisibleCircle[] = (inner || innerThroughCircle) && limits.circles === 2 ? ['outer', 'inner'] : ['outer']
  return { circles, customCircleIds }
}

// PostgREST filter for a vault_sections query: `.or(visibleSectionsFilter(scope))`.
// Only the scope's circles and own circles match; drafts never do.
export function visibleSectionsFilter(scope: VisibleScope): string {
  const circles = scope.circles.length > 0 ? scope.circles : ['none']
  const ids = scope.customCircleIds.filter(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
  const byCircle = `circle.in.(${circles.join(',')})`
  return ids.length === 0 ? byCircle : `${byCircle},and(circle.eq.custom,custom_circle_id.in.(${ids.join(',')}))`
}
