import { createServiceClient } from '@/lib/supabase/service'
import { createSavedCardPayment, createOneOffPayment, type MolliePayment } from '@/lib/billing/mollie'
import { getBillingAccount } from '@/lib/billing/account'
import { getBalanceEur } from '@/lib/billing/topup'
import { vatBreakdown, formatEur } from '@/lib/billing/vat'
import { rawCostEur, isMeteredFeature, MARKUP } from '@/lib/usage/spend'
import { sendMonthlyBillEmail } from '@/lib/billing/emails'
import { planFeeFor } from '@/lib/billing/planFee'

// Month-end billing (owner decisions 2026-10-09):
// - The sender pays for their own messages: AI cost + 30%.
// - Plus the monthly plan fee (lib/billing/planFee.ts), on the same bill.
// - Messages sent during the free trial are free; billing_exempt accounts never pay.
// - Prepaid credit is used first.
// - Whatever is left is charged ONCE to the saved card, but only if it is €5 or
//   more; smaller amounts carry over to the next month.
// - A failed charge (or no saved card) marks the bill 'failed': the user is
//   emailed, can pay it in Settings, and can't send messages until it is paid.
// One bill per user and month (unique index), so re-running is safe.

export const MIN_CHARGE_EUR = 5

const round4 = (n: number) => Math.round(n * 10000) / 10000
const round2 = (n: number) => Math.round(n * 100) / 100

// Usage (incl. markup) the user sent between start and end.
export async function billableUsageEur(userId: string, start: Date, end: Date): Promise<number> {
  if (end <= start) return 0
  const supabase = createServiceClient()
  let raw = 0
  let from = 0
  const pageSize = 1000
  for (;;) {
    const { data, error } = await supabase
      .from('ai_usage')
      .select('feature, model, prompt_tokens, completion_tokens')
      .eq('user_id', userId)
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString())
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const rows = (data as { feature: string; model: string; prompt_tokens: number; completion_tokens: number }[] | null) ?? []
    for (const r of rows) {
      if (isMeteredFeature(r.feature)) raw += rawCostEur(r.model, r.prompt_tokens, r.completion_tokens)
    }
    if (rows.length < pageSize) break
    from += pageSize
  }
  return round4(raw * (1 + MARKUP))
}

export type BillResult =
  | 'exempt'
  | 'nothing'
  | 'exists'
  | 'carried_over'
  | 'paid_from_credit'
  | 'charging'
  | 'paid'
  | 'failed'

export async function billMonth(
  userId: string,
  period: { start: Date; end: Date },
  opts: { ignoreExemptAndTrial?: boolean; extraUsageEur?: number; webhookUrl: string } = { webhookUrl: '' }
): Promise<BillResult> {
  const supabase = createServiceClient()

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('display_name, billing_exempt, trial_ends_at')
    .eq('id', userId)
    .single<{ display_name: string; billing_exempt: boolean; trial_ends_at: string }>()
  if (userError || !user) throw new Error(userError?.message ?? 'user not found')
  if (user.billing_exempt && !opts.ignoreExemptAndTrial) return 'exempt'

  const { data: existing } = await supabase
    .from('billing_documents')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'monthly')
    .eq('period_start', period.start.toISOString())
    .maybeSingle()
  if (existing) return 'exists'

  // Usage after the free trial ended.
  const trialEnd = new Date(user.trial_ends_at)
  const usageStart = opts.ignoreExemptAndTrial ? period.start : new Date(Math.max(period.start.getTime(), trialEnd.getTime()))
  const usage = round4((await billableUsageEur(userId, usageStart, period.end)) + (opts.extraUsageEur ?? 0))

  // Amount carried over from the previous month's bill (if it was below €5).
  const { data: previous } = await supabase
    .from('billing_documents')
    .select('status, net_eur')
    .eq('user_id', userId)
    .eq('kind', 'monthly')
    .lt('period_start', period.start.toISOString())
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle<{ status: string; net_eur: number | string }>()
  const carriedIn = previous?.status === 'carried_over' ? round4(Number(previous.net_eur) || 0) : 0

  // Monthly plan fee (none during the free month or before a card was saved).
  const fee = await planFeeFor(userId, period, { ignoreTrial: opts.ignoreExemptAndTrial })

  const owed = round4(usage + carriedIn + fee.feeEur)
  if (owed <= 0) return 'nothing'

  const balance = await getBalanceEur(userId)
  const prepaid = round4(Math.max(0, Math.min(balance, owed)))
  const net = round4(owed - prepaid)

  const account = await getBillingAccount(userId)
  const country = account?.billing_country ?? null
  const vat = vatBreakdown(net, country)
  const { data: authUser } = await supabase.auth.admin.getUserById(userId)

  const { data: doc, error: insertError } = await supabase
    .from('billing_documents')
    .insert({
      user_id: userId,
      kind: 'monthly',
      period_start: period.start.toISOString(),
      period_end: period.end.toISOString(),
      usage_eur: usage,
      plan: fee.plan,
      plan_fee_eur: fee.feeEur,
      carried_in_eur: carriedIn,
      prepaid_applied_eur: prepaid,
      net_eur: net,
      vat_rate: vat.vatRate,
      vat_eur: vat.vatEur,
      total_eur: vat.totalEur,
      vat_exempt: vat.vatExempt,
      country,
      customer_name: user.display_name ?? null,
      customer_email: authUser?.user?.email ?? null,
      status: 'draft',
    })
    .select('id')
    .single<{ id: number }>()
  if (insertError) {
    if (insertError.code === '23505') return 'exists'
    throw new Error(insertError.message)
  }

  if (prepaid > 0) {
    const { error: balError } = await supabase.from('billing_balance_entries').insert({
      user_id: userId,
      amount_eur: -prepaid,
      kind: 'usage',
      document_id: doc.id,
    })
    if (balError) throw new Error(balError.message)
  }

  // Fully paid from prepaid credit.
  if (net <= 0) {
    await markPaid(doc.id)
    return 'paid_from_credit'
  }

  // Below the minimum charge: carry over to next month.
  if (vat.totalEur < MIN_CHARGE_EUR) {
    await supabase.from('billing_documents').update({ status: 'carried_over' }).eq('id', doc.id)
    return 'carried_over'
  }

  // Charge the saved card.
  if (account?.mandate_status !== 'valid' || !account.mandate_id || !account.mollie_customer_id) {
    await markFailed(doc.id)
    return 'failed'
  }
  try {
    const payment = await createSavedCardPayment({
      customerId: account.mollie_customer_id,
      mandateId: account.mandate_id,
      amountEur: formatEur(vat.totalEur),
      description: `LiAIson – ${period.start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })}`,
      webhookUrl: opts.webhookUrl,
      metadata: { userId, purpose: 'monthly', documentId: String(doc.id) },
    })
    await supabase.from('billing_documents').update({ status: 'pending', mollie_payment_id: payment.id }).eq('id', doc.id)
    if (payment.status === 'paid' || ['failed', 'canceled', 'expired'].includes(payment.status)) {
      await handleMonthlyPayment(payment)
      return payment.status === 'paid' ? 'paid' : 'failed'
    }
    return 'charging'
  } catch (err) {
    console.error('MONTHLY_CHARGE_ERROR', userId, err)
    await markFailed(doc.id)
    return 'failed'
  }
}

async function markPaid(documentId: number): Promise<void> {
  const supabase = createServiceClient()
  const { data: updated } = await supabase
    .from('billing_documents')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', documentId)
    .in('status', ['draft', 'pending', 'failed'])
    .select('id')
  if (!updated || updated.length === 0) return // already handled
  const { data: receipt, error } = await supabase.rpc('next_receipt_number')
  if (error) throw new Error(error.message)
  await supabase.from('billing_documents').update({ receipt_number: receipt as string }).eq('id', documentId).is('receipt_number', null)
  await sendMonthlyBillEmail(documentId, 'paid').catch(err => console.error('MONTHLY_EMAIL_ERROR', err))
}

async function markFailed(documentId: number): Promise<void> {
  const supabase = createServiceClient()
  const { data: updated } = await supabase
    .from('billing_documents')
    .update({ status: 'failed' })
    .eq('id', documentId)
    .in('status', ['draft', 'pending'])
    .select('id')
  if (!updated || updated.length === 0) return
  await sendMonthlyBillEmail(documentId, 'failed').catch(err => console.error('MONTHLY_EMAIL_ERROR', err))
}

// Webhook handler for monthly charges (saved card or "Pay now" checkout).
// Only the payment currently attached to the bill counts.
export async function handleMonthlyPayment(payment: MolliePayment): Promise<void> {
  const documentId = Number(payment.metadata?.documentId)
  const userId = typeof payment.metadata?.userId === 'string' ? payment.metadata.userId : null
  if (!Number.isInteger(documentId) || !userId) return
  const supabase = createServiceClient()
  const { data: doc } = await supabase
    .from('billing_documents')
    .select('id, mollie_payment_id, status')
    .eq('id', documentId)
    .eq('user_id', userId)
    .eq('kind', 'monthly')
    .maybeSingle<{ id: number; mollie_payment_id: string | null; status: string }>()
  if (!doc) throw new Error(`Monthly bill not found yet for ${payment.id}`)
  if (doc.mollie_payment_id !== payment.id) return // an older attempt
  if (payment.status === 'paid') await markPaid(doc.id)
  else if (['failed', 'canceled', 'expired'].includes(payment.status)) await markFailed(doc.id)
}

// Unpaid bill that blocks sending messages (null if none).
export async function getUnpaidBill(userId: string): Promise<{ id: number; totalEur: number } | null> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('billing_documents')
    .select('id, total_eur')
    .eq('user_id', userId)
    .eq('kind', 'monthly')
    .eq('status', 'failed')
    .order('period_start', { ascending: true })
    .limit(1)
    .maybeSingle<{ id: number; total_eur: number | string }>()
  return data ? { id: data.id, totalEur: Number(data.total_eur) } : null
}

// "Pay now" for an unpaid bill: Mollie checkout, any payment method.
export async function startUnpaidBillCheckout(userId: string, input: { customerId: string; redirectUrl: string; webhookUrl: string }): Promise<string> {
  const bill = await getUnpaidBill(userId)
  if (!bill) throw new Error('No unpaid bill')
  const payment = await createOneOffPayment({
    customerId: input.customerId,
    amountEur: formatEur(round2(bill.totalEur)),
    description: 'LiAIson – unpaid usage bill',
    redirectUrl: input.redirectUrl,
    webhookUrl: input.webhookUrl,
    metadata: { userId, purpose: 'monthly', documentId: String(bill.id) },
  })
  const checkoutUrl = payment._links?.checkout?.href
  if (!checkoutUrl) throw new Error('Mollie returned no checkout link')
  const supabase = createServiceClient()
  // Attach this attempt to the bill; it stays 'failed' (blocking) until Mollie confirms.
  await supabase.from('billing_documents').update({ mollie_payment_id: payment.id }).eq('id', bill.id).eq('status', 'failed')
  return checkoutUrl
}
