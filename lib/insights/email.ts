import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, isEmailConfigured, escapeHtml } from '@/lib/email/scaleway'
import type { ReportContent } from '@/lib/insights/reports'

// Emails a saved report's highlights to its owner (if they haven't switched
// report emails off in Settings) and marks it as emailed. Never throws.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.my-liaison.app'

type ReportRow = {
  id: string
  profile_user_id: string
  period_type: 'week' | 'month'
  period_start: string
  period_end: string
  total: number
  report: ReportContent
}

function periodText(r: ReportRow): string {
  const tz = 'Europe/Vienna'
  const start = new Date(r.period_start)
  if (r.period_type === 'month') {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, month: 'long', year: 'numeric' }).format(start)
  }
  const lastDay = new Date(new Date(r.period_end).getTime() - 60 * 1000)
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short' })
  return `${fmt.format(start)} – ${fmt.format(lastDay)}`
}

export async function emailReport(r: ReportRow): Promise<'sent' | 'skipped' | 'failed'> {
  if (!isEmailConfigured()) return 'skipped'
  const supabase = createServiceClient()

  const { data: owner } = await supabase
    .from('users')
    .select('display_name, report_emails')
    .eq('id', r.profile_user_id)
    .single<{ display_name: string | null; report_emails: boolean }>()

  if (!owner || owner.report_emails === false) {
    await supabase.from('visitor_reports').update({ emailed_at: new Date().toISOString() }).eq('id', r.id)
    return 'skipped'
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(r.profile_user_id)
  const to = authUser?.user?.email
  if (!to) return 'failed'

  const c = r.report
  const kind = r.period_type === 'week' ? 'weekly' : 'monthly'
  const when = periodText(r)
  const top = c.categories.slice(0, 3)
  const reportsUrl = `${APP_URL}/insights`
  const settingsUrl = `${APP_URL}/settings`
  const name = owner.display_name?.split(' ')[0] ?? ''

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
  <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#777;margin:0 0 6px">Your ${kind} Echo · ${escapeHtml(when)}</p>
  <h1 style="font-size:24px;margin:0 0 12px">${escapeHtml(c.headline)}</h1>
  ${name ? `<p style="margin:0 0 12px">Hi ${escapeHtml(name)},</p>` : ''}
  ${c.summary ? `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(c.summary)}</p>` : ''}
  <p style="font-size:32px;font-weight:bold;margin:0">${c.total}</p>
  <p style="margin:0 0 16px;color:#555">${c.total === 1 ? 'question' : 'questions'} this ${r.period_type}${c.previousTotal !== null ? ` (previous: ${c.previousTotal})` : ''}</p>
  <h2 style="font-size:16px;margin:20px 0 8px">What people wanted to know</h2>
  <ul style="padding-left:18px;margin:0 0 16px">
    ${top.map(t => `<li style="margin-bottom:6px"><strong>${escapeHtml(t.category)}</strong> (${t.count})${t.examples[0] ? `<br><span style="color:#555">${escapeHtml(t.examples[0])}</span>` : ''}</li>`).join('')}
  </ul>
  ${c.suggestions.length ? `<h2 style="font-size:16px;margin:20px 0 8px">Ideas for your Vault</h2><ul style="padding-left:18px;margin:0 0 16px">${c.suggestions.map(s => `<li style="margin-bottom:6px">${escapeHtml(s)}</li>`).join('')}</ul>` : ''}
  <p style="margin:24px 0"><a href="${reportsUrl}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">See your full Echo</a></p>
  <p style="font-size:12px;color:#777;line-height:1.5">Echoes are anonymous: they never show who asked or their exact words. You can turn these emails off in <a href="${settingsUrl}" style="color:#777">Settings</a>.</p>
</div>`

  const text =
    `Your ${kind} Echo (${when})\n\n${c.headline}\n\n` +
    (c.summary ? `${c.summary}\n\n` : '') +
    `${c.total} ${c.total === 1 ? 'question' : 'questions'} this ${r.period_type}.\n\n` +
    `What people wanted to know:\n${top.map(t => `- ${t.category} (${t.count})${t.examples[0] ? `: ${t.examples[0]}` : ''}`).join('\n')}\n\n` +
    (c.suggestions.length ? `Ideas for your Vault:\n${c.suggestions.map(s => `- ${s}`).join('\n')}\n\n` : '') +
    `See your full Echo: ${reportsUrl}\nTurn these emails off: ${settingsUrl}`

  try {
    await sendEmail({
      from: { email: 'noreply@my-liaison.app', name: 'LiAIson' },
      to,
      subject: `Your ${kind} Echo: ${c.headline}`.slice(0, 150),
      html,
      text,
    })
    await supabase.from('visitor_reports').update({ emailed_at: new Date().toISOString() }).eq('id', r.id)
    return 'sent'
  } catch (err) {
    console.error('REPORT_EMAIL_ERROR', r.id, err)
    return 'failed'
  }
}

// Sends any recent reports that have not been emailed yet (retries failures
// for up to 3 days, never emails old reports).
export async function emailPendingReports(): Promise<{ sent: number; skipped: number; failed: number }> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
  const { data } = await supabase
    .from('visitor_reports')
    .select('id, profile_user_id, period_type, period_start, period_end, total, report')
    .is('emailed_at', null)
    .gte('created_at', since)
    .limit(500)

  const stats = { sent: 0, skipped: 0, failed: 0 }
  for (const row of (data as ReportRow[] | null) ?? []) {
    stats[await emailReport(row)] += 1
  }
  return stats
}
