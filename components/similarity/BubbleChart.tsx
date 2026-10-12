'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Avatar from '@/components/ui/Avatar'
import type { SimilarityInterest } from '@/lib/similarity/types'

// Similarities as floating bubbles (owner design 2026-10-12, same feel as the
// Circles board: soft bubbles that drift gently on their own).
// - Two people (a profile): you on the left, them on the right; shared
//   bubbles (dark) in the middle, yours (beige) and theirs (white) on each side.
// - A group (Similarities Chart): every person is a picture on a ring. Shared
//   by everyone = dark, in the middle. Shared by some = brown, between those
//   people, with lines to each of them. Only one person = light, next to them
//   with a faint line. Tapping a person or a bubble highlights its links.

export type ChartPerson = { key: string; name: string; avatarUrl?: string | null; you?: boolean }

type Kind = 'all' | 'some' | 'one'
type Bubble = {
  interest: SimilarityInterest
  lines: string[]
  r: number
  x: number
  y: number
  tx: number
  ty: number
  kind: Kind
  owner?: string
}
type Node = { key: string; x: number; y: number }

const FONT = 12
const CHAR_W = 6.7
const PAD = 5
const NODE_R = 30

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

// Gentle drift, different for every bubble (as on the Circles board).
function drift(id: string): React.CSSProperties {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { animationDuration: `${6.5 + (h % 30) / 10}s`, animationDelay: `-${(h % 70) / 10}s` }
}

function personNodes(people: ChartPerson[], W: number, H: number, pair: boolean): Node[] {
  if (pair) return people.map((p, i) => ({ key: p.key, x: i === 0 ? W * 0.14 : W * 0.86, y: H / 2 }))
  const rx = W / 2 - NODE_R - 24
  const ry = H / 2 - NODE_R - 30
  return people.map((p, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / people.length
    return { key: p.key, x: W / 2 + rx * Math.cos(a), y: H / 2 + ry * Math.sin(a) }
  })
}

// Deterministic layout: each bubble is pulled towards the people who have it
// and pushed away from other bubbles and from the pictures.
function layout(people: ChartPerson[], interests: SimilarityInterest[], W: number, H: number, pair: boolean): { bubbles: Bubble[]; nodes: Node[] } {
  const nodes = personNodes(people, W, H, pair)
  const at = new Map(nodes.map(n => [n.key, n]))
  const small = W < 520
  const scale = (small ? 0.82 : 1) * (interests.length > 14 ? 0.88 : 1)
  const cx = W / 2
  const cy = H / 2
  const bubbles: Bubble[] = interests.map((interest, i) => {
    const members = interest.people.filter(k => at.has(k))
    const kind: Kind = members.length >= people.length && people.length > 1 ? 'all' : members.length > 1 ? 'some' : 'one'
    let tx = cx
    let ty = cy
    if (members.length) {
      const mx = members.reduce((s, k) => s + at.get(k)!.x, 0) / members.length
      const my = members.reduce((s, k) => s + at.get(k)!.y, 0) / members.length
      // One person: between them and the middle; some: their middle, drawn in a little.
      const t = kind === 'one' ? (pair ? 0.82 : 0.6) : kind === 'some' ? 0.78 : 0
      tx = cx + (mx - cx) * t
      ty = cy + (my - cy) * t
    }
    const lines = splitLabel(interest.label)
    const longest = Math.max(...lines.map(l => l.length))
    const base = interest.strength === 3 ? 38 : interest.strength === 2 ? 32 : 27
    const r = Math.min(58, Math.max(base * scale, (longest * CHAR_W * (small ? 0.92 : 1)) / 2 + 9, lines.length > 1 ? 30 * scale : 0))
    const angle = i * 2.399963
    return { interest, lines, r, x: tx + Math.cos(angle) * 10, y: ty + Math.sin(angle) * 10, tx, ty, kind, owner: kind === 'one' ? members[0] : undefined }
  })
  const obstacles = pair ? [] : nodes.map(n => ({ x: n.x, y: n.y, r: NODE_R + 22 }))
  for (let step = 0; step < 360; step++) {
    for (const b of bubbles) {
      b.x += (b.tx - b.x) * 0.05
      b.y += (b.ty - b.y) * 0.05
    }
    for (let i = 0; i < bubbles.length; i++) {
      const a = bubbles[i]
      for (let j = i + 1; j < bubbles.length; j++) {
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
      for (const o of obstacles) {
        const dx = a.x - o.x
        const dy = a.y - o.y
        const dist = Math.hypot(dx, dy) || 0.01
        const overlap = a.r + o.r - dist
        if (overlap > 0) {
          a.x += (dx / dist) * overlap
          a.y += (dy / dist) * overlap
        }
      }
    }
    for (const b of bubbles) {
      const top = pair ? 26 : 8
      b.x = Math.min(W - b.r - 4, Math.max(b.r + 4, b.x))
      b.y = Math.min(H - b.r - 8, Math.max(b.r + top, b.y))
    }
  }
  return { bubbles, nodes }
}

function firstName(name: string): string {
  return name.split(' ')[0] || name
}

// "you", "you and Anna", "you, Anna and Ben"
function namesOf(keys: string[], people: ChartPerson[]): string {
  const names = keys
    .map(k => people.find(p => p.key === k))
    .filter((p): p is ChartPerson => !!p)
    .sort((a, b) => Number(!!b.you) - Number(!!a.you))
    .map(p => (p.you ? 'you' : firstName(p.name)))
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

const STYLE: Record<Kind | 'mine', string> = {
  all: 'bg-accent text-white border-accent shadow-[0_6px_16px_rgba(92,59,40,0.28)]',
  some: 'bg-[#8C6A52] text-white border-[#8C6A52] shadow-[0_5px_14px_rgba(92,59,40,0.22)]',
  one: 'bg-card text-text-primary border-accent/35 shadow-[0_2px_8px_rgba(43,30,22,0.08)]',
  mine: 'bg-accent-subtle text-text-primary border-accent/15 shadow-[0_2px_8px_rgba(43,30,22,0.08)]',
}

export default function BubbleChart({ people, interests, height }: { people: ChartPerson[]; interests: SimilarityInterest[]; height?: number }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const reduceMotion = useReducedMotion()
  const pair = people.length === 2
  const [selected, setSelected] = useState<string | null>(null)
  const [focusPerson, setFocusPerson] = useState<string | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const W = width
  const H = height ?? (pair ? Math.max(260, Math.min(340, W * 0.75)) : W < 640 ? Math.round(W * 1.35) : Math.round(Math.min(680, Math.max(480, W * 0.58))))
  const { bubbles, nodes } = useMemo(
    () => (W > 0 ? layout(people, interests, W, H, pair) : { bubbles: [], nodes: [] }),
    [people, interests, W, H, pair]
  )
  const nodeAt = new Map(nodes.map(n => [n.key, n]))
  const chosen = interests.find(i => i.label === selected)
  const other = people.find(p => !p.you) ?? people[1]

  // What is highlighted: the chosen bubble, or everything of the chosen person.
  const lit = (b: Bubble) =>
    chosen ? b.interest.label === chosen.label : focusPerson ? b.interest.people.includes(focusPerson) : true

  return (
    <div>
      <div ref={wrapRef} className="relative w-full select-none" style={{ height: W ? H : pair ? 280 : 480 }}>
        {W > 0 && (
          <>
            {/* Lines from bubbles to the people who have them (groups). They drift with their bubble. */}
            {!pair && (
              <svg className="absolute inset-0 pointer-events-none overflow-visible" width={W} height={H} aria-hidden="true">
                {bubbles.map(b => {
                  if (b.kind === 'all') return null
                  const on = lit(b)
                  const highlighted = on && (!!chosen || !!focusPerson)
                  return (
                    <g key={b.interest.label} className={reduceMotion ? undefined : 'animate-bob'} style={drift(b.interest.label)}>
                      {b.interest.people.map(k => {
                        const n = nodeAt.get(k)
                        if (!n) return null
                        // A soft curve, bent a little towards the middle.
                        const mx = (b.x + n.x) / 2
                        const my = (b.y + n.y) / 2
                        const qx = mx + (W / 2 - mx) * 0.18
                        const qy = my + (H / 2 - my) * 0.18
                        return (
                          <path
                            key={k}
                            d={`M ${b.x} ${b.y} Q ${qx} ${qy} ${n.x} ${n.y}`}
                            fill="none"
                            strokeLinecap="round"
                            stroke="#5C3B28"
                            strokeWidth={highlighted ? 1.6 : 1}
                            strokeOpacity={highlighted ? 0.55 : on ? (b.kind === 'one' ? 0.12 : 0.22) : 0.05}
                            strokeDasharray={b.kind === 'one' ? '3 4' : undefined}
                            className="transition-[stroke-opacity] duration-300"
                          />
                        )
                      })}
                    </g>
                  )
                })}
              </svg>
            )}

            {/* Names (two people) */}
            {pair && (
              <>
                <span className="absolute left-0 top-0 text-xs font-medium text-text-secondary">{people[0].you ? 'You' : firstName(people[0].name)}</span>
                <span className="absolute right-0 top-0 text-xs font-medium text-text-secondary">{people[1].you ? 'You' : firstName(people[1].name)}</span>
              </>
            )}

            {/* Bubbles */}
            {bubbles.map((b, i) => {
              const isShared = b.interest.people.length > 1
              const owner = b.owner ? people.find(p => p.key === b.owner) : undefined
              const tone = b.kind === 'one' && owner?.you ? STYLE.mine : STYLE[b.kind]
              const on = lit(b)
              const active = selected === b.interest.label
              const d = b.r * 2
              return (
                <motion.div
                  key={b.interest.label}
                  className="absolute"
                  style={{ left: b.x - b.r, top: b.y - b.r, width: d, height: d, zIndex: active ? 5 : 1 }}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: on ? 1 : 0.28, scale: active ? 1.08 : 1 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18, delay: reduceMotion ? 0 : Math.min(i * 0.035, 0.6) }}
                >
                  <span className={`absolute inset-0 ${reduceMotion ? '' : 'animate-bob'}`} style={drift(b.interest.label)}>
                    <button
                      type="button"
                      onClick={() => { setFocusPerson(null); setSelected(active ? null : b.interest.label) }}
                      aria-pressed={active}
                      aria-label={`${b.interest.label}: ${isShared ? `shared by ${namesOf(b.interest.people, people)}` : `only ${namesOf(b.interest.people, people)}`}`}
                      className={`absolute inset-0 rounded-full border flex flex-col items-center justify-center text-center leading-tight px-1 transition-[box-shadow,transform] hover:scale-[1.04] ${tone} ${active ? 'ring-4 ring-accent/20' : ''}`}
                      style={{ fontSize: FONT * (W < 520 ? 0.95 : 1), fontWeight: isShared ? 600 : 500 }}
                    >
                      {b.lines.map((line, k) => <span key={k} className="block max-w-full truncate">{line}</span>)}
                    </button>
                  </span>
                </motion.div>
              )
            })}

            {/* People (groups) */}
            {!pair && nodes.map(n => {
              const p = people.find(x => x.key === n.key)!
              const focused = focusPerson === n.key
              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => { setSelected(null); setFocusPerson(focused ? null : n.key) }}
                  aria-pressed={focused}
                  className="absolute z-10 flex flex-col items-center gap-1 w-24 -ml-12"
                  style={{ left: n.x, top: n.y - NODE_R }}
                >
                  <span className={`rounded-full p-0.5 transition-shadow ${focused ? 'bg-accent shadow-card' : p.you ? 'bg-accent-subtle' : 'bg-card shadow-soft'}`}>
                    <Avatar url={p.avatarUrl ?? null} name={p.name} size="md" />
                  </span>
                  <span className={`max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium ${focused ? 'bg-accent text-white' : 'bg-background/80 text-text-primary'}`}>
                    {p.you ? 'You' : firstName(p.name)}
                  </span>
                </button>
              )
            })}
          </>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-text-secondary">
        {pair ? (
          <>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-accent" />Shared</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-accent-subtle border border-accent/15" />Only You</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-card border border-accent/40" />Only {firstName(other.name)}</span>
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-accent" />Shared by Everyone</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-[#8C6A52]" />Shared by Some (lines show who)</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-card border border-accent/40" />Only One Person</span>
            {people.some(p => p.you) && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-accent-subtle border border-accent/15" />Only You</span>}
          </>
        )}
      </div>

      <p className="mt-3 text-sm text-text-secondary text-center min-h-[1.25rem]" aria-live="polite">
        {chosen ? (
          <>
            <span className="font-medium text-text-primary">{chosen.label}</span>
            {chosen.people.length > 1
              ? <> · {chosen.reason || 'Shared.'} <span className="text-text-muted">({namesOf(chosen.people, people)})</span></>
              : <> · Only {namesOf(chosen.people, people)}</>}
          </>
        ) : focusPerson ? (
          <>Showing everything that includes {namesOf([focusPerson], people)}. Tap again to show all.</>
        ) : pair ? (
          'Tap a dark bubble to see more.'
        ) : (
          'Tap a bubble or a person to see more.'
        )}
      </p>

      <ul className="sr-only">
        {interests.map(i => (
          <li key={i.label}>
            {i.label}: {i.people.length > 1 ? `shared by ${namesOf(i.people, people)}${i.reason ? `. ${i.reason}` : ''}` : `only ${namesOf(i.people, people)}`}
          </li>
        ))}
      </ul>
    </div>
  )
}
