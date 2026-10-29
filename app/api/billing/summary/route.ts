import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { currentPeriod } from '@/lib/insights/periods'
import { billableInPeriodEur, getUnpaidBill, MIN_CHARGE_EUR } from '@/lib/billing/monthly'
import { planFeeFor } from '@/lib/billing/planFee'
import { PLANS } from '@/lib/plans'

// This month's bill so far for the signed-in user (incl. 30% markup), any
// unpaid bill, and whether the owner-only test run is available.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    const service = createServiceClient()
    const { data: profile } = await service
      .from('users')
      .select('billing_exempt, trial_ends_at, sponsored_until')
      .eq('id', user.id)
      .single<{ billing_exempt: boolean; trial_ends_at: string; sponsored_until: string | null }>()
    const period = currentPeriod('month')
    const trialEnd = profile ? new Date(profile.trial_ends_at) : period.start
    const monthToDateEur = profile?.billing_exempt ? 0 : await billableInPeriodEur(user.id, period.start, new Date(), trialEnd)
    // Plan fee expected for this whole month (charged with the bill on the 1st).
    const fee = profile?.billing_exempt ? { plan: null, options: null, feeEur: 0 } : await planFeeFor(user.id, period)
    const unpaid = await getUnpaidBill(user.id)
    return NextResponse.json(
      {
        monthToDateEur,
        planFeeEur: fee.feeEur,
        planName: fee.plan ? PLANS[fee.plan].name : null,
        chargeDate: period.end.toISOString(),
        minChargeEur: MIN_CHARGE_EUR,
        exempt: !!profile?.billing_exempt,
        inTrial: trialEnd.getTime() > Date.now(),
        trialEndsAt: profile?.trial_ends_at ?? null,
        sponsoredUntil: profile?.sponsored_until && new Date(profile.sponsored_until) > new Date() ? profile.sponsored_until : null,
        unpaid,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('BILLING_SUMMARY_ERROR', err)
    return NextResponse.json({ error: 'Could not load your bill' }, { status: 500 })
  }
}
