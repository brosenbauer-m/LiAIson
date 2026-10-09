import { createServiceClient } from '@/lib/supabase/service'
import type { MolliePayment } from '@/lib/billing/mollie'

// Prepaid top-ups (server-only). A top-up adds credit to the user's prepaid
// balance; the balance is used first when the monthly bill is made.
// Flow: createTopUp → Mollie checkout → webhook → markTopUpPaid (once only).

export const TOPUP_AMOUNTS_EUR = [5, 10, 20] as const

export function isTopUpAmount(n: unknown): n is (typeof TOPUP_AMOUNTS_EUR)[number] {
  return typeof n === 'number' && (TOPUP_AMOUNTS_EUR as readonly number[]).includes(n)
}

export async function getBalanceEur(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('billing_balance_entries')
    .select('amount_eur')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  const sum = ((data as { amount_eur: number | string }[] | null) ?? [])
    .reduce((acc, row) => acc + (Number(row.amount_eur) || 0), 0)
  return Math.round(sum * 10000) / 10000
}

export type ReceiptSummary = {
  receiptNumber: string
  kind: 'topup' | 'monthly'
  totalEur: number
  paidAt: string
}

export async function getRecentReceipts(userId: string, limit = 5): Promise<ReceiptSummary[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('billing_documents')
    .select('receipt_number, kind, total_eur, paid_at')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .not('receipt_number', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data as { receipt_number: string; kind: 'topup' | 'monthly'; total_eur: number | string; paid_at: string }[] | null) ?? [])
    .map(r => ({ receiptNumber: r.receipt_number, kind: r.kind, totalEur: Number(r.total_eur), paidAt: r.paid_at }))
}

// True if the user started a top-up in the last 15 seconds (double-click guard).
export async function hasRecentPendingTopUp(userId: string): Promise<boolean> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - 15_000).toISOString()
  const { count } = await supabase
    .from('billing_documents')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', 'topup')
    .eq('status', 'pending')
    .gte('created_at', since)
  return (count ?? 0) > 0
}

export async function recordPendingTopUp(input: {
  userId: string
  paymentId: string
  creditEur: number
  vatRate: number
  vatEur: number
  totalEur: number
  vatExempt: boolean
  country: string
  customerName: string | null
  customerEmail: string | null
}) {
  const supabase = createServiceClient()
  const { error } = await supabase.from('billing_documents').insert({
    user_id: input.userId,
    kind: 'topup',
    net_eur: input.creditEur,
    vat_rate: input.vatRate,
    vat_eur: input.vatEur,
    total_eur: input.totalEur,
    vat_exempt: input.vatExempt,
    country: input.country,
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    status: 'pending',
    mollie_payment_id: input.paymentId,
  })
  if (error) throw new Error(error.message)
}

// Called from the Mollie webhook. Idempotent: the credit is added only by the
// call that moves the document from 'pending' to 'paid'.
export async function handleTopUpPayment(payment: MolliePayment): Promise<void> {
  const supabase = createServiceClient()
  const userId = typeof payment.metadata?.userId === 'string' ? payment.metadata.userId : null
  if (!userId) return

  if (payment.status === 'paid') {
    // Only the call that moves the document from 'pending' to 'paid' adds the credit.
    const { data: updated, error } = await supabase
      .from('billing_documents')
      .update({ status: 'paid', paid_at: new Date().toISOString() })
      .eq('mollie_payment_id', payment.id)
      .eq('user_id', userId)
      .eq('kind', 'topup')
      .eq('status', 'pending')
      .select('id')
    if (error) throw new Error(error.message)
    const justPaid = ((updated as { id: number }[] | null) ?? []).length > 0

    const { data: doc, error: docError } = await supabase
      .from('billing_documents')
      .select('id, net_eur, status, receipt_number, paid_at')
      .eq('mollie_payment_id', payment.id)
      .eq('user_id', userId)
      .eq('kind', 'topup')
      .maybeSingle<{ id: number; net_eur: number | string; status: string; receipt_number: string | null; paid_at: string | null }>()
    if (docError) throw new Error(docError.message)
    if (!doc || doc.status !== 'paid') return

    // Repair path for a retried webhook whose earlier attempt failed half-way
    // (paid, but no credit yet). Waits 60 s so it never races the first attempt.
    const settled = !!doc.paid_at && Date.now() - new Date(doc.paid_at).getTime() > 60_000
    if (justPaid || settled) {
      const { count } = await supabase
        .from('billing_balance_entries')
        .select('id', { count: 'exact', head: true })
        .eq('document_id', doc.id)
        .eq('kind', 'topup')
      if ((count ?? 0) === 0) {
        const { error: balError } = await supabase.from('billing_balance_entries').insert({
          user_id: userId,
          amount_eur: Number(doc.net_eur),
          kind: 'topup',
          document_id: doc.id,
        })
        if (balError) throw new Error(balError.message)
      }
    }

    if (!doc.receipt_number && (justPaid || settled)) {
      const { data: receipt, error: rpcError } = await supabase.rpc('next_receipt_number')
      if (rpcError) throw new Error(rpcError.message)
      const { error: numError } = await supabase
        .from('billing_documents')
        .update({ receipt_number: receipt as string })
        .eq('id', doc.id)
        .is('receipt_number', null)
      if (numError) throw new Error(numError.message)
    }
    return
  }

  if (['failed', 'canceled', 'expired'].includes(payment.status)) {
    await supabase
      .from('billing_documents')
      .update({ status: payment.status === 'failed' ? 'failed' : 'canceled' })
      .eq('mollie_payment_id', payment.id)
      .eq('user_id', userId)
      .eq('status', 'pending')
  }
}
