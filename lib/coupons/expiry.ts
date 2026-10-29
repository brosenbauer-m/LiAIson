import { createServiceClient } from '@/lib/supabase/service'
import { getBalanceEur } from '@/lib/billing/topup'
import { billableInPeriodEur } from '@/lib/billing/monthly'
import { currentPeriod } from '@/lib/insights/periods'

// Owner decision 2026-10-28: event credit that is left when the period ends
// is gone. Runs daily (billing cron). For each ended period not yet handled:
// what is left of the balance after this month's unbilled usage, at most the
// credit the code gave, minus credit from a period that is still running, is
// taken away (balance entry 'coupon_expiry'). Never throws for one person.

const round2 = (n: number) => Math.round(n * 100) / 100

export type ExpirySummary = { checked: number; expired: number; expiredEur: number; errors: number }

export async function expireSponsoredCredit(now = new Date()): Promise<ExpirySummary> {
  const supabase = createServiceClient()
  const summary: ExpirySummary = { checked: 0, expired: 0, expiredEur: 0, errors: 0 }
  const { data, error } = await supabase
    .from('coupon_redemptions')
    .select('id, user_id, credit_eur, period_ends_at')
    .is('credit_expired_at', null)
    .lte('period_ends_at', now.toISOString())
    .order('period_ends_at', { ascending: true })
    .limit(200)
  if (error) throw new Error(error.message)

  for (const r of (data as { id: number; user_id: string; credit_eur: number | string; period_ends_at: string }[] | null) ?? []) {
    summary.checked++
    try {
      const { data: user } = await supabase.from('users').select('trial_ends_at').eq('id', r.user_id).maybeSingle<{ trial_ends_at: string }>()
      const period = currentPeriod('month', now)
      const [balance, unbilled, { data: others }] = await Promise.all([
        getBalanceEur(r.user_id),
        billableInPeriodEur(r.user_id, period.start, now, user ? new Date(user.trial_ends_at) : now),
        supabase.from('coupon_redemptions').select('credit_eur').eq('user_id', r.user_id).is('credit_expired_at', null).gt('period_ends_at', now.toISOString()),
      ])
      const stillRunning = ((others as { credit_eur: number | string }[] | null) ?? []).reduce((s, o) => s + (Number(o.credit_eur) || 0), 0)
      const remaining = balance - unbilled - stillRunning
      const expire = round2(Math.max(0, Math.min(Number(r.credit_eur) || 0, remaining)))
      if (expire > 0) {
        const { error: entryError } = await supabase.from('billing_balance_entries').insert({ user_id: r.user_id, amount_eur: -expire, kind: 'coupon_expiry' })
        if (entryError) throw new Error(entryError.message)
      }
      const { error: markError } = await supabase.from('coupon_redemptions').update({ credit_expired_at: now.toISOString() }).eq('id', r.id).is('credit_expired_at', null)
      if (markError) throw new Error(markError.message)
      summary.expired++
      summary.expiredEur = round2(summary.expiredEur + expire)
    } catch (err) {
      console.error('COUPON_EXPIRY_ERROR', r.id, err)
      summary.errors++
    }
  }
  return summary
}
