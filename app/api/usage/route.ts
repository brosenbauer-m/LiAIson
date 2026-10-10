import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getMonthUsage, getSpendLimitCents, MAX_SPEND_LIMIT_CENTS } from '@/lib/usage/spend'
import { getBalanceEur } from '@/lib/billing/topup'
import { isCurrency } from '@/lib/currency'
import { eurRate } from '@/lib/currency/rates'

// The signed-in user's own usage this month, monthly spending limit, credit
// balance, whether the free month is still on, and the display currency with
// today's rate (used by Settings and the usage indicator in the header).
// POST { limitEuros } changes the limit (whole euros, 0–500).

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
    const { data: profile } = await createServiceClient()
      .from('users')
      .select('display_currency, trial_ends_at, billing_exempt')
      .eq('id', userId)
      .single<{ display_currency: string | null; trial_ends_at: string | null; billing_exempt: boolean | null }>()
    const [usage, limitCents, creditEur, fx] = await Promise.all([
      getMonthUsage(userId),
      getSpendLimitCents(userId),
      getBalanceEur(userId).catch(() => 0),
      eurRate(isCurrency(profile?.display_currency) ? profile.display_currency : 'EUR'),
    ])
    const creditCents = Math.max(0, creditEur) * 100
    return NextResponse.json(
      {
        ...usage,
        limitCents,
        creditCents,
        paused: usage.costCents >= limitCents + creditCents,
        inTrial: !!profile?.trial_ends_at && new Date(profile.trial_ends_at) > new Date(),
        exempt: profile?.billing_exempt === true,
        currency: fx.currency,
        rate: fx.rate,
      },
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
