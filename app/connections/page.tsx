import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'
import ConnectionsList from './ConnectionsList'
import ConnectionRequests from './ConnectionRequests'
import CustomCircles from './CustomCircles'
import ProfileCard from '@/components/ui/ProfileCard'

export const dynamic = 'force-dynamic'

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceSupabase = createServiceClient()

  const [
    limits,
    { data: requests },
    { data: connections },
    { data: circleRows },
  ] = await Promise.all([
    getPlanLimits(user.id),
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
    serviceSupabase
      .from('custom_circles')
      .select('id, name')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  // Inner Circle only on plans with two circles (Ambivert and up).
  const innerAllowed = limits.circles === 2

  // Own circles (Social Butterfly) and who is in them.
  const circles = limits.extraCircles > 0 ? ((circleRows as { id: string; name: string }[] | null) ?? []) : []
  const { data: memberRows } = circles.length
    ? await serviceSupabase.from('custom_circle_members').select('circle_id, member_id').in('circle_id', circles.map(c => c.id))
    : { data: [] }
  const members = (memberRows as { circle_id: string; member_id: string }[] | null) ?? []

  // Suggested people: findable on Discover, not you, not already connected
  // either way. A Private profile's bio is not shown.
  const { data: outgoing } = await serviceSupabase.from('connection_interests').select('to_user_id').eq('from_user_id', user.id)
  const known = new Set<string>([
    user.id,
    ...((outgoing as { to_user_id: string }[] | null) ?? []).map(r => r.to_user_id),
    ...(connections ?? []).map(c => (Array.isArray(c.from_user) ? c.from_user[0]?.id : (c.from_user as { id?: string } | null)?.id) ?? ''),
  ])
  const { data: candidates } = await serviceSupabase
    .from('users')
    .select('id, username, display_name, avatar_url, short_bio, public_scope')
    .eq('is_discoverable', true)
    .limit(24)
  type Candidate = { id: string; username: string; display_name: string; avatar_url: string | null; short_bio: string | null; public_scope: string | null }
  const suggestions = ((candidates as Candidate[] | null) ?? [])
    .filter(u => !known.has(u.id))
    .slice(0, 6)
    .map(u => ({ ...u, short_bio: u.public_scope === 'none' ? null : u.short_bio }))
  const memberships: Record<string, string[]> = {}
  for (const m of members) memberships[m.member_id] = [...(memberships[m.member_id] ?? []), m.circle_id]

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">Connections</h1>
          <p className="text-text-secondary text-lg mt-2">{innerAllowed ? 'Choose who is in your Inner Circle.' : 'People who can talk to your LiAIson.'}</p>
          {limits.groupCompare >= 2 && (
            <Link href="/compare" className="mt-3 inline-block text-sm text-accent hover:underline font-medium">
              Compare yourself with several people →
            </Link>
          )}
        </div>

        {requests && requests.length > 0 && (
          <ConnectionRequests requests={requests} innerAllowed={innerAllowed} />
        )}
        {limits.extraCircles > 0 && (
          <CustomCircles
            circles={circles.map(c => ({ ...c, memberCount: members.filter(m => m.circle_id === c.id).length }))}
            allowed={limits.extraCircles}
          />
        )}
        <ConnectionsList
          key={[...(connections ?? []).map(c => `${c.id}:${c.in_inner_circle}`), ...circles.map(c => `${c.id}:${c.name}`), ...members.map(m => `${m.circle_id}:${m.member_id}`)].join(',')}
          initialConnections={connections ?? []}
          innerAllowed={innerAllowed}
          customCircles={circles}
          initialMemberships={memberships}
        />

        {suggestions.length > 0 && (
          <section className="space-y-4 pt-4">
            <h2 className="text-xl font-semibold text-text-primary">Suggested connections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {suggestions.map(u => <ProfileCard key={u.id} user={u} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}