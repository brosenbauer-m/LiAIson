import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { previousPeriod, viennaDateParts } from '@/lib/insights/periods'
import { billMonth, type BillResult } from '@/lib/billing/monthly'

// Daily job (Vercel Cron, see vercel.json). Protected by CRON_SECRET.
// On the 1st of the month (Vienna time) — or with ?run=month — bills the month
// that just ended for everyone who sent messages in it or has an amount carried
// over. Bills are unique per user and month, so re-running is safe.

export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const manual = request.nextUrl.searchParams.get('run') === 'month'
  if (viennaDateParts(now).day !== 1 && !manual) {
    return NextResponse.json({ ok: true, skipped: 'not the 1st' })
  }

  const period = previousPeriod('month', now)
  const supabase = createServiceClient()

  const userIds = new Set<string>()
  const { data: senders } = await supabase
    .from('ai_usage')
    .select('user_id')
    .in('feature', ['chat', 'topic'])
    .gte('created_at', period.start.toISOString())
    .lt('created_at', period.end.toISOString())
    .limit(100000)
  for (const r of (senders as { user_id: string }[] | null) ?? []) userIds.add(r.user_id)

  const { data: carried } = await supabase
    .from('billing_documents')
    .select('user_id')
    .eq('kind', 'monthly')
    .eq('status', 'carried_over')
    .lt('period_start', period.start.toISOString())
    .limit(100000)
  for (const r of (carried as { user_id: string | null }[] | null) ?? []) if (r.user_id) userIds.add(r.user_id)

  const webhookUrl = `${request.nextUrl.origin}/api/billing/webhook`
  const summary: Partial<Record<BillResult | 'error', number>> = {}
  for (const userId of userIds) {
    try {
      const result = await billMonth(userId, period, { webhookUrl })
      summary[result] = (summary[result] ?? 0) + 1
    } catch (err) {
      console.error('MONTHLY_BILL_ERROR', userId, err)
      summary.error = (summary.error ?? 0) + 1
    }
  }

  return NextResponse.json({ ok: true, period: { start: period.start, end: period.end }, users: userIds.size, summary })
}
