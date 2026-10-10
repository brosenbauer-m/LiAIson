'use client'

import { BUTTERFLY_SLIDERS, SLIDER_KEYS, type PlanOptions } from '@/lib/plans'

// Social Butterfly sliders: choose how much you need; the price on the card
// follows (lib/plans.ts butterflyFeeEur).
export default function PlanSliders({ value, onChange }: { value: PlanOptions; onChange: (next: PlanOptions) => void }) {
  return (
    <div className="space-y-4">
      {SLIDER_KEYS.map(key => {
        const s = BUTTERFLY_SLIDERS[key]
        const id = `slider-${key}`
        return (
          <div key={key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <label htmlFor={id} className="text-text-secondary">{s.label}</label>
              <span className="font-semibold text-text-primary tabular-nums">{value[key].toLocaleString('en-GB')}</span>
            </div>
            <input
              id={id}
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={value[key]}
              onChange={e => onChange({ ...value, [key]: Number(e.target.value) })}
              className="w-full accent-[#5C3B28]"
            />
          </div>
        )
      })}
    </div>
  )
}
