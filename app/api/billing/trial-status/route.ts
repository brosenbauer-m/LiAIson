import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSenderPlan, getTrialMessagesUsedToday, TRIAL_TOTAL_DAILY } from '@/lib/ratelimit/trial'
import { getMonthUsage } from '@/lib/usage/spend'
import { getBalanceEur } from '@/lib/billing/topup'

// Free-month status of the signed-in user, shown under the chat:
// plan, trial end date and free messages left today; during an event code
// period, its end and the credit left this month. Read-only.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const plan = await getSenderPlan(user.id)
  let messagesLeftToday: number | null = null
  let creditLeftCents: number | null = null
  if (plan.kind === 'trial') {
    const used = await getTrialMessagesUsedToday(user.id).catch(() => null)
    messagesLeftToday = used === null ? null : Math.max(0, TRIAL_TOTAL_DAILY - used)
  }
  if (plan.kind === 'sponsored') {
    const [usage, credit] = await Promise.all([getMonthUsage(user.id).catch(() => null), getBalanceEur(user.id).catch(() => 0)])
    if (usage) creditLeftCents = Math.max(0, Math.round(credit * 100 - usage.costCents))
  }
  return NextResponse.json(
    {
      plan: plan.kind,
      trialEndsAt: 'trialEndsAt' in plan && plan.trialEndsAt ? plan.trialEndsAt : null,
      sponsoredUntil: plan.kind === 'sponsored' ? plan.sponsoredUntil : null,
      creditLeftCents,
      dailyLimit: TRIAL_TOTAL_DAILY,
      messagesLeftToday,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
