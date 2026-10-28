import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// The one admin account (users.is_admin, set once at sign-up — migration 40).
// Server-only. Every admin page and /api/admin route starts with requireAdmin().

export async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await createServiceClient()
    .from('users')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle<{ is_admin: boolean }>()
  return data?.is_admin === true
}

// The signed-in admin's id, or null (not signed in, or not the admin).
export async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return (await isAdminUser(user.id)) ? user.id : null
}
