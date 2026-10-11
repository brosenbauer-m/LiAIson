import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'
import ConnectionRequests from '../connections/ConnectionRequests'
import CirclesWorkspace, { type WorkspacePerson, type WorkspaceSection } from './CirclesWorkspace'
import type { StudioCircle } from '@/components/circles/layout'

export const dynamic = 'force-dynamic'

// Circles page (owner design 2026-10-10) for tiers with more than one circle;
// replaces the Connections page there (Introvert keeps /connections). The
// circles are in the middle, Connections on the left and Vault sections on the
// right, both filtered by the selected circle.
export default async function CirclesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/circles')

  const limits = await getPlanLimits(user.id)
  if (limits.circles !== 2) redirect('/connections')

  const service = createServiceClient()
  const [{ data: requests }, { data: connections }, { data: circleRows }, { data: sectionRows }] = await Promise.all([
    service
      .from('connection_interests')
      .select('id, created_at, from_user:users!connection_interests_from_user_id_fkey(id, username, display_name, avatar_url, plan)')
      .eq('to_user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    service
      .from('connection_interests')
      .select('id, in_inner_circle, created_at, from_user:users!connection_interests_from_user_id_fkey(id, username, display_name, avatar_url, plan)')
      .eq('to_user_id', user.id)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false }),
    service.from('custom_circles').select('id, name, parent_id, in_inner, isolated').eq('owner_id', user.id).order('created_at', { ascending: true }),
    service.from('vault_sections').select('id, label, circle, custom_circle_id, section_type, content').eq('user_id', user.id).order('domain', { ascending: true }),
  ])

  type CircleRow = { id: string; name: string; parent_id: string | null; in_inner: boolean; isolated: boolean }
  const ownCircles = limits.extraCircles > 0 ? ((circleRows as CircleRow[] | null) ?? []) : []
  const { data: memberRows } = ownCircles.length
    ? await service.from('custom_circle_members').select('circle_id, member_id').in('circle_id', ownCircles.map(c => c.id))
    : { data: [] }
  const memberships = new Map<string, string[]>()
  for (const m of (memberRows as { circle_id: string; member_id: string }[] | null) ?? []) {
    memberships.set(m.member_id, [...(memberships.get(m.member_id) ?? []), m.circle_id])
  }

  type UserRow = { id: string; username: string; display_name: string; avatar_url: string | null; plan: string | null }
  type ConnectionRow = { id: string; in_inner_circle: boolean; from_user: UserRow | UserRow[] | null }
  const people: WorkspacePerson[] = ((connections as ConnectionRow[] | null) ?? []).flatMap(c => {
    const u = Array.isArray(c.from_user) ? c.from_user[0] : c.from_user
    return u ? [{
      userId: u.id,
      connectionId: c.id,
      username: u.username,
      name: u.display_name,
      avatarUrl: u.avatar_url,
      plan: u.plan,
      inInner: c.in_inner_circle,
      circles: memberships.get(u.id) ?? [],
    }] : []
  })

  type SectionRow = { id: string; label: string; circle: string; custom_circle_id: string | null; section_type: string; content: string | null }
  const sections: WorkspaceSection[] = ((sectionRows as SectionRow[] | null) ?? [])
    .filter(s => s.section_type !== 'profile_bio')
    .map(s => ({
      id: s.id,
      label: s.label,
      circle: s.circle as WorkspaceSection['circle'],
      customCircleId: s.custom_circle_id,
      chars: Array.from(s.content ?? '').length,
    }))

  const circles: StudioCircle[] = ownCircles.map(c => ({ ...c, memberCount: 0 }))

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">Circles</h1>
            <p className="text-text-secondary text-lg mt-2">Who sees what in your Vault.</p>
          </div>
          {limits.groupCompare >= 2 && (
            <Link
              href="/similarities"
              className="inline-flex items-center gap-2 px-5 py-3 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-full shadow-card"
            >
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <circle cx="6" cy="7" r="5" /><circle cx="12" cy="7" r="5" />
              </svg>
              Create a Similarities Chart
            </Link>
          )}
        </div>

        <CirclesWorkspace
          initialPeople={people}
          initialSections={sections}
          initialCircles={circles}
          allowed={limits.extraCircles}
        />

        {requests && requests.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <ConnectionRequests requests={requests} collapsible title="Connection Requests" />
          </div>
        )}
      </div>
    </div>
  )
}
