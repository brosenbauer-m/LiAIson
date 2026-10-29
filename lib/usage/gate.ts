import { spendPause } from '@/lib/usage/spend'
import { getUnpaidBill } from '@/lib/billing/monthly'
import { getSenderPlan, checkTrialMessageLimit, getTrialMessagesUsedToday, TRIAL_TOTAL_DAILY } from '@/lib/ratelimit/trial'
import { needsCard } from '@/lib/billing/access'

// The same pauses as sending a chat message, for other features paid per use
// (owner decision 2026-10-08: the person who uses AI pays for it). Returns
// why it is paused, or null. `message: true` also counts one free-month
// message (5 a day in total during the free month). `voice: true` (speaking a
// message, hearing an answer read aloud) counts none but pauses with chat once
// today's free messages are used up. During an event code period there is no
// daily cap; the event credit pays (spendPause).
export async function paidUsePause(userId: string, opts: { message?: boolean; voice?: boolean } = {}): Promise<{ error: string; status: number; needsCard?: boolean } | null> {
  const [card, spend, unpaid, plan] = await Promise.all([
    needsCard(userId).catch(() => false),
    spendPause(userId),
    getUnpaidBill(userId).catch(() => null),
    getSenderPlan(userId),
  ])
  if (card) return { error: 'Add a payment method in Settings to keep using LiAIson.', status: 402, needsCard: true }
  if (spend.paused) return { error: spend.message, status: 429 }
  if (unpaid) return { error: 'You have an unpaid bill. Please pay it in Settings.', status: 429 }
  if (plan.kind === 'trial_ended') return { error: 'Your free month has ended. Add a payment method in Settings.', status: 429 }
  if (opts.message && plan.kind === 'trial') {
    const trial = await checkTrialMessageLimit(userId)
    if (!trial.allowed) return { error: `You've used today's ${TRIAL_TOTAL_DAILY} free messages. You can chat again tomorrow.`, status: 429 }
  }
  if (opts.voice && plan.kind === 'trial') {
    const used = await getTrialMessagesUsedToday(userId).catch(() => 0)
    if (used >= TRIAL_TOTAL_DAILY) return { error: `You've used today's ${TRIAL_TOTAL_DAILY} free messages. You can use voice again tomorrow.`, status: 429 }
  }
  return null
}
