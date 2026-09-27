import { createServiceClient } from '@/lib/supabase/service'
import type { ChatScope } from '@/lib/prompts/buildSystemPrompt'

export async function resolveScope(
  ownerId: string,
  options: { visitorUserId?: string }
): Promise<ChatScope | null> {
  const supabase = createServiceClient()

  if (options.visitorUserId) {
    const { data: connection } = await supabase
      .from('connection_interests')
      .select('allowed_scope')
      .eq('from_user_id', ownerId)
      .eq('to_user_id', options.visitorUserId)
      .eq('status', 'matched')
      .single()

    if (connection && connection.allowed_scope !== 'none') {
      return connection.allowed_scope as ChatScope
    }
  }

  const { data: owner } = await supabase
    .from('users')
    .select('public_scope')
    .eq('id', ownerId)
    .single()

  if (owner && owner.public_scope !== 'none') {
    return owner.public_scope as ChatScope
  }

  return null
}
