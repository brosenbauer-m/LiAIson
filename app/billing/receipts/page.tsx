import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listReceipts } from '@/lib/billing/receipts'
import { isTestMode } from '@/lib/billing/seller'

export const dynamic = 'force-dynamic'

function euros(n: number): string {
  return `€${n.toFixed(2)}`
}

function describe(kind: 'topup' | 'monthly', periodStart: string | null): string {
  if (kind === 'topup') return 'Prepaid credit'
  if (!periodStart) return 'Monthly usage'
  const d = new Date(periodStart)
  return `Usage ${d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })}`
}

export default async function ReceiptsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/billing/receipts')

  const receipts = await listReceipts(user.id)

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      <div className="space-y-2">
        <Link href="/settings" className="text-sm text-text-secondary hover:text-accent">← Settings</Link>
        <h1 className="text-3xl font-display font-medium tracking-tight text-text-primary">Receipts</h1>
        <p className="text-sm text-text-secondary">All payments for your LiAIson account. Open a receipt to print it or save it as a PDF.</p>
        {isTestMode() && (
          <p className="text-xs text-text-secondary bg-surface border border-border rounded-lg px-3 py-2">Test mode — these are test payments, no real money was charged.</p>
        )}
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-soft">
        {receipts.length === 0 ? (
          <p className="p-8 text-sm text-text-secondary">No receipts yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {receipts.map(r => (
              <li key={r.receiptNumber}>
                <Link
                  href={`/billing/receipts/${r.receiptNumber}`}
                  className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-surface/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{describe(r.kind, r.periodStart)}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(r.paidAt).toLocaleDateString('en-GB', { timeZone: 'Europe/Vienna' })} · {r.receiptNumber}
                    </p>
                  </div>
                  <span className="text-sm text-text-primary tabular-nums">{euros(r.totalEur)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
