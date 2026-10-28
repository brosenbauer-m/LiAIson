import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { underLimit } from '@/lib/redis'
import { redeemForUser } from '@/lib/coupons'

// A signed-in person uses an event code (Settings → Redeem a Code).
// POST { code } → { summary, tierRaised, periodEndsAt }.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in.' }, { status: 401 })
  if (!(await underLimit(`coupon:redeem:${user.id}`, 10, 3600))) {
    return NextResponse.json({ error: 'Too many tries. Please wait a little.' }, { status: 429 })
  }
  const body = (await request.json().catch(() => ({}))) as { code?: unknown }
  const result = await redeemForUser(user.id, body.code)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
