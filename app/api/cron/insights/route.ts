import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { previousPeriod, viennaDateParts, type Period } from '@/lib/insights/periods'
import { buildAndStoreReport } from '@/lib/insights/reports'
import { emailPendingReports } from '@/lib/insights/email'

// Daily job (Vercel Cron, see vercel.json). Protected by CRON_SECRET.
// - Every Monday (Vienna time): weekly report for the week that just ended (Mon–Sun).
// - Every 1st of the month (Vienna time): monthly report for the calendar month that just ended.
// - Every day: email reports that have not been emailed yet (owners can opt out in Settings).
// - Every day: delete anonymous visitor_insights older than 35 days.
// Reports are unique per owner and period, so re-running is safe.

export const maxDuration = 60

const RETENTION_DAYS = 35

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const today = viennaDateParts(now)

  // Optional manual run for a specific report type: ?run=week or ?run=month
  const manual = request.nextUrl.searchParams.get('run')
  const periods: Period[] = []
  if (today.weekday === 0 || manual === 'week') periods.push(previousPeriod('week', now))
  if (today.day === 1 || manual === 'month') periods.push(previousPeriod('month', now))

  const summary: Record<string, { created: number; exists: number; empty: number; failed: number }> = {}

  for (const period of periods) {
    const stats = { created: 0, exists: 0, empty: 0, failed: 0 }

    const { data: owners } = await supabase
      .from('visitor_insights')
      .select('profile_user_id')
      .gte('created_at', period.start.toISOString())
      .lt('created_at', period.end.toISOString())
      .limit(10000)

    const ownerIds = Array.from(new Set(((owners as { profile_user_id: string }[] | null) ?? []).map(o => o.profile_user_id)))

    for (const ownerId of ownerIds) {
      try {
        const result = await buildAndStoreReport(ownerId, period)
        stats[result] += 1
      } catch (err) {
        console.error('INSIGHTS_REPORT_ERROR', ownerId, period.type, err)
        stats.failed += 1
      }
    }
    summary[period.type] = stats
  }

  // Email new reports (respects users.report_emails; retries for up to 3 days).
  let emails: { sent: number; skipped: number; failed: number } | 'failed'
  try {
    emails = await emailPendingReports()
  } catch (err) {
    console.error('REPORT_EMAILS_ERROR', err)
    emails = 'failed'
  }

  // Rotation: raw anonymous statements are kept ~35 days only.
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString()
  const { error: cleanupError, count: deleted } = await supabase
    .from('visitor_insights')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)

  return NextResponse.json({
    viennaDate: `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`,
    reports: summary,
    emails,
    cleanup: cleanupError ? 'failed' : { deleted: deleted ?? 0 },
  })
}
