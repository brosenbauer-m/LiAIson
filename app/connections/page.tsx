import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import ConnectionsList from './ConnectionsList'

export const dynamic = 'force-dynamic'

export default async function ConnectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const serviceSupabase = createServiceClient()

  const { data: connections } = await serviceSupabase
    .from('connection_interests')
    .select('id, allowed_scope, compatibility_summary, to_user:users!connection_interests_to_user_id_fkey(id, username, display_name, avatar_url)')
    .eq('from_user_id', user.id)
    .eq('status', 'matched')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-surface shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-xl text-accent">LiAIson</Link>
          <Link href="/dashboard" className="text-text-secondary hover:text-accent text-sm font-medium transition-colors">← Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-text-primary">Connections</h1>
          <p className="text-text-secondary text-lg mt-2">Choose what each matched connection can access.</p>
        </div>

        <ConnectionsList initialConnections={connections ?? []} />
      </div>
    </div>
  )
}