import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { changePlan, getPlanState } from '@/lib/billing/plan'
import { isPlanId } from '@/lib/plans'

// GET → the signed-in user's plan state. POST { plan, options? } → change plan
// (options = Social Butterfly slider choices)
// (rules in lib/billing/plan.ts).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    return NextResponse.json(await getPlanState(user.id), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('PLAN_GET_ERROR', err)
    return NextResponse.json({ error: 'Could not load your plan' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { plan, options } = body as { plan?: unknown; options?: unknown }
  if (!isPlanId(plan)) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 })

  try {
    const result = await changePlan(user.id, plan, options)
    if (!result.ok) return NextResponse.json({ error: result.error, needsCard: result.needsCard ?? false }, { status: result.status })
    return NextResponse.json({ message: result.message, state: result.state })
  } catch (err) {
    console.error('PLAN_CHANGE_ERROR', err)
    return NextResponse.json({ error: 'Could not change your plan. Please try again.' }, { status: 500 })
  }
}
