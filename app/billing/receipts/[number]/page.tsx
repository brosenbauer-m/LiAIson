import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getReceipt } from '@/lib/billing/receipts'
import { EU_COUNTRIES } from '@/lib/billing/countries'
import { SELLER, SMALL_BUSINESS_VAT_NOTE, isTestMode } from '@/lib/billing/seller'
import PrintButton from '@/components/billing/PrintButton'

export const dynamic = 'force-dynamic'

function euros(n: number): string {
  return `€${n.toFixed(2)}`
}

function countryName(code: string | null): string {
  return EU_COUNTRIES.find(c => c.code === code)?.name ?? code ?? ''
}

export default async function ReceiptPage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirect=/billing/receipts/${encodeURIComponent(number)}`)

  const r = await getReceipt(user.id, number)
  if (!r) notFound()

  const date = new Date(r.paidAt).toLocaleDateString('en-GB', { timeZone: 'Europe/Vienna' })
  const period = r.periodStart
    ? new Date(r.periodStart).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })
    : null
  const sellerComplete = !!(SELLER.legalName && SELLER.address)

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6 print:py-0">
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link href="/billing/receipts" className="text-sm text-text-secondary hover:text-accent">← All receipts</Link>
        <PrintButton />
      </div>

      <div className="bg-card border border-border rounded-2xl p-8 space-y-8 shadow-soft print:shadow-none print:border-0">
        {isTestMode() && (
          <p className="text-xs font-medium text-error">TEST MODE — not a real payment</p>
        )}

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1 text-sm">
            <p className="text-2xl font-bold text-text-primary">Receipt</p>
            <p className="text-text-secondary">No. {r.receiptNumber}</p>
            <p className="text-text-secondary">Date: {date}</p>
          </div>
          <div className="space-y-0.5 text-sm text-right">
            <p className="font-semibold text-text-primary">{SELLER.tradeName}</p>
            {sellerComplete ? (
              <>
                <p className="text-text-secondary">{SELLER.legalName}</p>
                <p className="text-text-secondary">{SELLER.address}</p>
                {SELLER.vatId && <p className="text-text-secondary">VAT ID: {SELLER.vatId}</p>}
              </>
            ) : (
              <p className="text-text-secondary italic">Business details will be added</p>
            )}
            <p className="text-text-secondary">{SELLER.email}</p>
          </div>
        </div>

        <div className="space-y-0.5 text-sm">
          <p className="text-xs uppercase tracking-wide text-text-secondary">Billed to</p>
          {r.customerName && <p className="text-text-primary">{r.customerName}</p>}
          {r.customerEmail && <p className="text-text-secondary">{r.customerEmail}</p>}
          {r.country && <p className="text-text-secondary">{countryName(r.country)}</p>}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {r.kind === 'topup' ? (
              <tr className="border-b border-border">
                <td className="py-2 text-text-primary">LiAIson prepaid credit</td>
                <td className="py-2 text-right tabular-nums text-text-primary">{euros(r.netEur)}</td>
              </tr>
            ) : (
              <>
                <tr className="border-b border-border">
                  <td className="py-2 text-text-primary">AI usage{period ? ` — ${period}` : ''}</td>
                  <td className="py-2 text-right tabular-nums text-text-primary">{euros(r.usageEur)}</td>
                </tr>
                {r.planFeeEur > 0 && (
                  <tr className="border-b border-border">
                    <td className="py-2 text-text-primary">
                      {r.plan ? `${r.plan.charAt(0).toUpperCase()}${r.plan.slice(1)} plan` : 'Plan'}{period ? ` — ${period}` : ''}
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-primary">{euros(r.planFeeEur)}</td>
                  </tr>
                )}
                {r.carriedInEur > 0 && (
                  <tr className="border-b border-border">
                    <td className="py-2 text-text-primary">Carried over from earlier months</td>
                    <td className="py-2 text-right tabular-nums text-text-primary">{euros(r.carriedInEur)}</td>
                  </tr>
                )}
                {r.prepaidAppliedEur > 0 && (
                  <tr className="border-b border-border">
                    <td className="py-2 text-text-primary">Paid from prepaid credit</td>
                    <td className="py-2 text-right tabular-nums text-text-primary">−{euros(r.prepaidAppliedEur)}</td>
                  </tr>
                )}
              </>
            )}
            <tr>
              <td className="pt-3 text-text-secondary">Net</td>
              <td className="pt-3 text-right tabular-nums text-text-secondary">{euros(r.netEur)}</td>
            </tr>
            <tr>
              <td className="py-1 text-text-secondary">{r.vatExempt ? 'VAT' : `VAT ${r.vatRate}% (${countryName(r.country)})`}</td>
              <td className="py-1 text-right tabular-nums text-text-secondary">{euros(r.vatEur)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="pt-3 font-semibold text-text-primary">Total paid</td>
              <td className="pt-3 text-right tabular-nums font-semibold text-text-primary">{euros(r.totalEur)}</td>
            </tr>
          </tbody>
        </table>

        <div className="space-y-1 text-xs text-text-secondary">
          {r.vatExempt && <p>{SMALL_BUSINESS_VAT_NOTE}</p>}
          <p>Paid by card via Mollie (Netherlands). {SELLER.website}</p>
        </div>
      </div>
    </div>
  )
}
