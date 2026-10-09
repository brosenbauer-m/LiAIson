import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCardSetupPayment, revokeMandate, MollieError } from '@/lib/billing/mollie'
import { ensureMollieCustomer, getBillingAccount, saveBillingAccount, syncPendingAccount } from '@/lib/billing/account'
import { isEuCountry, toCountryCode } from '@/lib/billing/countries'

// The signed-in user's saved card (Mollie mandate).
// GET    → { status, cardLabel, billingCountry }
// POST   { country } → { checkoutUrl } for Mollie's €0 card check
// DELETE → removes the saved card

async function getSignedInUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function publicView(a: { mandate_status: string; card_label: string | null; billing_country: string | null } | null) {
  return {
    status: a?.mandate_status ?? 'none',
    cardLabel: a?.mandate_status === 'valid' ? a.card_label : null,
    billingCountry: a?.billing_country ?? null,
  }
}

export async function GET() {
  const user = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    let account = await getBillingAccount(user.id)
    if (account) account = await syncPendingAccount(account)
    return NextResponse.json(publicView(account), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('BILLING_CARD_GET_ERROR', err)
    return NextResponse.json({ error: 'Could not load your payment method' }, { status: 500 })
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
  const country = (body as { country?: unknown })?.country
  if (!isEuCountry(country)) {
    return NextResponse.json({ error: 'Please choose your country (EU only for now).' }, { status: 400 })
  }

  try {
    const account = await getBillingAccount(user.id)

    // Small guard against repeated clicks: one card check per 20 seconds.
    if (account?.mandate_status === 'pending' && Date.now() - new Date(account.updated_at).getTime() < 20_000) {
      return NextResponse.json({ error: 'Please wait a moment and try again.' }, { status: 429 })
    }

    const customerId = await ensureMollieCustomer(user.id, user.email)

    const origin = request.nextUrl.origin
    const payment = await createCardSetupPayment({
      customerId,
      userId: user.id,
      redirectUrl: `${origin}/settings?card=return`,
      webhookUrl: `${origin}/api/billing/webhook`,
    })
    const checkoutUrl = payment._links?.checkout?.href
    if (!checkoutUrl) throw new Error('Mollie returned no checkout link')

    await saveBillingAccount(user.id, {
      mollie_customer_id: customerId,
      billing_country: country,
      ip_country: toCountryCode(request.headers.get('x-vercel-ip-country')),
      // Keep an existing valid card usable until the new one is confirmed.
      mandate_status: account?.mandate_status === 'valid' ? 'valid' : 'pending',
    })

    return NextResponse.json({ checkoutUrl })
  } catch (err) {
    console.error('BILLING_CARD_SETUP_ERROR', err instanceof MollieError ? `${err.status} ${err.message}` : err)
    return NextResponse.json({ error: 'Could not start the card check. Please try again.' }, { status: 502 })
  }
}

export async function DELETE() {
  const user = await getSignedInUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    const account = await getBillingAccount(user.id)
    if (account?.mollie_customer_id && account.mandate_id) {
      await revokeMandate(account.mollie_customer_id, account.mandate_id).catch(err => {
        if (!(err instanceof MollieError && (err.status === 404 || err.status === 410))) throw err
      })
    }
    if (account) {
      await saveBillingAccount(user.id, { mandate_id: null, mandate_status: 'none', card_label: null, card_country: null })
    }
    return NextResponse.json(publicView(account ? { ...account, mandate_status: 'none', card_label: null } : null))
  } catch (err) {
    console.error('BILLING_CARD_DELETE_ERROR', err)
    return NextResponse.json({ error: 'Could not remove your card. Please try again.' }, { status: 502 })
  }
}
