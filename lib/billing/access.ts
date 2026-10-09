import { createServiceClient } from '@/lib/supabase/service'

// After the free month, a saved card is needed to use the app (owner decision
// 2026-10-09). Until then the person is sent to /billing/setup, where they can
// add a card and change their plan. billing_exempt accounts are never locked.
// If billing data can't be read, the person is NOT locked out (chat has its own check).
export async function needsCard(userId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('billing_exempt, trial_ends_at')
    .eq('id', userId)
    .maybeSingle<{ billing_exempt: boolean; trial_ends_at: string }>()
  if (error || !user || user.billing_exempt) return false
  if (new Date(user.trial_ends_at) > new Date()) return false
  const { data: account, error: accountError } = await supabase
    .from('billing_accounts')
    .select('mandate_status, mandate_id')
    .eq('user_id', userId)
    .maybeSingle<{ mandate_status: string; mandate_id: string | null }>()
  if (accountError) return false
  return !(account?.mandate_status === 'valid' && account.mandate_id)
}
