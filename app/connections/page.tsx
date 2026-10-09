import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanAt } from '@/lib/billing/plan'
import { PLANS } from '@/lib/plans'
import ConnectionsList from './ConnectionsList'
import ConnectionRequests from './ConnectionRequests'

export const dynamic = 'force-dynamic'

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceSupabase = createServiceClient()

  const [
    plan,
    { data: requests },
    { data: connections },
  ] = await Promise.all([
    getPlanAt(user.id),
    serviceSupabase
      .from('connection_interests')
      .select('id, created_at, from_user:users!connection_interests_from_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    serviceSupabase
      .from('connection_interests')
      .select('id, in_inner_circle, created_at, from_user:users!connection_interests_from_user_id_fkey(id, username, display_name, avatar_url)')
      .eq('to_user_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false }),
  ])

  // Inner Circle only on plans with two circles (Ambivert / Extrovert).
  const innerAllowed = PLANS[plan].circles === 2

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Connections</h1>
          <p className="text-text-secondary text-lg mt-2">{innerAllowed ? 'Choose who is in your Inner Circle.' : 'People who can talk to your LiAIson.'}</p>
        </div>

        {requests && requests.length > 0 && (
          <ConnectionRequests requests={requests} innerAllowed={innerAllowed} />
        )}
        <ConnectionsList
          key={(connections ?? []).map(c => `${c.id}:${c.in_inner_circle}`).join(',')}
          initialConnections={connections ?? []}
          innerAllowed={innerAllowed}
        />
      </div>
    </div>
  )
}