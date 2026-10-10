import { createServiceClient } from '@/lib/supabase/service'

// Suggested people for the Connections / Circles page: findable on Discover,
// not you, not already connected either way. A Private profile's bio is not
// shown.
export type Suggestion = { id: string; username: string; display_name: string; avatar_url: string | null; short_bio: string | null; plan: string | null }

export async function suggestedPeople(userId: string, connectedIds: string[]): Promise<Suggestion[]> {
  const service = createServiceClient()
  const [{ data: outgoing }, { data: candidates }] = await Promise.all([
    service.from('connection_interests').select('to_user_id').eq('from_user_id', userId),
    service
      .from('users')
      .select('id, username, display_name, avatar_url, short_bio, public_scope, plan')
      .eq('is_discoverable', true)
      .limit(24),
  ])
  const known = new Set<string>([userId, ...connectedIds, ...((outgoing as { to_user_id: string }[] | null) ?? []).map(r => r.to_user_id)])
  type Row = Suggestion & { public_scope: string | null }
  return ((candidates as Row[] | null) ?? [])
    .filter(u => !known.has(u.id))
    .slice(0, 6)
    .map(({ public_scope, ...u }) => ({ ...u, short_bio: public_scope === 'none' ? null : u.short_bio }))
}
