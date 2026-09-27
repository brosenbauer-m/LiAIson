import { createServiceClient } from '@/lib/supabase/service'
import type { ChatScope } from '@/lib/prompts/buildSystemPrompt'

type AccessLevel = 'none' | 'professional' | 'personal' | 'both'

export function combineAccess(a: AccessLevel, b: AccessLevel): AccessLevel {
  if (a === 'both' || b === 'both') return 'both'
  if (a === 'none') return b
  if (b === 'none') return a
  return a === b ? a : 'both'
}

export async function resolveScope(
  ownerId: string,
  options: { visitorUserId?: string }
): Promise<ChatScope | null> {
  if (options.visitorUserId && options.visitorUserId === ownerId) return 'both'

  const supabase = createServiceClient()

  const { data: owner } = await supabase
    .from('users')
    .select('public_scope')
    .eq('id', ownerId)
    .single()

  let level: AccessLevel = (owner?.public_scope as AccessLevel | undefined) ?? 'none'

  if (options.visitorUserId) {
    const { data: connection } = await supabase
      .from('connection_interests')
      .select('allowed_scope')
      .eq('from_user_id', options.visitorUserId)
      .eq('to_user_id', ownerId)
      .eq('status', 'accepted')
      .maybeSingle()

    if (connection) {
      level = combineAccess(level, connection.allowed_scope as AccessLevel)
    }
  }

  return level === 'none' ? null : level as ChatScope
}
