import Link from 'next/link'

// Shown where an Echo feature is not part of the person's plan.
export default function EchoesLocked({ period, echoes }: { period: 'week' | 'month'; echoes: 'none' | 'monthly' | 'weekly_monthly' }) {
  const text = echoes === 'none'
    ? 'Echoes show you what people ask your LiAIson, without showing who asked. They are part of the Ambivert and Extrovert plans.'
    : period === 'week'
      ? 'Weekly Echoes are part of the Extrovert plan. With your plan, you get an Echo every month.'
      : 'Echoes are not part of your plan.'
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-4 space-y-2">
      <p className="text-sm text-text-secondary">{text}</p>
      <Link href="/settings#subscription" className="inline-block text-sm font-medium text-accent hover:underline">See tiers →</Link>
    </div>
  )
}
