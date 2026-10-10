import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import CopyButton from '@/components/ui/CopyButton'
import VisitorInsights from './VisitorInsights'

// Signed-in home: your link and your Echoes. Navigation lives in the header,
// notifications in the header bell, suggested people on Connections.

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await createServiceClient()
    .from('users')
    .select('username, display_name')
    .eq('id', user.id)
    .single<{ username: string; display_name: string }>()

  const profileUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://my-liaison.app'}/${profile?.username ?? ''}`

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">
            Welcome back, {profile?.display_name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-text-secondary text-lg mt-2">Here&apos;s what&apos;s been happening with your LiAIson.</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-soft">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted mb-3">Your link</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-secondary font-mono truncate">
              {profileUrl}
            </div>
            <CopyButton text={profileUrl} />
            <Link
              href={`/${profile?.username ?? ''}`}
              className="px-6 py-3 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg shadow-soft whitespace-nowrap text-center"
            >
              Open LiAIson
            </Link>
          </div>
        </div>

        <VisitorInsights />
      </div>
    </div>
  )
}
