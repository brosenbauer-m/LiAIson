import { getMoney } from '@/lib/admin/stats'
import { formatEur } from '@/lib/plans'

// Per month: what was billed, what came in, what AI cost us.
export default async function AdminMoneyPage() {
  const months = await getMoney(12)
  const sum = (k: keyof (typeof months)[number]) => months.reduce((s, m) => s + (Number(m[k]) || 0), 0)
  const eur = (n: number) => formatEur(Math.round(n * 100) / 100)
  const monthName = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Billed to users', sum('billedUsageEur') + sum('billedFeesEur'), 'usage + plan fees on monthly bills'],
          ['Collected', sum('billsPaidEur') + sum('topUpsEur'), 'paid bills + top-ups'],
          ['AI cost to us', sum('aiCostEur'), 'Mistral prices, all features'],
          ['Event credit given', sum('couponCreditEur'), 'to invoice the organisations'],
        ].map(([label, value, hint]) => (
          <div key={String(label)} className="bg-card border border-border rounded-2xl p-5 shadow-soft">
            <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{label}</p>
            <p className="mt-2 text-3xl font-display text-text-primary">{eur(Number(value))}</p>
            <p className="mt-1 text-xs text-text-muted">{hint}</p>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-2xl shadow-soft overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-surface text-left text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3 text-right">Bills</th>
              <th className="px-4 py-3 text-right">Usage billed</th>
              <th className="px-4 py-3 text-right">Fees billed</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Open</th>
              <th className="px-4 py-3 text-right">Top-ups</th>
              <th className="px-4 py-3 text-right">Event credit</th>
              <th className="px-4 py-3 text-right">AI cost</th>
              <th className="px-4 py-3 text-right">Usage value</th>
            </tr>
          </thead>
          <tbody>
            {months.length === 0 && <tr><td colSpan={10} className="px-4 py-6 text-center text-text-muted">Nothing yet.</td></tr>}
            {months.map(m => (
              <tr key={m.month} className="border-t border-border tabular-nums">
                <td className="px-4 py-2.5 text-text-primary">{monthName(m.month)}</td>
                <td className="px-4 py-2.5 text-right">{m.billsIssued}</td>
                <td className="px-4 py-2.5 text-right">{eur(m.billedUsageEur)}</td>
                <td className="px-4 py-2.5 text-right">{eur(m.billedFeesEur)}</td>
                <td className="px-4 py-2.5 text-right">{eur(m.billsPaidEur)}</td>
                <td className="px-4 py-2.5 text-right">{eur(m.billsOpenEur)}</td>
                <td className="px-4 py-2.5 text-right">{eur(m.topUpsEur)}</td>
                <td className="px-4 py-2.5 text-right">{eur(m.couponCreditEur)}</td>
                <td className="px-4 py-2.5 text-right">{eur(m.aiCostEur)}</td>
                <td className="px-4 py-2.5 text-right">{eur(m.aiValueEur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-text-muted">Usage value = every paid feature at user prices (cost × 1.3), including free months and event periods — what the usage would have earned. Bills are made on the 1st for the month before.</p>
    </div>
  )
}
