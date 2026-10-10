import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// The Plans page was merged (owner decision 2026-10-10): choosing a tier
// happens at sign-up, changing it in Settings → Subscription. Old links land
// in the right place.
export default async function PlansRedirect() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  redirect(user ? '/settings#subscription' : '/signup')
}
