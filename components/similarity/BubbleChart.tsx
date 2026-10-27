'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Avatar from '@/components/ui/Avatar'
import { openContextMenu } from '@/components/ui/ContextMenu'
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
//   with a faint line. Every bubble has a line to every person who has it.
//   Tapping people selects them: what they all share is highlighted, the rest
//   greyed (no scores between people, owner 2026-10-27). Hovering (or tapping)
//   a bubble shows Elaborate*, which grows the bubble over the chart with a
//   short comparison. Bubbles can be dragged (mouse or touch); their lines
//   follow, and they spring back on release. A tap outside closes a bubble.

export type ChartPerson = { key: string; name: string; avatarUrl?: string | null; you?: boolean; href?: string }

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

// How much a topic weighs on the chart: the sum of each person's 1–5 score of
// how much it matters to them (owner 2026-10-27). Older results have one
// size value for everyone who has it.
export function topicWeight(i: SimilarityInterest): number {
  const scores = i.scores ? Object.values(i.scores) : []
  if (scores.length) return scores.reduce((s, n) => s + n, 0)
  return Math.max(1, i.strength || 1) * Math.max(1, i.people.length)
}

// How much it pulls towards each person: their score (1 if unknown).
function pullOf(i: SimilarityInterest, key: string): number {
  return i.scores?.[key] ?? 1
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

  // Sizes are relative to the heaviest topic on this chart, so it always fits.
  const maxWeight = Math.max(1, ...interests.map(topicWeight))
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
      // Each person pulls the bubble towards themselves by their score.
      const total = members.reduce((s, k) => s + pullOf(interest, k), 0) || 1
      const u = members.reduce((s, k) => s + ((at.get(k)!.x - cx) / rx) * pullOf(interest, k), 0) / total
      const v = members.reduce((s, k) => s + ((at.get(k)!.y - cy) / ry) * pullOf(interest, k), 0) / total
      if (kind === 'all') {
        band = [0, 0.3]
        // Still in the middle cluster, leaning towards whom it matters most.
        angle = Math.atan2(v, u)
        rho = Math.min(0.24, Math.hypot(u, v) * 0.8)
      } else if (kind === 'some') {
        const evenU = members.reduce((s, k) => s + (at.get(k)!.x - cx) / rx, 0) / members.length
        const evenV = members.reduce((s, k) => s + (at.get(k)!.y - cy) / ry, 0) / members.length
        if (Math.hypot(evenU, evenV) < 0.15 && members.length === 2) {
          // Opposite each other: beside the middle, still between them.
          const a = at.get(members[0])!
          const b = at.get(members[1])!
          angle = Math.atan2((b.x - a.x) / rx, -(b.y - a.y) / ry) + (i % 2 ? Math.PI : 0)
          // …and towards the one it matters more to.
          const lean = (pullOf(interest, members[1]) - pullOf(interest, members[0])) / Math.max(1, total)
          angle += lean * (i % 2 ? -0.9 : 0.9)
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
      const total = members.reduce((s, k) => s + pullOf(interest, k), 0) || 1
      const mx = members.reduce((s, k) => s + at.get(k)!.x * pullOf(interest, k), 0) / total
      const my = members.reduce((s, k) => s + at.get(k)!.y * pullOf(interest, k), 0) / total
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
    // Size: how much it matters to its people together, against the heaviest
    // topic here (by area, so twice the weight looks twice as big).
    const share = Math.sqrt(topicWeight(interest) / maxWeight)
    const lo = (pair ? 22 : 26) * scale
    const hi = (pair ? 54 : 78) * scale
    const r = Math.min(minR ? 84 : 66, Math.max(lo + (hi - lo) * share, (longest * CHAR_W * (small ? 0.92 : 1)) / 2 + 9, lines.length > 1 ? 30 * scale : 0, minR * scale))
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


// Dragging a bubble: how far it is moved, and whether it is springing back.
type Pull = { label: string; x: number; y: number }
const DRAG_START = 6
export type LearnMore = (interest: SimilarityInterest) => Promise<{ summary?: string; error?: string }>

export default function BubbleChart({
  people,
  interests,
  height,
  onLearnMore,
}: {
  people: ChartPerson[]
  interests: SimilarityInterest[]
  height?: number
  // Groups: Elaborate* on a bubble (paid per use).
  onLearnMore?: LearnMore
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const reduceMotion = useReducedMotion()
  const pair = people.length === 2
  const [active, setActive] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [zoom, setZoom] = useState<{ label: string; summary?: string; error?: string } | null>(null)
  const [pull, setPull] = useState<Pull | null>(null)
  const press = useRef<{ label: string; x: number; y: number; moved: boolean; id: number } | null>(null)
  const justDragged = useRef(false)
  const springFrame = useRef(0)
  const zoomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // A click or tap anywhere outside the open bubble (or the opened
  // Elaborate view) closes it.
  useEffect(() => {
    if (!active && !zoom) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (zoom) {
        if (!zoomRef.current?.contains(t)) setZoom(null)
        return
      }
      if (!t?.closest?.('[data-bubble]')) setActive(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [active, zoom])

  useEffect(() => () => cancelAnimationFrame(springFrame.current), [])

  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [zoom])

  // Fewer bubbles than topics by default (owner 2026-10-27): passing mentions
  // stay out, and a slider shows more or fewer, always dropping the smallest.
  const ranked = useMemo(() => [...interests].sort((a, b) => topicWeight(b) - topicWeight(a)), [interests])
  const defaultCount = useMemo(() => {
    const meaningful = ranked.filter(i => topicWeight(i) / Math.max(1, i.people.length) >= 2).length
    return Math.min(ranked.length, Math.max(Math.min(5, ranked.length), Math.min(meaningful, pair ? 8 : 12)))
  }, [ranked, pair])
  const [countChoice, setCountChoice] = useState<{ for: SimilarityInterest[]; count: number } | null>(null)
  const shownCount = countChoice && countChoice.for === interests ? countChoice.count : defaultCount
  const visible = useMemo(() => ranked.slice(0, shownCount), [ranked, shownCount])

  const W = width
  const H = height ?? (pair ? Math.max(260, Math.min(340, W * 0.75)) : W < 640 ? Math.round(W * 1.85) : Math.round(Math.min(860, Math.max(580, W * 0.68))))
  const { bubbles, nodes } = useMemo(
    // With Learn More, bubbles are big enough for the button inside.
    () => (W > 0 ? layout(people, visible, W, H, pair, onLearnMore ? 46 : 0) : { bubbles: [], nodes: [] }),
    [people, visible, W, H, pair, onLearnMore]
  )
  const nodeAt = new Map(nodes.map(n => [n.key, n]))
  const chosen = visible.find(i => i.label === active)
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

  // --- Dragging bubbles (mouse and touch) ----------------------------------
  // A press that moves a few pixels becomes a drag; the bubble follows the
  // pointer with its lines, then springs back to its place on release.
  const offsetOf = (label: string) => (pull && pull.label === label ? pull : { x: 0, y: 0 })

  const springBack = (from: Pull) => {
    cancelAnimationFrame(springFrame.current)
    if (reduceMotion) { setPull(null); return }
    // A slow glide back (owner 2026-10-27): about 1.4 s, easing out.
    let start = -1
    const DURATION = 1400
    const step = (now: number) => {
      if (start < 0) start = now
      const t = Math.min(1, (now - start) / DURATION)
      const left = Math.pow(1 - t, 3)
      if (t >= 1) { setPull(null); return }
      setPull({ label: from.label, x: from.x * left, y: from.y * left })
      springFrame.current = requestAnimationFrame(step)
    }
    springFrame.current = requestAnimationFrame(step)
  }

  const onBubbleDown = (e: React.PointerEvent, label: string) => {
    if (e.button > 0 || zoom) return
    // Elaborate* is a button of its own: pressing it never drags.
    if ((e.target as Element).closest('[data-elaborate]')) return
    cancelAnimationFrame(springFrame.current)
    press.current = { label, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }
  }
  const onBubbleMove = (e: React.PointerEvent) => {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.moved) {
      if (Math.hypot(dx, dy) < DRAG_START) return
      p.moved = true
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    }
    setPull({ label: p.label, x: dx, y: dy })
  }
  const onBubbleUp = (e: React.PointerEvent) => {
    const p = press.current
    if (!p || p.id !== e.pointerId) return
    press.current = null
    if (p.moved) {
      // The click that follows a drag must not open the bubble.
      justDragged.current = true
      setTimeout(() => { justDragged.current = false }, 0)
      springBack({ label: p.label, x: e.clientX - p.x, y: e.clientY - p.y })
    }
  }
  const onBubbleCancel = () => {
    const p = press.current
    press.current = null
    if (p?.moved && pull) springBack(pull)
  }

  return (
    <div>
      <div ref={wrapRef} className="relative w-full select-none" style={{ height: W ? H : pair ? 280 : 500 }}>
        {W > 0 && (
          <motion.div className="absolute inset-0" animate={{ opacity: zoom ? 0.12 : 1 }} transition={{ duration: 0.35 }}>
            {/* Lines from every bubble to every person who has it. */}
            {!pair && (
              <svg className="absolute inset-0 pointer-events-none overflow-visible" width={W} height={H} aria-hidden="true">
                {bubbles.map(b => {
                  const on = lit(b)
                  const off = offsetOf(b.interest.label)
                  const bx = b.x + off.x
                  const by = b.y + off.y
                  return (
                    <g key={b.interest.label} className={reduceMotion ? undefined : 'animate-bob'} style={drift(b.interest.label)}>
                      {b.interest.people.map(k => {
                        const n = nodeAt.get(k)
                        if (!n) return null
                        // People picked: only the strings to them stand out. Bubble tapped: all of its strings.
                        const highlighted = on && (chosen ? true : picked.length ? picked.includes(k) : false)
                        const faint = focusing && !highlighted
                        // A soft curve, bent a little towards the middle.
                        const mx = (bx + n.x) / 2
                        const my = (by + n.y) / 2
                        const qx = mx + (W / 2 - mx) * 0.18
                        const qy = my + (H / 2 - my) * 0.18
                        return (
                          <path
                            key={k}
                            d={`M ${bx} ${by} Q ${qx} ${qy} ${n.x} ${n.y}`}
                            fill="none"
                            strokeLinecap="round"
                            stroke="#5C3B28"
                            strokeWidth={highlighted ? 1.6 : 1}
                            strokeOpacity={highlighted ? 0.6 : faint ? 0.04 : b.kind === 'one' ? 0.14 : b.kind === 'all' ? 0.12 : 0.22}
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
              const off = offsetOf(b.interest.label)
              const dragging = !!pull && pull.label === b.interest.label
              return (
                <motion.div
                  key={b.interest.label}
                  data-bubble
                  className={`absolute group ${pair ? '' : dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                  style={{ left: b.x - b.r + off.x, top: b.y - b.r + off.y, width: d, height: d, zIndex: dragging ? 12 : isActive ? 8 : 2, touchAction: pair ? undefined : 'none' }}
                  // Groups only: bubbles can be dragged (the profile card keeps scrolling normally).
                  onPointerDown={pair ? undefined : e => onBubbleDown(e, b.interest.label)}
                  onPointerMove={pair ? undefined : onBubbleMove}
                  onPointerUp={pair ? undefined : onBubbleUp}
                  onPointerCancel={pair ? undefined : onBubbleCancel}
                  onContextMenu={e => openContextMenu(e, [
                    { heading: b.interest.label },
                    ...(tappable ? [{ label: isActive ? 'Close' : 'Show Who Has It', onSelect: () => setActive(isActive ? null : b.interest.label) }] : []),
                    ...(onLearnMore ? [{ label: 'Elaborate*', onSelect: () => void learnMore(b) }] : []),
                  ])}
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
                          onClick={() => { if (!justDragged.current) setActive(isActive ? null : b.interest.label) }}
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
                          data-elaborate
                          onClick={() => void learnMore(b)}
                          className={`absolute left-1/2 top-[64%] -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-tight underline underline-offset-2 rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 transition-opacity duration-200 ${
                            b.kind === 'one' ? 'text-accent decoration-accent/60' : 'text-white decoration-white/70'
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
                  onContextMenu={e => openContextMenu(e, [
                    { heading: p.you ? 'You' : p.name },
                    { label: on ? 'Deselect' : 'Select', onSelect: () => togglePerson(n.key) },
                    ...(p.href ? [{ label: 'Open LiAIson', onSelect: () => { window.location.href = p.href! } }] : []),
                  ])}
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
              ref={zoomRef}
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

      {/* How many topics are shown: from only the biggest to all of them. */}
      {ranked.length > 3 && (
        <div className="mt-4 mx-auto flex max-w-sm items-center gap-3 text-xs text-text-secondary">
          <span>Fewer</span>
          <input
            type="range"
            min={Math.min(3, ranked.length)}
            max={ranked.length}
            step={1}
            value={shownCount}
            onChange={e => { setActive(null); setCountChoice({ for: interests, count: Number(e.target.value) }) }}
            aria-label="Topics shown"
            aria-valuetext={`${shownCount} of ${ranked.length} topics`}
            className="flex-1 accent-accent"
          />
          <span>More</span>
          <span className="tabular-nums text-text-muted w-12 text-right">{shownCount}/{ranked.length}</span>
        </div>
      )}

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
        {visible.map(i => (
          <li key={i.label}>
            {i.label}: {i.people.length > 1 ? `shared by ${namesOf(i.people, people)}${i.reason ? `. ${i.reason}` : ''}` : `only ${namesOf(i.people, people)}`}
          </li>
        ))}
      </ul>
    </div>
  )
}
