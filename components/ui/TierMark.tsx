import { PLANS, isPlanId } from '@/lib/plans'

// A small mark next to a person's name showing their tier, as a butterfly's
// life (owner design 2026-10-10): Introvert = caterpillar, Ambivert = cocoon,
// Extrovert = butterfly in its cocoon, Social Butterfly = open wings.
export default function TierMark({ plan, className = '' }: { plan: string | null | undefined; className?: string }) {
  if (!isPlanId(plan)) return null
  const name = PLANS[plan].name
  const common = { width: 18, height: 18, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  return (
    <span className={`inline-flex items-center text-accent/80 align-[-2px] ${className}`} title={name} aria-label={name} role="img">
      {plan === 'introvert' && (
        <svg {...common} aria-hidden="true">
          <circle cx="3.2" cy="10" r="1.7" />
          <circle cx="6.4" cy="9.2" r="1.7" />
          <circle cx="9.6" cy="9.2" r="1.7" />
          <circle cx="12.6" cy="8" r="1.9" />
          <path d="M12.9 6.1 13.6 4.4M13.9 6.6l1.3-1.2" />
        </svg>
      )}
      {plan === 'ambivert' && (
        <svg {...common} aria-hidden="true">
          <path d="M8 1.2v2.2" />
          <path d="M8 3.4c2.3 0 3.4 2.4 3.4 5.4S10 14.6 8 14.6 4.6 11.8 4.6 8.8 5.7 3.4 8 3.4z" />
          <path d="M5.4 7.2c1.7.6 3.5.6 5.2 0M5.1 10c1.9.7 3.9.7 5.8 0" />
        </svg>
      )}
      {plan === 'extrovert' && (
        <svg {...common} aria-hidden="true">
          <path d="M8 1.2v2.2" />
          <path d="M8 3.4c2.3 0 3.4 2.4 3.4 5.4S10 14.6 8 14.6 4.6 11.8 4.6 8.8 5.7 3.4 8 3.4z" />
          <path d="M8 6v6.2" />
          <path d="M8 7.4c-1.3-.9-2.3-.4-2.3.8S7 10.2 8 9.6M8 7.4c1.3-.9 2.3-.4 2.3.8S9 10.2 8 9.6" />
        </svg>
      )}
      {plan === 'butterfly' && (
        <svg {...common} aria-hidden="true">
          <path d="M8 4.6v8" />
          <path d="M8 6.4C6.6 3.6 1.8 2.4 1.8 5.6c0 2.2 2.4 3.2 4.6 3.1C4 9.4 3.6 12.4 5.6 12.6c1.3.1 2.1-1.4 2.4-3" />
          <path d="M8 6.4c1.4-2.8 6.2-4 6.2-.8 0 2.2-2.4 3.2-4.6 3.1 2.4.7 2.8 3.7.8 3.9-1.3.1-2.1-1.4-2.4-3" />
          <path d="M7.2 3.4 8 4.6l.8-1.2" />
        </svg>
      )}
    </span>
  )
}
