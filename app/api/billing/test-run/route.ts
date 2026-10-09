import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { currentPeriod } from '@/lib/insights/periods'
import { billMonth } from '@/lib/billing/monthly'
import { isTestMode } from '@/lib/billing/seller'

// OWNER TEST ONLY: runs the month-end bill for the current month so far, for the
// signed-in billing-exempt account, while Mollie is in TEST mode. Optional
// { extraUsageEur } (0–50) adds pretend usage so the card charge can be tested.
// Disabled automatically once a live_ Mollie key is used.
export async function POST(request: NextRequest) {
  if (!isTestMode()) return NextResponse.json({ error: 'Not available' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile } = await service
    .from('users')
    .select('billing_exempt')
    .eq('id', user.id)
    .single<{ billing_exempt: boolean }>()
  if (!profile?.billing_exempt) return NextResponse.json({ error: 'Not available' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const extra = Number((body as { extraUsageEur?: unknown }).extraUsageEur ?? 0)
  if (!Number.isFinite(extra) || extra < 0 || extra > 50) {
    return NextResponse.json({ error: 'extraUsageEur must be 0–50' }, { status: 400 })
  }

  const month = currentPeriod('month')
  try {
    const result = await billMonth(user.id, { start: month.start, end: new Date() }, {
      ignoreExemptAndTrial: true,
      extraUsageEur: extra,
      webhookUrl: `${request.nextUrl.origin}/api/billing/webhook`,
    })
    return NextResponse.json({ result })
  } catch (err) {
    console.error('BILLING_TEST_RUN_ERROR', err)
    return NextResponse.json({ error: 'Test run failed' }, { status: 500 })
  }
}
