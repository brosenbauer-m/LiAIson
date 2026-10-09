import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// "Use a different email" on the sign-up page: deletes the account that was
// just created but not yet confirmed, so the person can sign up again with the
// same username and their other details. Only works with the one-time code
// (signup_nonce) that the sign-up form stored in that account, only for
// unconfirmed accounts and only within 24 hours of sign-up.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { userId, nonce } = body as { userId?: unknown; nonce?: unknown }
  if (typeof userId !== 'string' || !UUID.test(userId) || typeof nonce !== 'string' || !UUID.test(nonce)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.auth.admin.getUserById(userId)
  const user = data?.user
  const createdAt = user?.created_at ? new Date(user.created_at).getTime() : 0
  if (
    error ||
    !user ||
    user.email_confirmed_at ||
    user.user_metadata?.signup_nonce !== nonce ||
    Date.now() - createdAt > 24 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('DISCARD_SIGNUP_ERROR', deleteError.message)
    return NextResponse.json({ error: 'Could not undo the sign-up' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
