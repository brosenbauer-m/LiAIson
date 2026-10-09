import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { handleMolliePayment } from '@/lib/billing/payments'
import { createOneOffPayment, createSavedCardPayment, MollieError } from '@/lib/billing/mollie'
import { ensureMollieCustomer, getBillingAccount, saveBillingAccount } from '@/lib/billing/account'
import { isEuCountry, toCountryCode } from '@/lib/billing/countries'
import { vatBreakdown, formatEur } from '@/lib/billing/vat'
import {
  TOPUP_AMOUNTS_EUR,
  isTopUpAmount,
  getBalanceEur,
  getRecentReceipts,
  hasRecentPendingTopUp,
  recordPendingTopUp,
} from '@/lib/billing/topup'

// Prepaid balance of the signed-in user.
// GET  → { balanceEur, amounts, receipts, billingCountry, savedCard }
// POST { amount: 5|10|20, country?, useSavedCard? }
//      → { checkoutUrl } (Mollie checkout) or, with useSavedCard, { status } (charged to the saved card)

async function getSignedInUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    const [balanceEur, receipts, account] = await Promise.all([
      getBalanceEur(user.id),
      getRecentReceipts(user.id),
      getBillingAccount(user.id),
    ])
    return NextResponse.json(
      {
        balanceEur,
        amounts: TOPUP_AMOUNTS_EUR,
        receipts,
        billingCountry: account?.billing_country ?? null,
        savedCard: account?.mandate_status === 'valid' && account.mandate_id ? account.card_label : null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('BILLING_TOPUP_GET_ERROR', err)
    return NextResponse.json({ error: 'Could not load your balance' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { amount, country: requestedCountry, useSavedCard } = (body ?? {}) as { amount?: unknown; country?: unknown; useSavedCard?: unknown }
  if (!isTopUpAmount(amount)) {
    return NextResponse.json({ error: 'Please choose €5, €10 or €20.' }, { status: 400 })
  }

  try {
    const account = await getBillingAccount(user.id)
    const country = account?.billing_country ?? (isEuCountry(requestedCountry) ? requestedCountry : null)
    if (!country) {
      return NextResponse.json({ error: 'Please choose your country (EU only for now).' }, { status: 400 })
    }

    if (await hasRecentPendingTopUp(user.id)) {
      return NextResponse.json({ error: 'Please wait a moment and try again.' }, { status: 429 })
    }

    const customerId = await ensureMollieCustomer(user.id, user.email)
    if (!account?.billing_country) {
      await saveBillingAccount(user.id, {
        billing_country: country,
        ip_country: toCountryCode(request.headers.get('x-vercel-ip-country')),
      })
    }

    // The credit is the chosen amount; VAT (only once VAT is switched on) is added on top.
    const vat = vatBreakdown(amount, country)

    const origin = request.nextUrl.origin
    const webhookUrl = `${origin}/api/billing/webhook`
    const description = `LiAIson – prepaid credit €${formatEur(amount)}`
    const metadata = { userId: user.id, purpose: 'topup' }

    const supabase = createServiceClient()
    const { data: profile } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single<{ display_name: string }>()
    const pending = {
      userId: user.id,
      creditEur: amount,
      vatRate: vat.vatRate,
      vatEur: vat.vatEur,
      totalEur: vat.totalEur,
      vatExempt: vat.vatExempt,
      country,
      customerName: profile?.display_name ?? null,
      customerEmail: user.email ?? null,
    }

    // Pay with the saved card: no checkout page; Mollie confirms via the webhook.
    if (useSavedCard === true) {
      const fresh = await getBillingAccount(user.id)
      if (fresh?.mandate_status !== 'valid' || !fresh.mandate_id) {
        return NextResponse.json({ error: 'No saved card. Please add a card first.' }, { status: 400 })
      }
      const payment = await createSavedCardPayment({
        customerId,
        mandateId: fresh.mandate_id,
        amountEur: formatEur(vat.totalEur),
        description,
        webhookUrl,
        metadata,
      })
      await recordPendingTopUp({ ...pending, paymentId: payment.id })
      // Card payments are often confirmed instantly; handle that right away
      // (the webhook does the same later; crediting happens only once).
      if (payment.status === 'paid') await handleMolliePayment(payment.id)
      if (payment.status === 'failed' || payment.status === 'canceled' || payment.status === 'expired') {
        await handleMolliePayment(payment.id)
        return NextResponse.json({ error: 'Your saved card was declined. Please use another payment method.' }, { status: 402 })
      }
      return NextResponse.json({ status: payment.status })
    }

    const payment = await createOneOffPayment({
      customerId,
      amountEur: formatEur(vat.totalEur),
      description,
      redirectUrl: `${origin}/settings?topup=return`,
      webhookUrl,
      metadata,
    })
    const checkoutUrl = payment._links?.checkout?.href
    if (!checkoutUrl) throw new Error('Mollie returned no checkout link')

    await recordPendingTopUp({ ...pending, paymentId: payment.id })

    return NextResponse.json({ checkoutUrl })
  } catch (err) {
    console.error('BILLING_TOPUP_ERROR', err instanceof MollieError ? `${err.status} ${err.message}` : err)
    return NextResponse.json({ error: 'Could not start the top-up. Please try again.' }, { status: 502 })
  }
}
