import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { currentPeriod } from '@/lib/insights/periods'
import { getPlanAt } from '@/lib/billing/plan'
import { echoAllowed, PLANS } from '@/lib/plans'

// Owner-only: live counts of what visitors want to know, for the current
// calendar week (Mon–Sun, Vienna time) or current calendar month.

const EXAMPLES_PER_CATEGORY = 3

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const type = request.nextUrl.searchParams.get('period') === 'month' ? 'month' : 'week'
  const period = currentPeriod(type)

  // Echoes by plan: Introvert none, Ambivert monthly, Extrovert weekly + monthly.
  const plan = await getPlanAt(user.id)
  if (!echoAllowed(plan, type)) {
    return NextResponse.json(
      { locked: true, echoes: PLANS[plan].echoes, period: { type, label: period.label } },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('visitor_insights')
    .select('category, statement, created_at')
    .eq('profile_user_id', user.id)
    .gte('created_at', period.start.toISOString())
    .lt('created_at', period.end.toISOString())
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: 'Could not load insights' }, { status: 500 })
  }

  const byCategory = new Map<string, { count: number; examples: string[] }>()
  for (const row of (data as { category: string; statement: string }[] | null) ?? []) {
    const entry = byCategory.get(row.category) ?? { count: 0, examples: [] }
    entry.count += 1
    if (entry.examples.length < EXAMPLES_PER_CATEGORY && !entry.examples.includes(row.statement)) {
      entry.examples.push(row.statement)
    }
    byCategory.set(row.category, entry)
  }

  const categories = Array.from(byCategory.entries())
    .map(([category, v]) => ({ category, count: v.count, examples: v.examples }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json(
    {
      period: { type, label: period.label, start: period.start.toISOString(), end: period.end.toISOString() },
      total: categories.reduce((sum, c) => sum + c.count, 0),
      categories,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
