'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Avatar from '@/components/ui/Avatar'
import type { SimilarityInterest } from '@/lib/similarity/types'

// Similarities as floating bubbles (owner design 2026-10-12/20, same feel as
// the Circles board: soft bubbles that drift gently on their own). A bubble's
// size shows how much the people's texts say about that topic.
// - Two people (a profile): you on the left, them on the right; shared
//   bubbles (dark) in the middle, yours (beige) and theirs (white) on each
//   side. Only shared bubbles can be tapped (they show why they match).
// - A group (Similarities Chart): every person is a picture on a ring. Shared
//   by everyone = dark, in the middle. Shared by some = brown, between those
//   people, with lines to each of them. Only one person = light, next to them
//   with a faint line. Tapping people selects them: what they all share is
//   highlighted, the rest greyed, and a faint line between every two of them
//   carries their stars. Hovering (or tapping) a bubble shows Elaborate*,
//   which grows the bubble over the chart with a short comparison.

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
  // Groups: how far out from the middle it may sit (share of the people's ring).
  band: [number, number]
}
type Node = { key: string; x: number; y: number }

const FONT = 12
const CHAR_W = 6.7
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
  const rx = W / 2 - NODE_R - 30
  const ry = H / 2 - NODE_R - 34
  return people.map((p, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / people.length
    return { key: p.key, x: W / 2 + rx * Math.cos(a), y: H / 2 + ry * Math.sin(a) }
  })
}

// Deterministic layout (owner 2026-10-21): every bubble sits where its people
// are — shared by everyone in the middle, shared by some between exactly those
// people (two people: on the line between them), only one person next to
// them — so the more people share a topic, the nearer the middle it is.
// Bubbles are then pushed apart until none overlap (shrinking all a little if
// the space is too tight).
function layout(people: ChartPerson[], interests: SimilarityInterest[], W: number, H: number, pair: boolean, minR = 0): { bubbles: Bubble[]; nodes: Node[] } {
  const nodes = personNodes(people, W, H, pair)
  const at = new Map(nodes.map(n => [n.key, n]))
  const small = W < 520
  const cx = W / 2
  const cy = H / 2
  // Room between bubbles; a little more on big screens.
  const gap = pair ? 6 : small ? 10 : 18
  // The ring the people sit on (see personNodes).
  const rx = Math.max(1, W / 2 - NODE_R - 30)
  const ry = Math.max(1, H / 2 - NODE_R - 34)

  const make = (scale: number): Bubble[] => interests.map((interest, i) => {
    const members = interest.people.filter(k => at.has(k))
    const kind: Kind = members.length >= people.length && people.length > 1 ? 'all' : members.length > 1 ? 'some' : 'one'
    let tx = cx
    let ty = cy
    let band: [number, number] = [0, 2]
    if (!pair) {
      // Groups (owner 2026-10-21): three layers on the way out from the
      // middle — shared by everyone (a cluster in the middle), then shared by
      // some (between exactly those people), then only one person (next to them).
      const n = people.length
      let angle = 0
      let rho = 0
      if (kind === 'all') {
        band = [0, 0.3]
      } else if (kind === 'some') {
        const u = members.reduce((s, k) => s + (at.get(k)!.x - cx) / rx, 0) / members.length
        const v = members.reduce((s, k) => s + (at.get(k)!.y - cy) / ry, 0) / members.length
        if (Math.hypot(u, v) < 0.15 && members.length === 2) {
          // Opposite each other: beside the middle, still between them.
          const a = at.get(members[0])!
          const b = at.get(members[1])!
          angle = Math.atan2((b.x - a.x) / rx, -(b.y - a.y) / ry) + (i % 2 ? Math.PI : 0)
        } else {
          angle = Math.atan2(v, u)
        }
        rho = 0.48 + (0.16 * (n - members.length)) / Math.max(1, n - 2)
        band = [0.38, 0.7]
      } else if (members.length) {
        const p = at.get(members[0])!
        angle = Math.atan2((p.y - cy) / ry, (p.x - cx) / rx)
        rho = 0.84
        band = [0.76, 1]
      }
      tx = cx + Math.cos(angle) * rho * rx
      ty = cy + Math.sin(angle) * rho * ry
    } else if (members.length && kind !== 'all') {
      const mx = members.reduce((s, k) => s + at.get(k)!.x, 0) / members.length
      const my = members.reduce((s, k) => s + at.get(k)!.y, 0) / members.length
      // One person: between them and the middle, closer to them.
      const t = kind === 'one' ? (pair ? 0.82 : 0.72) : 1
      tx = cx + (mx - cx) * t
      ty = cy + (my - cy) * t
      // Two people opposite each other: their middle is the chart's middle,
      // so move it off to one side, still on the line between them.
      if (kind === 'some' && Math.hypot(tx - cx, ty - cy) < 30 && members.length === 2) {
        const a = at.get(members[0])!
        const b = at.get(members[1])!
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const side = i % 2 ? 1 : -1
        tx = cx + (-(b.y - a.y) / len) * 70 * side
        ty = cy + ((b.x - a.x) / len) * 70 * side
      }
    }
    const lines = splitLabel(interest.label)
    const longest = Math.max(...lines.map(l => l.length))
    // Size: how much the texts say about it (1 to 5).
    const base = 24 + Math.min(5, Math.max(1, interest.strength || 1)) * 6.5
    const r = Math.min(minR ? 80 : 66, Math.max(base * scale, (longest * CHAR_W * (small ? 0.92 : 1)) / 2 + 9, lines.length > 1 ? 30 * scale : 0, minR * scale))
    const angle = i * 2.399963
    return { interest, lines, r, x: tx + Math.cos(angle) * 6, y: ty + Math.sin(angle) * 6, tx, ty, kind, owner: kind === 'one' ? members[0] : undefined, band }
  })

  const obstacles = pair ? [] : nodes.map(n => ({ x: n.x, y: n.y, r: NODE_R + 26 }))
  const top = pair ? 26 : 8
  const settle = (bubbles: Bubble[]): number => {
    for (let step = 0; step < 500; step++) {
      // Pull towards their place (gently, so pushing apart wins).
      const pull = step < 350 ? 0.06 : 0.015
      for (const b of bubbles) {
        b.x += (b.tx - b.x) * pull
        b.y += (b.ty - b.y) * pull
      }
      for (let i = 0; i < bubbles.length; i++) {
        const a = bubbles[i]
        for (let j = i + 1; j < bubbles.length; j++) {
          const b = bubbles[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy) || 0.01
          const overlap = a.r + b.r + gap - dist
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
      // Keep each bubble in its layer.
      if (!pair) {
        for (const b of bubbles) {
          const u = (b.x - cx) / rx
          const v = (b.y - cy) / ry
          const rho = Math.hypot(u, v)
          const want = rho < b.band[0] ? b.band[0] : rho > b.band[1] ? b.band[1] : rho
          if (want !== rho) {
            const f = rho > 0.001 ? (rho + (want - rho) * 0.5) / rho : 1
            b.x = cx + (b.x - cx) * f
            b.y = cy + (b.y - cy) * f
          }
        }
      }
      for (const b of bubbles) {
        b.x = Math.min(W - b.r - 4, Math.max(b.r + 4, b.x))
        b.y = Math.min(H - b.r - 8, Math.max(b.r + top, b.y))
      }
    }
    // The worst overlap left (0 = none).
    let worst = 0
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i]
        const b = bubbles[j]
        worst = Math.max(worst, a.r + b.r + 2 - Math.hypot(b.x - a.x, b.y - a.y))
      }
    }
    return worst
  }

  let scale = (small ? 0.82 : 1) * (interests.length > 14 ? 0.9 : 1)
  let bubbles = make(scale)
  for (let tries = 0; tries < 6 && settle(bubbles) > 0; tries++) {
    scale *= 0.9
    bubbles = make(scale)
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


const STARS = (level: number) => '★★★★★'.slice(0, level) + '☆☆☆☆☆'.slice(0, 5 - level)

export type LearnMore = (interest: SimilarityInterest) => Promise<{ summary?: string; error?: string }>

export default function BubbleChart({
  people,
  interests,
  height,
  pairLevel,
  onLearnMore,
}: {
  people: ChartPerson[]
  interests: SimilarityInterest[]
  height?: number
  // Groups: the stars between two people (1 to 5), if known.
  pairLevel?: (a: string, b: string) => number | undefined
  // Groups: Learn More* on a bubble (paid per use).
  onLearnMore?: LearnMore
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const reduceMotion = useReducedMotion()
  const pair = people.length === 2
  const [active, setActive] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [zoom, setZoom] = useState<{ label: string; summary?: string; error?: string } | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [zoom])

  const W = width
  const H = height ?? (pair ? Math.max(260, Math.min(340, W * 0.75)) : W < 640 ? Math.round(W * 1.85) : Math.round(Math.min(860, Math.max(580, W * 0.68))))
  const { bubbles, nodes } = useMemo(
    // With Learn More, bubbles are big enough for the button inside.
    () => (W > 0 ? layout(people, interests, W, H, pair, onLearnMore ? 56 : 0) : { bubbles: [], nodes: [] }),
    [people, interests, W, H, pair, onLearnMore]
  )
  const nodeAt = new Map(nodes.map(n => [n.key, n]))
  const chosen = interests.find(i => i.label === active)
  const zoomed = bubbles.find(b => b.interest.label === zoom?.label)
  const other = people.find(p => !p.you) ?? people[1]

  // Highlighted: the tapped bubble, or what every picked person shares.
  const lit = (b: Bubble) =>
    chosen ? b.interest.label === chosen.label : picked.length ? picked.every(k => b.interest.people.includes(k)) : true
  const focusing = !!chosen || picked.length > 0

  const togglePerson = (key: string) => {
    setActive(null)
    setPicked(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]))
  }

  const learnMore = async (b: Bubble) => {
    if (!onLearnMore) return
    setActive(null)
    setZoom({ label: b.interest.label })
    const out = await onLearnMore(b.interest).catch(() => ({ error: 'Elaborate is not available right now.' }))
    setZoom(z => (z && z.label === b.interest.label ? { label: z.label, ...out } : z))
  }

  // Faint lines between every two picked people, bent outwards around the
  // bubbles, with their stars in the middle.
  const pairLines: { id: string; d: string; x: number; y: number; level?: number }[] = []
  if (!pair && picked.length >= 2) {
    for (let i = 0; i < picked.length; i++) {
      for (let j = i + 1; j < picked.length; j++) {
        const a = nodeAt.get(picked[i])
        const b = nodeAt.get(picked[j])
        if (!a || !b) continue
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        let ox = mx - W / 2
        let oy = my - H / 2
        const len = Math.hypot(ox, oy)
        if (len < 40) { ox = -(b.y - a.y); oy = b.x - a.x }
        const ol = Math.hypot(ox, oy) || 1
        const bend = Math.min(W, H) * 0.32
        const cx = mx + (ox / ol) * bend
        const cy = my + (oy / ol) * bend
        pairLines.push({
          id: `${picked[i]}-${picked[j]}`,
          d: `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`,
          x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x,
          y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y,
          level: pairLevel?.(picked[i], picked[j]),
        })
      }
    }
  }

  return (
    <div>
      <div ref={wrapRef} className="relative w-full select-none" style={{ height: W ? H : pair ? 280 : 500 }}>
        {W > 0 && (
          <motion.div className="absolute inset-0" animate={{ opacity: zoom ? 0.12 : 1 }} transition={{ duration: 0.35 }}>
            {/* Lines from bubbles to the people who have them, and between picked people. */}
            {!pair && (
              <svg className="absolute inset-0 pointer-events-none overflow-visible" width={W} height={H} aria-hidden="true">
                {pairLines.map(l => (
                  <path key={l.id} d={l.d} fill="none" stroke="#5C3B28" strokeOpacity={0.18} strokeWidth={1.2} strokeDasharray="2 5" strokeLinecap="round" />
                ))}
                {bubbles.map(b => {
                  const on = lit(b)
                  // Shared by everyone: strings only while highlighted.
                  if (b.kind === 'all' && !(on && focusing)) return null
                  return (
                    <g key={b.interest.label} className={reduceMotion ? undefined : 'animate-bob'} style={drift(b.interest.label)}>
                      {b.interest.people.map(k => {
                        const n = nodeAt.get(k)
                        if (!n) return null
                        // People picked: only the strings to them stand out. Bubble tapped: all of its strings.
                        const highlighted = on && (chosen ? true : picked.length ? picked.includes(k) : false)
                        const faint = focusing && !highlighted
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
                            strokeOpacity={highlighted ? 0.6 : faint ? 0.04 : b.kind === 'one' ? 0.12 : 0.22}
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

            {/* Stars between picked people */}
            {pairLines.map(l => l.level ? (
              <span
                key={l.id}
                className="absolute z-[6] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background/90 px-2 py-0.5 text-[13px] leading-none tracking-[0.12em] text-accent shadow-soft pointer-events-none"
                style={{ left: l.x, top: l.y }}
                aria-label={`${l.level} of 5`}
              >
                {STARS(l.level)}
              </span>
            ) : null)}

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
              const isActive = active === b.interest.label
              // Profile: only shared bubbles do something. Groups: every bubble.
              const tappable = pair ? isShared : true
              const d = b.r * 2
              const label = `${b.interest.label}: ${isShared ? `shared by ${namesOf(b.interest.people, people)}` : `only ${namesOf(b.interest.people, people)}`}`
              const face = (
                <>
                  {b.lines.map((line, k) => <span key={k} className="block max-w-full truncate">{line}</span>)}
                </>
              )
              const faceClass = `absolute inset-0 rounded-full border flex flex-col items-center justify-center text-center leading-tight px-1 transition-shadow duration-300 ${tone} ${isActive ? 'ring-4 ring-accent/20' : ''}`
              return (
                <motion.div
                  key={b.interest.label}
                  className="absolute group"
                  style={{ left: b.x - b.r, top: b.y - b.r, width: d, height: d, zIndex: isActive ? 8 : 2 }}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: on ? 1 : 0.25, scale: 1 }}
                  whileHover={{ zIndex: 9 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 18, delay: reduceMotion ? 0 : Math.min(i * 0.035, 0.6) }}
                >
                  <span className={`absolute inset-0 ${reduceMotion ? '' : 'animate-bob'}`} style={drift(b.interest.label)}>
                    {/* Grows on hover; Elaborate* appears inside, under the topic. */}
                    <span className={`absolute inset-0 transition-transform duration-300 ${tappable ? 'group-hover:scale-[1.16]' : ''} ${isActive ? 'scale-[1.16]' : ''}`}>
                      {tappable ? (
                        <button
                          type="button"
                          onClick={() => setActive(isActive ? null : b.interest.label)}
                          aria-pressed={isActive}
                          aria-label={label}
                          className={faceClass}
                          style={{ fontSize: FONT * (W < 520 ? 0.95 : 1), fontWeight: isShared ? 600 : 500 }}
                        >
                          <span className={`flex flex-col items-center max-w-full transition-transform duration-300 ${onLearnMore ? `group-hover:-translate-y-2.5 ${isActive ? '-translate-y-2.5' : ''}` : ''}`}>{face}</span>
                        </button>
                      ) : (
                        <span className={faceClass} style={{ fontSize: FONT * (W < 520 ? 0.95 : 1), fontWeight: 500 }} aria-label={label} role="img">
                          {face}
                        </span>
                      )}
                      {onLearnMore && (
                        <button
                          type="button"
                          onClick={() => void learnMore(b)}
                          className={`absolute left-1/2 top-[64%] -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-px text-[9px] font-semibold leading-tight transition-opacity duration-200 ${
                            b.kind === 'one' ? 'bg-accent text-white' : 'bg-white/90 text-accent'
                          } ${isActive ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto'}`}
                        >
                          Elaborate*
                        </button>
                      )}
                    </span>
                  </span>
                </motion.div>
              )
            })}

            {/* People (groups): tap to select */}
            {!pair && nodes.map(n => {
              const p = people.find(x => x.key === n.key)!
              const on = picked.includes(n.key)
              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => togglePerson(n.key)}
                  aria-pressed={on}
                  aria-label={`${on ? 'Deselect' : 'Select'} ${p.you ? 'yourself' : p.name}`}
                  className="absolute z-10 flex flex-col items-center gap-1 w-24 -ml-12"
                  style={{ left: n.x, top: n.y - NODE_R }}
                >
                  <span className={`rounded-full p-0.5 transition-all duration-300 ${on ? 'bg-accent shadow-card scale-110' : p.you ? 'bg-accent-subtle' : 'bg-card shadow-soft'}`}>
                    <Avatar url={p.avatarUrl ?? null} name={p.name} size="md" />
                  </span>
                  <span className={`max-w-full truncate rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${on ? 'bg-accent text-white' : 'bg-background/80 text-text-primary'}`}>
                    {p.you ? 'You' : firstName(p.name)}
                  </span>
                </button>
              )
            })}
          </motion.div>
        )}

        {/* Learn More: the bubble grows over the chart (like zooming in). */}
        <AnimatePresence>
          {zoom && zoomed && (
            <motion.div
              key={zoom.label}
              className={`absolute z-20 overflow-hidden border ${zoomed.kind === 'one' && people.find(p => p.key === zoomed.owner)?.you ? STYLE.mine : STYLE[zoomed.kind]}`}
              initial={{ left: zoomed.x - zoomed.r, top: zoomed.y - zoomed.r, width: zoomed.r * 2, height: zoomed.r * 2, borderRadius: 9999 }}
              animate={{ left: 0, top: 0, width: W, height: H, borderRadius: 32 }}
              exit={{ left: zoomed.x - zoomed.r, top: zoomed.y - zoomed.r, width: zoomed.r * 2, height: zoomed.r * 2, borderRadius: 9999, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22 }}
              role="dialog"
              aria-label={`${zoom.label}: Elaborate`}
            >
              <motion.div
                className="h-full w-full flex flex-col items-center justify-center text-center px-6 sm:px-16 py-10 gap-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.35 }}
              >
                <button type="button" onClick={() => setZoom(null)} className="absolute right-4 top-4 h-10 w-10 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center text-xl leading-none" aria-label="Close">
                  ×
                </button>
                <h3 className="font-display text-3xl sm:text-5xl">{zoom.label}</h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {zoomed.interest.people.map(k => {
                    const p = people.find(x => x.key === k)
                    return p ? (
                      <span key={k} className="flex items-center gap-2 rounded-full bg-black/10 pl-1 pr-3 py-1 text-sm font-medium">
                        <Avatar url={p.avatarUrl ?? null} name={p.name} size="sm" />
                        {p.you ? 'You' : firstName(p.name)}
                      </span>
                    ) : null
                  })}
                </div>
                <div className="max-w-2xl min-h-[6rem] text-base sm:text-lg leading-relaxed opacity-90" aria-live="polite">
                  {zoom.summary ?? zoom.error ?? <span className="inline-block animate-pulse">Thinking…</span>}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
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
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-[#8C6A52]" />Shared by Some</span>
            <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-card border border-accent/40" />Only One Person</span>
            {people.some(p => p.you) && <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-accent-subtle border border-accent/15" />Only You</span>}
          </>
        )}
      </div>

      <p className="mt-3 text-sm text-text-secondary text-center min-h-[1.25rem]" aria-live="polite">
        {pair ? (
          chosen && chosen.people.length > 1
            ? <><span className="font-medium text-text-primary">{chosen.label}</span> · {chosen.reason || 'Shared.'}</>
            : 'Tap a dark bubble to see more.'
        ) : chosen ? (
          chosen.people.length > 1
            ? <><span className="font-medium text-text-primary">{chosen.label}</span> · {chosen.reason || 'Shared.'} <span className="text-text-muted">({namesOf(chosen.people, people)})</span></>
            : <span className="font-medium text-text-primary">{chosen.label}</span>
        ) : picked.length ? (
          <>Showing what {namesOf(picked, people)} {picked.length > 1 ? 'share' : 'has'}. Tap a picture again to deselect.</>
        ) : (
          'Tap people to select them, or a bubble to learn more.'
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
