import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!password) {
    return NextResponse.json({ error: 'Please enter your password.' }, { status: 400 })
  }

  // Verify the password with a throwaway client that never touches the user's cookies.
  const verifier = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: verified, error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  })
  if (verifyError || verified.user?.id !== user.id) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const service = createServiceClient()

  // Remove stored files first (best effort). Deleting the auth user below removes all database rows.
  try {
    const { data: uploads } = await service.storage.from('uploads').list(user.id, { limit: 1000 })
    if (uploads && uploads.length > 0) {
      await service.storage.from('uploads').remove(uploads.map(f => `${user.id}/${f.name}`))
    }

    const { data: avatars } = await service.storage
      .from('avatars')
      .list('avatars', { limit: 100, search: user.id })
    const ownAvatars = (avatars ?? []).filter(f => f.name.startsWith(`${user.id}.`))
    if (ownAvatars.length > 0) {
      await service.storage.from('avatars').remove(ownAvatars.map(f => `avatars/${f.name}`))
    }
  } catch (e) {
    console.error('Account deletion: storage cleanup failed', e)
  }

  // Deleting the auth user cascades to public.users and every table that references it
  // (vault sections, folders, uploads, notifications, connections, visitor query logs).
  const { error: deleteError } = await service.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error('Account deletion failed', deleteError)
    return NextResponse.json(
      { error: 'Could not delete your account. Please try again or email contact@my-liaison.app.' },
      { status: 500 }
    )
  }

  await supabase.auth.signOut().catch(() => {})

  return NextResponse.json({ deleted: true })
}