import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'
import { suggestedPeople } from '@/lib/connections/suggestions'
import ConnectionsList from './ConnectionsList'
import ConnectionRequests from './ConnectionRequests'
import ProfileCard from '@/components/ui/ProfileCard'
import CirclesNote from '@/components/ui/CirclesNote'

export const dynamic = 'force-dynamic'

// Connections page for Introvert (one circle, so nothing about circles here).
// Tiers with more than one circle use the Circles page instead.
export default async function ConnectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const limits = await getPlanLimits(user.id)
  if (limits.circles === 2) redirect('/circles')

  const service = createServiceClient()
  const [{ data: requests }, { data: connections }] = await Promise.all([
    service
      .from('connection_interests')
      .select('id, created_at, from_user:users!connection_interests_from_user_id_fkey(id, username, display_name, avatar_url, plan)')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    service
      .from('connection_interests')
      .select('id, created_at, from_user:users!connection_interests_from_user_id_fkey(id, username, display_name, avatar_url, plan)')
      .eq('to_user_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false }),
  ])

  const connectedIds = (connections ?? []).map(c => (Array.isArray(c.from_user) ? c.from_user[0]?.id : (c.from_user as { id?: string } | null)?.id) ?? '')
  const suggestions = await suggestedPeople(user.id, connectedIds)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">Connections</h1>
          <p className="text-text-secondary text-lg mt-2">People who can talk to your LiAIson.</p>
          {limits.groupCompare >= 2 && (
            <Link href="/similarities" className="mt-5 inline-flex items-center gap-2 px-5 py-3 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-full shadow-card">
              Create a Similarities Chart
            </Link>
          )}
          <CirclesNote className="mt-3" />
        </div>

        {requests && requests.length > 0 && <ConnectionRequests requests={requests} />}
        <ConnectionsList key={(connections ?? []).map(c => c.id).join(',')} initialConnections={connections ?? []} />

        {suggestions.length > 0 && (
          <section className="space-y-4 pt-4">
            <h2 className="text-xl font-semibold text-text-primary">Suggested Connections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {suggestions.map(u => <ProfileCard key={u.id} user={u} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
