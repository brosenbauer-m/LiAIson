import { createServiceClient } from '@/lib/supabase/service'

// Receipts (paid billing documents with a receipt number) of one user. Server-only.

export type Receipt = {
  receiptNumber: string
  kind: 'topup' | 'monthly'
  periodStart: string | null
  periodEnd: string | null
  usageEur: number
  carriedInEur: number
  prepaidAppliedEur: number
  netEur: number
  vatRate: number
  vatEur: number
  totalEur: number
  vatExempt: boolean
  country: string | null
  customerName: string | null
  customerEmail: string | null
  paidAt: string
}

type Row = {
  receipt_number: string
  kind: 'topup' | 'monthly'
  period_start: string | null
  period_end: string | null
  usage_eur: number | string
  carried_in_eur: number | string
  prepaid_applied_eur: number | string
  net_eur: number | string
  vat_rate: number | string
  vat_eur: number | string
  total_eur: number | string
  vat_exempt: boolean
  country: string | null
  customer_name: string | null
  customer_email: string | null
  paid_at: string
}

const COLUMNS =
  'receipt_number, kind, period_start, period_end, usage_eur, carried_in_eur, prepaid_applied_eur, net_eur, vat_rate, vat_eur, total_eur, vat_exempt, country, customer_name, customer_email, paid_at'

function toReceipt(r: Row): Receipt {
  return {
    receiptNumber: r.receipt_number,
    kind: r.kind,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    usageEur: Number(r.usage_eur),
    carriedInEur: Number(r.carried_in_eur),
    prepaidAppliedEur: Number(r.prepaid_applied_eur),
    netEur: Number(r.net_eur),
    vatRate: Number(r.vat_rate),
    vatEur: Number(r.vat_eur),
    totalEur: Number(r.total_eur),
    vatExempt: r.vat_exempt,
    country: r.country,
    customerName: r.customer_name,
    customerEmail: r.customer_email,
    paidAt: r.paid_at,
  }
}

export async function listReceipts(userId: string): Promise<Receipt[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('billing_documents')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'paid')
    .not('receipt_number', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return ((data as Row[] | null) ?? []).map(toReceipt)
}

// Only returns the receipt if it belongs to this user.
export async function getReceipt(userId: string, receiptNumber: string): Promise<Receipt | null> {
  if (!/^LIA-\d{4}-\d{6}$/.test(receiptNumber)) return null
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('billing_documents')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('receipt_number', receiptNumber)
    .eq('status', 'paid')
    .maybeSingle<Row>()
  if (error) throw new Error(error.message)
  return data ? toReceipt(data) : null
}
