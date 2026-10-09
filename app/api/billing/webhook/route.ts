import { NextRequest, NextResponse } from 'next/server'
import { handleCardSetupPayment } from '@/lib/billing/account'

// Mollie webhook. Mollie only sends the payment id ("id=tr_…"); we never trust
// anything else in the request and always fetch the payment from Mollie with
// our own API key (see handleCardSetupPayment). Unknown ids are ignored.
// Always answers 200 for well-formed ids so Mollie doesn't retry forever;
// on our own errors it answers 500 so Mollie retries later.

export async function POST(request: NextRequest) {
  let id: string | null = null
  try {
    const form = await request.formData()
    const value = form.get('id')
    id = typeof value === 'string' ? value : null
  } catch {
    id = null
  }

  if (!id || !/^tr_[A-Za-z0-9]{4,64}$/.test(id)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  try {
    await handleCardSetupPayment(id)
    return new NextResponse(null, { status: 200 })
  } catch (err) {
    console.error('MOLLIE_WEBHOOK_ERROR', err)
    return new NextResponse(null, { status: 500 })
  }
}
