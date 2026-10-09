import { createServiceClient } from '@/lib/supabase/service'

// Accounts whose email was never confirmed (owner decision 2026-10-09):
// - day 7 and day 27 after sign-up: the confirmation email is sent again
//   (Supabase "Confirm signup" template, which says unconfirmed accounts are
//   deleted after 30 days);
// - day 30: the account is deleted (its profile and Vault go with it).
// Runs once a day from the billing cron. Accounts marked billing_exempt are
// never touched, and at most MAX_DELETES accounts are deleted per run.

const DAY = 24 * 60 * 60 * 1000
const REMIND_DAYS = [7, 27]
const DELETE_DAYS = 30
const MAX_DELETES = 50

export type UnverifiedSummary = { checked: number; reminded: number; deleted: number; errors: number }

export async function processUnverifiedAccounts(siteUrl: string, now = new Date()): Promise<UnverifiedSummary> {
  const supabase = createServiceClient()
  const summary: UnverifiedSummary = { checked: 0, reminded: 0, deleted: 0, errors: 0 }

  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(error.message)
    const users = data?.users ?? []

    for (const user of users) {
      if (user.email_confirmed_at || !user.email) continue
      summary.checked++
      const ageDays = (now.getTime() - new Date(user.created_at).getTime()) / DAY

      try {
        if (ageDays >= DELETE_DAYS) {
          if (summary.deleted >= MAX_DELETES) continue
          const { data: row } = await supabase
            .from('users')
            .select('billing_exempt')
            .eq('id', user.id)
            .maybeSingle<{ billing_exempt: boolean }>()
          if (row?.billing_exempt) continue
          const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
          if (deleteError) throw new Error(deleteError.message)
          summary.deleted++
          continue
        }

        const sent = Number(user.app_metadata?.verify_reminders ?? 0)
        const due = REMIND_DAYS.filter(d => ageDays >= d).length
        if (due > sent) {
          const { error: resendError } = await supabase.auth.resend({
            type: 'signup',
            email: user.email,
            options: { emailRedirectTo: `${siteUrl}/auth/callback` },
          })
          if (resendError) throw new Error(resendError.message)
          const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            app_metadata: { ...user.app_metadata, verify_reminders: due },
          })
          if (updateError) throw new Error(updateError.message)
          summary.reminded++
        }
      } catch (err) {
        console.error('UNVERIFIED_ACCOUNT_ERROR', user.id, err)
        summary.errors++
      }
    }

    if (users.length < 1000) break
  }

  return summary
}
