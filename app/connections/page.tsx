import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { ChatAccessScope } from '@/types'
import ConnectionsList from './ConnectionsList'
import ConnectionRequests from './ConnectionRequests'

export const dynamic = 'force-dynamic'

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceSupabase = createServiceClient()

  const [
    { data: owner },
    { data: requests },
    { data: connections },
  ] = await Promise.all([
    serviceSupabase
      .from('users')
      .select('public_scope')
      .eq('id', user.id)
      .single(),
    serviceSupabase
      .from('connection_interests')
      .select('id, created_at, from_user:users!connection_interests_from_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('connection_interests')
      .select('id, allowed_scope, created_at, from_user:users!connection_interests_from_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('to_user_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false }),
  ])

  const publicScope = (owner?.public_scope as ChatAccessScope | null) ?? 'none'

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Connections</h1>
          <p className="text-text-secondary text-lg mt-2">Choose what each connection can access.</p>
        </div>

        {requests && requests.length > 0 && (
          <ConnectionRequests requests={requests} isOpen={publicScope === 'both'} />
        )}
        <ConnectionsList
          key={(connections ?? []).map(c => `${c.id}:${c.allowed_scope}`).join(',')}
          initialConnections={connections ?? []}
          publicScope={publicScope}
        />
      </div>
    </div>
  )
}