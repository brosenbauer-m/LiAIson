import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureMollieCustomer } from '@/lib/billing/account'
import { startUnpaidBillCheckout } from '@/lib/billing/monthly'

// POST → { checkoutUrl } to pay the signed-in user's unpaid bill on Mollie's page.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    const customerId = await ensureMollieCustomer(user.id, user.email)
    const origin = request.nextUrl.origin
    const checkoutUrl = await startUnpaidBillCheckout(user.id, {
      customerId,
      redirectUrl: `${origin}/settings?bill=return`,
      webhookUrl: `${origin}/api/billing/webhook`,
    })
    return NextResponse.json({ checkoutUrl })
  } catch (err) {
    console.error('BILLING_PAY_ERROR', err)
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 502 })
  }
}
