import { createServiceClient } from '@/lib/supabase/service'
import { sendEmail, isEmailConfigured, escapeHtml } from '@/lib/email/scaleway'

// Billing emails (server-only): monthly bill paid / payment failed.

const APP_URL = 'https://www.my-liaison.app'

function euros(n: number): string {
  return `€${n.toFixed(2)}`
}

export async function sendMonthlyBillEmail(documentId: number, kind: 'paid' | 'failed'): Promise<void> {
  if (!isEmailConfigured()) return
  const supabase = createServiceClient()
  const { data: doc } = await supabase
    .from('billing_documents')
    .select('user_id, customer_email, customer_name, period_start, total_eur, prepaid_applied_eur, receipt_number')
    .eq('id', documentId)
    .single<{
      user_id: string | null
      customer_email: string | null
      customer_name: string | null
      period_start: string | null
      total_eur: number | string
      prepaid_applied_eur: number | string
      receipt_number: string | null
    }>()
  if (!doc?.customer_email) return

  const month = doc.period_start
    ? new Date(doc.period_start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })
    : 'last month'
  const total = Number(doc.total_eur) || 0
  const prepaid = Number(doc.prepaid_applied_eur) || 0
  const name = doc.customer_name?.split(' ')[0] ?? ''
  const receiptUrl = doc.receipt_number ? `${APP_URL}/billing/receipts/${doc.receipt_number}` : `${APP_URL}/billing/receipts`
  const settingsUrl = `${APP_URL}/settings`

  let subject: string
  let lines: string[]
  let button: { label: string; url: string }
  if (kind === 'paid') {
    subject = total > 0 ? `Your LiAIson bill for ${month}: ${euros(total)} paid` : `Your LiAIson usage for ${month} was covered by your credit`
    lines = total > 0
      ? [`We charged ${euros(total)} to your saved payment method for your LiAIson usage in ${month}.${prepaid > 0 ? ` ${euros(prepaid)} was paid from your prepaid credit first.` : ''}`]
      : [`Your LiAIson usage in ${month} (${euros(prepaid)}) was paid from your prepaid credit. Nothing was charged to your card.`]
    button = { label: 'View receipt', url: receiptUrl }
  } else {
    subject = `Action needed: your LiAIson bill for ${month} (${euros(total)})`
    lines = [
      `We couldn't charge ${euros(total)} for your LiAIson usage in ${month}.`,
      'Until it is paid, you can’t send new messages. Your own LiAIson stays online for others.',
      'You can pay it in Settings with any payment method.',
    ]
    button = { label: 'Pay now', url: settingsUrl }
  }

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#111">
  ${name ? `<p style="margin:0 0 12px">Hi ${escapeHtml(name)},</p>` : ''}
  ${lines.map(l => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(l)}</p>`).join('')}
  <p style="margin:24px 0"><a href="${button.url}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(button.label)}</a></p>
  <p style="font-size:12px;color:#777;line-height:1.5">You only pay for the messages you send (AI cost + 30%). Amounts under €5 carry over to the next month.</p>
</div>`
  const text = `${name ? `Hi ${name},\n\n` : ''}${lines.join('\n\n')}\n\n${button.label}: ${button.url}`

  await sendEmail({
    from: { email: 'noreply@my-liaison.app', name: 'LiAIson' },
    to: doc.customer_email,
    subject: subject.slice(0, 150),
    html,
    text,
  })
}
