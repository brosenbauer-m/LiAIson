import { createServiceClient } from '@/lib/supabase/service'
import { getPlanAt } from '@/lib/billing/plan'
import { PLANS } from '@/lib/plans'
import type { VisibleCircle } from '@/lib/circles'

// Which circles of the owner's Vault a visitor may see (see lib/circles.ts).
// - The owner sees both circles (never drafts through their LiAIson).
// - Public profile (users.public_scope !== 'none'): everyone sees the Outer Circle.
// - Private profile: only accepted connections see anything.
// - Accepted connections in the owner's Inner Circle also see the Inner Circle,
//   but only while the owner's plan has two circles (Ambivert / Extrovert).
// Returns null when the visitor may see nothing (no chat, no sections).
export async function resolveCircles(
  ownerId: string,
  options: { visitorUserId?: string }
): Promise<VisibleCircle[] | null> {
  if (options.visitorUserId && options.visitorUserId === ownerId) return ['outer', 'inner']

  const supabase = createServiceClient()

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
  if (inner) {
    const plan = await getPlanAt(ownerId)
    if (PLANS[plan].circles === 2) return ['outer', 'inner']
  }
  return ['outer']
}
