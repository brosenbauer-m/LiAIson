import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSenderPlan, getTrialMessagesUsedToday, TRIAL_TOTAL_DAILY } from '@/lib/ratelimit/trial'

// Free-month status of the signed-in user, shown under the chat:
// plan, trial end date and free messages left today. Read-only.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const plan = await getSenderPlan(user.id)
  let messagesLeftToday: number | null = null
  if (plan.kind === 'trial') {
    const used = await getTrialMessagesUsedToday(user.id).catch(() => null)
    messagesLeftToday = used === null ? null : Math.max(0, TRIAL_TOTAL_DAILY - used)
  }
  return NextResponse.json(
    {
      plan: plan.kind,
      trialEndsAt: 'trialEndsAt' in plan && plan.trialEndsAt ? plan.trialEndsAt : null,
      dailyLimit: TRIAL_TOTAL_DAILY,
      messagesLeftToday,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
