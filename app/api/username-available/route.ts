import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { RESERVED_USERNAMES, USERNAME_REGEX } from '@/lib/constants/username'

// Sign-up helper: is this username free? Returns only true/false, never any
// user data. Needed because the users table is no longer publicly readable.
export async function GET(request: NextRequest) {
  const username = (request.nextUrl.searchParams.get('u') ?? '').trim().toLowerCase()

  if (!USERNAME_REGEX.test(username) || RESERVED_USERNAMES.includes(username)) {
    return NextResponse.json({ available: false, valid: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .limit(1)

  if (error) {
    return NextResponse.json({ error: 'Check failed' }, { status: 500 })
  }

  return NextResponse.json(
    { available: (data ?? []).length === 0, valid: true },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
