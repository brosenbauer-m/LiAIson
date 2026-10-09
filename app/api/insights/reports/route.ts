import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanAt } from '@/lib/billing/plan'
import { PLANS } from '@/lib/plans'

// Owner-only: the signed-in user's saved weekly and monthly reports (newest first).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('visitor_reports')
    .select('id, period_type, period_start, period_end, total, report, created_at')
    .eq('profile_user_id', user.id)
    .order('period_start', { ascending: false })
    .limit(120)

  if (error) {
    return NextResponse.json({ error: 'Could not load reports' }, { status: 500 })
  }

  const plan = await getPlanAt(user.id)
  return NextResponse.json({ reports: data ?? [], echoes: PLANS[plan].echoes }, { headers: { 'Cache-Control': 'no-store' } })
}
