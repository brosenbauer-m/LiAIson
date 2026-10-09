'use client'

import { useMemo, useState } from 'react'
import type { SimilarityInterest } from '@/lib/similarity/types'

// Bubble map of interests (owner decision 2026-10-09): a Venn diagram in
// bubble form. Each interest is a bubble (bigger = stronger). Bubbles that
// everyone shares sit in the middle; bubbles of one person drift to that
// person's side. Works for any number of people (Social Butterfly later):
// each person gets a point on a ring and a bubble sits between the people
// who have it. Tapping a shared bubble shows why it matches.

export type MapPerson = { key: string; name: string }

const W = 360
const H = 260
const FONT = 11
const CHAR_W = 6.3
const PAD = 3

type Bubble = {
  interest: SimilarityInterest
  lines: string[]
  r: number
  x: number
  y: number
  tx: number
  ty: number
  style: 'all' | 'some' | number
}

function splitLabel(label: string): string[] {
  if (label.length <= 12 || !label.includes(' ')) return [label]
  const words = label.split(' ')
  let best = [label]
  let bestWidth = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const width = Math.max(a.length, b.length)
    if (width < bestWidth) {
      best = [a, b]
      bestWidth = width
    }
  }
  return best
}

function anchors(count: number): { x: number; y: number }[] {
  if (count === 1) return [{ x: W / 2, y: H / 2 }]
  if (count === 2) return [{ x: W * 0.2, y: H / 2 }, { x: W * 0.8, y: H / 2 }]
  const radius = Math.min(W, H) * 0.36
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.PI + (2 * Math.PI * i) / count
    return { x: W / 2 + radius * Math.cos(angle), y: H / 2 + radius * Math.sin(angle) }
  })
}

// Deterministic layout: start near the target point, then pull towards it
// and push overlapping bubbles apart.
function layout(people: MapPerson[], interests: SimilarityInterest[]): Bubble[] {
  const points = anchors(people.length)
  const index = new Map(people.map((p, i) => [p.key, i]))
  const bubbles: Bubble[] = interests.map((interest, i) => {
    const members = interest.people.map(k => index.get(k)).filter((n): n is number => n !== undefined)
    const tx = members.length ? members.reduce((s, m) => s + points[m].x, 0) / members.length : W / 2
    const ty = members.length ? members.reduce((s, m) => s + points[m].y, 0) / members.length : H / 2
    const lines = splitLabel(interest.label)
    const longest = Math.max(...lines.map(l => l.length))
    const base = interest.strength === 3 ? 30 : interest.strength === 2 ? 25 : 20
    const r = Math.min(48, Math.max(base, (longest * CHAR_W) / 2 + 7, lines.length > 1 ? 24 : 0))
    const angle = i * 2.399963
    const style: Bubble['style'] = members.length >= people.length && people.length > 1 ? 'all' : members.length > 1 ? 'some' : members[0] ?? 0
    return { interest, lines, r, x: tx + Math.cos(angle) * 8, y: ty + Math.sin(angle) * 8, tx, ty, style }
  })
  for (let step = 0; step < 300; step++) {
    for (const b of bubbles) {
      b.x += (b.tx - b.x) * 0.04
      b.y += (b.ty - b.y) * 0.04
    }
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i]
        const b = bubbles[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const overlap = a.r + b.r + PAD - dist
        if (overlap > 0) {
          const ux = dx / dist
          const uy = dy / dist
          a.x -= (ux * overlap) / 2
          a.y -= (uy * overlap) / 2
          b.x += (ux * overlap) / 2
          b.y += (uy * overlap) / 2
        }
      }
    }
    for (const b of bubbles) {
      b.x = Math.min(W - b.r - 1, Math.max(b.r + 1, b.x))
      b.y = Math.min(H - b.r - 1, Math.max(b.r + 1, b.y))
    }
  }
  return bubbles
}

// Monochrome, like the rest of the app. One-person bubbles: first person
// light grey, second outlined, others dashed.
function bubbleStyle(style: Bubble['style']): { fill: string; stroke: string; dash?: string; text: string } {
  if (style === 'all') return { fill: '#111111', stroke: '#111111', text: '#FFFFFF' }
  if (style === 'some') return { fill: '#555555', stroke: '#555555', text: '#FFFFFF' }
  if (style === 0) return { fill: '#F2F2F2', stroke: '#E5E5E5', text: '#111111' }
  if (style === 1) return { fill: '#FFFFFF', stroke: '#111111', text: '#111111' }
  return { fill: '#FFFFFF', stroke: '#555555', dash: '4 3', text: '#111111' }
}

export default function SimilarityMap({ people, interests }: { people: MapPerson[]; interests: SimilarityInterest[] }) {
  const bubbles = useMemo(() => layout(people, interests), [people, interests])
  const [selected, setSelected] = useState<string | null>(null)
  const shared = interests.filter(i => i.people.length > 1)
  const chosen = shared.find(i => i.label === selected)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Map of your interests">
        {people.length === 2 && (
          <>
            <text x={6} y={14} fontSize={FONT} fill="#999999">{people[0].name}</text>
            <text x={W - 6} y={14} fontSize={FONT} fill="#999999" textAnchor="end">{people[1].name}</text>
          </>
        )}
        {bubbles.map(b => {
          const c = bubbleStyle(b.style)
          const isShared = b.interest.people.length > 1
          const active = selected === b.interest.label
          return (
            <g
              key={b.interest.label}
              transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)})`}
              className={isShared ? 'cursor-pointer' : undefined}
              onClick={isShared ? () => setSelected(active ? null : b.interest.label) : undefined}
              onKeyDown={isShared ? e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setSelected(active ? null : b.interest.label)
                }
              } : undefined}
              role={isShared ? 'button' : undefined}
              tabIndex={isShared ? 0 : undefined}
              aria-label={isShared ? `${b.interest.label}: show why it matches` : undefined}
            >
              <circle
                r={b.r}
                fill={c.fill}
                stroke={active ? '#999999' : c.stroke}
                strokeWidth={active ? 3 : 1.5}
                strokeDasharray={c.dash}
              />
              <text fontSize={FONT} fill={c.text} textAnchor="middle" fontWeight={isShared ? 600 : 400}>
                {b.lines.map((line, i) => (
                  <tspan key={i} x={0} y={(i - (b.lines.length - 1) / 2) * (FONT + 1) + FONT * 0.35}>{line}</tspan>
                ))}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-accent" />{people.length === 2 ? 'Both of you' : 'Everyone'}</span>
        {people.map((p, i) => {
          const c = bubbleStyle(i)
          return (
            <span key={p.key} className="flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ background: c.fill, border: `1.5px ${c.dash ? 'dashed' : 'solid'} ${c.stroke}` }}
              />
              Only {p.name === 'You' ? 'you' : p.name}
            </span>
          )
        })}
      </div>

      {shared.length > 0 && (
        <p className="mt-3 text-sm text-text-secondary min-h-[1.25rem]" aria-live="polite">
          {chosen ? (
            <><span className="font-medium text-text-primary">{chosen.label}:</span> {chosen.reason || 'You both share this.'}</>
          ) : (
            'Tap a dark bubble to see why it matches.'
          )}
        </p>
      )}

      <ul className="sr-only">
        {interests.map(i => (
          <li key={i.label}>
            {i.label}: {i.people.length > 1 ? `shared${i.reason ? `. ${i.reason}` : ''}` : `only ${people.find(p => p.key === i.people[0])?.name ?? ''}`}
          </li>
        ))}
      </ul>
    </div>
  )
}
