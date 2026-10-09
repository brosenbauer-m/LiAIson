import { FEATURE_HELP, type Plan } from '@/lib/plans'

// A plan's features as a list; each line opens to explain the feature.
export default function PlanFeatures({ plan }: { plan: Plan }) {
  return (
    <ul className="space-y-1.5">
      {plan.features.map(f => {
        const help = FEATURE_HELP.find(h => h.key === f.help)
        return (
          <li key={f.text}>
            <details className="group">
              <summary className="cursor-pointer list-none flex items-start gap-2 text-sm text-text-secondary hover:text-text-primary">
                <span aria-hidden="true" className="mt-0.5 text-accent transition-transform group-open:rotate-90">›</span>
                <span className={f.highlight ? 'font-semibold text-text-primary' : undefined}>{f.text}</span>
              </summary>
              {help && <p className="mt-1.5 mb-2 ml-5 text-xs text-text-secondary leading-relaxed">{help.text}</p>}
            </details>
          </li>
        )
      })}
    </ul>
  )
}
