import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ProfileCard from '@/components/ui/ProfileCard'
import NotificationsPanel from './NotificationsPanel'
import VisitorInsights from './VisitorInsights'
import type { Notification, User } from '@/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceSupabase = createServiceClient()

  const [
    { data: profile },
    { data: notifications },
    { data: suggestedUsers },
  ] = await Promise.all([
    serviceSupabase.from('users').select('*').eq('id', user.id).single<User>(),
    serviceSupabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10),
    serviceSupabase
      .from('users')
      .select('*')
      .eq('is_discoverable', true)
      .neq('id', user.id)
      .limit(6),
  ])

  const profileUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-liaison.app'}/${profile?.username ?? ''}`

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-6xl mx-auto px-4 py-12 space-y-8">
        {/* Welcome */}
        <div className="mb-2">
          <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">
            Welcome back, {profile?.display_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-text-secondary text-lg mt-2">Here&apos;s what&apos;s been happening with your LiAIson</p>
        </div>

        {/* Share URL */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-soft">
          <p className="text-base font-semibold text-text-primary mb-4">Your LiAIson profile</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-secondary font-mono truncate">
              {profileUrl}
            </div>
            <Link
              href={`/${profile?.username}`}
              className="px-6 py-3 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft hover:shadow-card whitespace-nowrap text-center"
            >
              View Profile
            </Link>
          </div>
        </div>

        <VisitorInsights />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Notifications */}
          <div className="lg:col-span-2 space-y-5">
            <h2 className="text-xl font-semibold text-text-primary">Notifications</h2>
            <NotificationsPanel initialNotifications={(notifications as Notification[] | null) ?? []} />
          </div>

          {/* Stats */}
          <div className="space-y-5">
            <h2 className="text-xl font-semibold text-text-primary">Your LiAIson</h2>

            <div className="flex gap-3">
              <Link
                href="/vault"
                className="flex-1 text-center py-3 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft"
              >
                Edit Vault
              </Link>
              <Link
                href="/profile"
                className="flex-1 text-center py-3 border-2 border-border hover:border-accent text-text-primary hover:text-accent text-sm font-medium rounded-lg transition-all"
              >
                Edit Profile
              </Link>
            </div>
          </div>
        </div>

        {/* Suggested Connections */}
        {suggestedUsers && suggestedUsers.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-text-primary mb-5">Suggested connections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {(suggestedUsers as User[]).map(u => (
                <ProfileCard key={u.id} user={u} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
