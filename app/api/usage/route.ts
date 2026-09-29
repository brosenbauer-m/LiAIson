import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getMonthUsage, getSpendLimitCents, MAX_SPEND_LIMIT_CENTS } from '@/lib/usage/spend'

// Owner-only: this month's AI usage of your own LiAIson, and your monthly
// spending limit. POST { limitEuros } changes the limit (whole euros, 0–500).

async function getSignedInUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function GET() {
  const userId = await getSignedInUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  try {
    const [usage, limitCents] = await Promise.all([getMonthUsage(userId), getSpendLimitCents(userId)])
    return NextResponse.json(
      { ...usage, limitCents, paused: usage.costCents >= limitCents },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json({ error: 'Could not load usage' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSignedInUserId()
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const limitEuros = (body as { limitEuros?: unknown })?.limitEuros
  if (typeof limitEuros !== 'number' || !Number.isInteger(limitEuros)) {
    return NextResponse.json({ error: 'Please enter a whole number of euros.' }, { status: 400 })
  }
  const limitCents = limitEuros * 100
  if (limitCents < 0 || limitCents > MAX_SPEND_LIMIT_CENTS) {
    return NextResponse.json({ error: `The limit must be between €0 and €${MAX_SPEND_LIMIT_CENTS / 100}.` }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('users')
    .update({ monthly_spend_limit_cents: limitCents })
    .eq('id', userId)

  if (error) {
    return NextResponse.json({ error: 'Could not save the limit' }, { status: 500 })
  }

  return NextResponse.json({ limitCents })
}
