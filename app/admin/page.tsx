import { getOverview } from '@/lib/admin/stats'
import { PLANS, PLAN_IDS, formatEur } from '@/lib/plans'

const FEATURE_NAMES: Record<string, string> = {
  chat: 'Messages', topic: 'Interest maps', insight: 'Visitor insights', echo: 'Echoes', search: 'AI searches', index: 'Index updates',
  similarity: 'Similarity checks', proofread: 'Optimize Text', similarity_topic: 'Elaborate', voice_transcribe: 'Voice: spoken messages', voice_speech: 'Voice: read aloud',
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-soft">
      <p className="text-xs uppercase tracking-[0.14em] text-text-muted">{label}</p>
      <p className="mt-2 text-3xl font-display text-text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
    </div>
  )
}

export default async function AdminOverviewPage() {
  const o = await getOverview()
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-2xl text-text-primary">Accounts</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Accounts" value={o.accounts.total} hint={`${o.accounts.confirmed} confirmed their email`} />
          <Stat label="New" value={o.accounts.newWeek} hint={`last 7 days · ${o.accounts.newMonth} in 30 days`} />
          <Stat label="Active" value={o.activeUsers7} hint={`sent a message in 7 days · ${o.activeUsers30} in 30 days`} />
          <Stat label="With a card" value={o.accounts.withCard} hint={`${o.accounts.inFreeMonth} in their free month · ${o.accounts.exempt} never billed`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PLAN_IDS.map(id => <Stat key={id} label={PLANS[id].name} value={o.plans[id]} hint={PLANS[id].feeEur ? `${formatEur(PLANS[id].feeEur)}/month` : 'free'} />)}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-text-primary">Last 30 Days</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="AI cost to us" value={formatEur(o.aiCostEur)} hint="all features, Mistral prices" />
          <Stat label="Usage at user prices" value={formatEur(o.aiValueEur)} hint="paid features × 1.3, free months included" />
          <Stat label="Event codes" value={`${o.coupons.seatsUsed} / ${o.coupons.seats}`} hint={`seats used · ${o.coupons.campaigns} campaigns running`} />
          <Stat label="Sponsored now" value={o.accounts.sponsored} hint="accounts in an event period" />
        </div>
        <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wide text-text-muted">
              <tr><th className="px-5 py-3">Feature</th><th className="px-5 py-3 text-right">Uses</th><th className="px-5 py-3 text-right">People</th></tr>
            </thead>
            <tbody>
              {o.activity.length === 0 && <tr><td colSpan={3} className="px-5 py-6 text-center text-text-muted">Nothing yet.</td></tr>}
              {o.activity.map(a => (
                <tr key={a.feature} className="border-t border-border">
                  <td className="px-5 py-2.5 text-text-primary">{FEATURE_NAMES[a.feature] ?? a.feature}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{a.calls.toLocaleString('en-GB')}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{a.users.toLocaleString('en-GB')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
