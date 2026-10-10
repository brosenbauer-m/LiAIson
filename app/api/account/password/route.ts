import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { underLimit } from '@/lib/redis'

// Change password (Settings). Needs the current password, checked with a
// throwaway client that never touches the person's cookies; a few tries per
// 15 minutes. Afterwards all other sessions (other devices) are signed out.

const MIN = 8
const MAX = 72

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const body = await request.json().catch(() => null) as { current?: unknown; next?: unknown } | null
  const current = typeof body?.current === 'string' ? body.current : ''
  const next = typeof body?.next === 'string' ? body.next : ''
  if (!current) return NextResponse.json({ error: 'Please enter your current password.' }, { status: 400 })
  if (next.length < MIN || next.length > MAX) {
    return NextResponse.json({ error: `Your new password needs ${MIN} to ${MAX} characters.` }, { status: 400 })
  }
  if (next === current) return NextResponse.json({ error: 'Please choose a password you have not used just now.' }, { status: 400 })

  if (!(await underLimit(`pwchange:${user.id}`, 5, 900))) {
    return NextResponse.json({ error: 'Too many tries. Please wait 15 minutes.' }, { status: 429 })
  }

  const verifier = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({ email: user.email, password: current })
  if (verifyError || verified.user?.id !== user.id) {
    return NextResponse.json({ error: 'Your current password is not correct.' }, { status: 401 })
  }

  const service = createServiceClient()
  const { error } = await service.auth.admin.updateUserById(user.id, { password: next })
  if (error) {
    const weak = /weak|short|password/i.test(error.message)
    return NextResponse.json({ error: weak ? 'Please choose a stronger password.' : 'Could not change your password. Please try again.' }, { status: 400 })
  }

  // Sign out every other session (other devices, and the throwaway check
  // session above); this one stays signed in.
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) await service.auth.admin.signOut(session.access_token, 'others').catch(() => {})

  return NextResponse.json({ ok: true })
}
