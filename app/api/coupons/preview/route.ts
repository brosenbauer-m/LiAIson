import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { underLimit } from '@/lib/redis'
import { previewCoupon } from '@/lib/coupons'

// What an event code gives, before it is used. GET ?code=…&for=signup (anyone,
// for the sign-up form) or without `for` (the signed-in person, for Settings).
// Guessing is rate-limited per address; the answer never says more than the
// code's own offer.

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!(await underLimit(`coupon:preview:${ip}`, 40, 3600))) {
    return NextResponse.json({ ok: false, reason: 'Too many tries. Please wait a little.' }, { status: 429 })
  }
  const code = request.nextUrl.searchParams.get('code') ?? ''
  const forSignup = request.nextUrl.searchParams.get('for') === 'signup'
  try {
    if (forSignup) return NextResponse.json(await previewCoupon(code, { newAccount: true }), { headers: { 'Cache-Control': 'no-store' } })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, reason: 'Please sign in.' }, { status: 401 })
    return NextResponse.json(await previewCoupon(code, { newAccount: false, userId: user.id }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('COUPON_PREVIEW_ERROR', err)
    return NextResponse.json({ ok: false, reason: 'The code could not be checked right now.' }, { status: 500 })
  }
}
