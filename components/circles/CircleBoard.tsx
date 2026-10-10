'use client'

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { canMoveInto, circleAt, layoutCircles, subtreeIds, type LaidOut, type StudioCircle } from '@/components/circles/layout'
import { play } from '@/components/circles/sound'

// The circles of the Circles page: Outer > Inner > own circles drawn inside
// each other, plus own circles on their own outside the Outer Circle, on a
// large open area. Circles float like bubbles; tapping one selects it.
// With own circles (Social Butterfly) a circle can be dragged into another one
// or out onto the open area. Borders feel like jelly (owner design 2026-10-10):
// a circle pushed against a border squishes and is held back for a moment,
// then gives in and goes through; circles it touches are nudged aside.
// People and sections dragged from the side panels are dropped via hitTest().

export type BoardHandle = { hitTest: (clientX: number, clientY: number) => string | null }
export type CircleStats = Record<string, { people: number; sections: number }>

type Point = { x: number; y: number }
type Drag = {
  id: string
  grab: Point // circle centre minus pointer, in layout units
  center: Point // where the pointer wants the circle
  holder: string // where the circle sits now ('alone' = on its own)
  target: string | null
  since: number // when the circle started pressing into `target`
  accepted: boolean // the border gave in
  valid: boolean
}

const MIN_DRAG = 6 // px before a press becomes a drag (a shorter press is a tap)
const SIDE = 36 // px of open area left and right of the circles
const ROOM = 110 // px of open area above and below (drop zone for "on its own")
const GIVE_MS = 320 // how long a border holds before it gives in
const BLOB = '45% 55% 53% 47% / 56% 44% 56% 44%'

function bob(id: string): React.CSSProperties {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { animationDuration: `${6.5 + (h % 30) / 10}s`, animationDelay: `-${(h % 70) / 10}s` }
}

export default function CircleBoard({
  ref,
  circles,
  innerAllowed,
  stats,
  selected,
  onSelect,
  canArrange,
  onMoveCircle,
  dropTarget,
  maxWidth = 760,
}: {
  ref?: Ref<BoardHandle>
  circles: StudioCircle[]
  innerAllowed: boolean
  stats: CircleStats
  selected: string | null
  onSelect: (id: string) => void
  canArrange: boolean
  onMoveCircle: (id: string, target: string) => void
  dropTarget: string | null
  maxWidth?: number
}) {
  const reduceMotion = useReducedMotion()
  const [drag, setDrag] = useState<Drag | null>(null)
  const [width, setWidth] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const press = useRef<{ id: string; x: number; y: number; dragging: boolean } | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const giveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => { ro.disconnect(); if (giveTimer.current) clearTimeout(giveTimer.current) }
  }, [])

  const full = Math.min(width || 340, maxWidth)
  const avail = full - SIDE * 2
  // Laid out again on small screens (settling) so names stay legible.
  const { nodes, bounds } = useMemo(() => {
    const unitsWide = (b: { minX: number; maxX: number }) => b.maxX - b.minX
    const base = { innerAllowed, innerCount: 0 }
    let result = layoutCircles(circles, { ...base, label: 42, leafMin: 64 })
    for (let i = 0; i < 3; i++) {
      const s = avail / unitsWide(result.bounds)
      if (s >= 0.9) break
      const text = Math.max(0.85, Math.min(1, s))
      result = layoutCircles(circles, {
        ...base,
        label: Math.min(80, Math.max(42, (34 * text + 12) / s)),
        leafMin: Math.min(96, Math.max(64, 50 / s)),
      })
    }
    return result
  }, [circles, innerAllowed, avail])
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const unitsW = bounds.maxX - bounds.minX
  const unitsH = bounds.maxY - bounds.minY
  const scale = Math.min(1.35, avail / unitsW)
  const room = full < 500 ? ROOM * 0.6 : ROOM
  const canvasW = full
  const canvasH = unitsH * scale + room * 2
  const ox = (canvasW - unitsW * scale) / 2
  const px = (x: number) => ox + (x - bounds.minX) * scale
  const py = (y: number) => room + (y - bounds.minY) * scale
  const textScale = Math.max(0.85, Math.min(1.1, scale))
  const compact = scale < 0.8
  const moving = drag ? subtreeIds(nodes, drag.id) : null
  const placeOf = (id: string) => byId.get(id)?.parent ?? 'alone'

  const toLayout = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    return { x: (clientX - rect.left - ox) / scale + bounds.minX, y: (clientY - rect.top - room) / scale + bounds.minY, inside }
  }

  useImperativeHandle(ref, () => ({
    hitTest: (clientX, clientY) => {
      if (!canvasRef.current) return null
      const p = toLayout(clientX, clientY)
      return p.inside ? circleAt(nodes, p.x, p.y, new Set())?.id ?? null : null
    },
  }))

  // Works out target / resistance for a wanted centre and stores the drag.
  const update = (id: string, center: Point, inside: boolean, grab: Point, now: number) => {
    const prev = dragRef.current
    const holder = placeOf(id)
    const hit = circleAt(nodes, center.x, center.y, subtreeIds(nodes, id))
    const target = hit ? hit.id : inside ? 'alone' : null
    const changed = !prev || prev.target !== target
    const since = changed ? now : prev.since
    const accepted = target === holder || target === null || now - since >= GIVE_MS
    if (accepted && prev && !prev.accepted && target !== holder && target) play('lift')
    if (!accepted) {
      if (giveTimer.current) clearTimeout(giveTimer.current)
      giveTimer.current = setTimeout(() => {
        const d = dragRef.current
        if (d) update(d.id, d.center, true, d.grab, d.since + GIVE_MS + 10)
      }, GIVE_MS - (now - since) + 10)
    }
    const valid = target === 'alone' || (!!target && canMoveInto(nodes, id, target))
    const next: Drag = { id, grab, center, holder, target, since, accepted, valid }
    dragRef.current = next
    setDrag(next)
  }

  const onPointerDown = (e: React.PointerEvent, node: LaidOut) => {
    if (e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    press.current = { id: node.id, x: e.clientX, y: e.clientY, dragging: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current
    if (!p || !canArrange || byId.get(p.id)?.kind !== 'custom') return
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < MIN_DRAG) return
    const point = toLayout(e.clientX, e.clientY)
    const node = byId.get(p.id)!
    if (!p.dragging) {
      p.dragging = true
      play('lift')
      const start = toLayout(p.x, p.y)
      dragRef.current = null
      update(p.id, { x: node.x, y: node.y }, true, { x: node.x - start.x, y: node.y - start.y }, e.timeStamp)
    }
    const grab = dragRef.current?.grab ?? { x: 0, y: 0 }
    update(p.id, { x: point.x + grab.x, y: point.y + grab.y }, point.inside, grab, e.timeStamp)
  }
  const finish = (drop: boolean) => {
    const d = dragRef.current
    dragRef.current = null
    if (giveTimer.current) clearTimeout(giveTimer.current)
    setDrag(null)
    if (!drop || !d) return
    if (d.accepted && d.valid && d.target && d.target !== d.holder) {
      play('drop')
      onMoveCircle(d.id, d.target)
    } else play('back')
  }
  const onPointerUp = () => {
    const p = press.current
    press.current = null
    if (!p) return
    if (!p.dragging) { onSelect(p.id); return }
    finish(true)
  }
  const onPointerCancel = () => { press.current = null; finish(false) }

  // --- Where everything is drawn while dragging -----------------------------
  const dragged = drag ? byId.get(drag.id) : undefined
  let visual: Point | null = null
  let squish: { angle: number; along: number; across: number } | null = null
  const resisting = !!drag && !drag.accepted && drag.target !== drag.holder
  if (drag && dragged) {
    visual = drag.center
    if (resisting) {
      // Held on the border it is pushing against (the nearer of the two).
      const candidates = [drag.target, drag.holder].map(id => (id ? byId.get(id) : undefined)).filter((n): n is LaidOut => !!n)
      const border = candidates.sort((a, b) =>
        Math.abs(Math.hypot(drag.center.x - a.x, drag.center.y - a.y) - a.r) - Math.abs(Math.hypot(drag.center.x - b.x, drag.center.y - b.y) - b.r))[0]
      if (border) {
        const dx = drag.center.x - border.x
        const dy = drag.center.y - border.y
        const dist = Math.max(0.001, Math.hypot(dx, dy))
        const edge = { x: border.x + (dx / dist) * border.r, y: border.y + (dy / dist) * border.r }
        visual = { x: edge.x + (drag.center.x - edge.x) * 0.35, y: edge.y + (drag.center.y - edge.y) * 0.35 }
        const depth = Math.min(1, Math.abs(dist - border.r) / Math.max(1, dragged.r))
        squish = { angle: (Math.atan2(dy, dx) * 180) / Math.PI, along: 1 - 0.2 * depth, across: 1 + 0.1 * depth }
      }
    }
  }
  const dragOffset = visual && dragged ? { x: visual.x - dragged.x, y: visual.y - dragged.y } : { x: 0, y: 0 }

  // Circles the dragged one touches are nudged aside (with what is inside them).
  const push = new Map<string, Point>()
  if (visual && dragged && moving) {
    for (const n of nodes) {
      if (moving.has(n.id)) continue
      const dist = Math.hypot(n.x - visual.x, n.y - visual.y)
      if (dist < n.r) continue // contains the dragged circle
      const parent = n.parent ? byId.get(n.parent) : undefined
      if (parent && Math.hypot(parent.x - visual.x, parent.y - visual.y) >= parent.r) continue // its parent gets nudged instead
      const overlap = dragged.r + n.r - dist
      if (overlap <= 0) continue
      const k = Math.min(overlap * 0.4, 18) / Math.max(0.001, dist)
      push.set(n.id, { x: (n.x - visual.x) * k, y: (n.y - visual.y) * k })
    }
  }
  const nudge = (n: LaidOut): Point => {
    let x = 0
    let y = 0
    for (let m: LaidOut | undefined = n; m; m = m.parent ? byId.get(m.parent) : undefined) {
      const p = push.get(m.id)
      if (p) { x += p.x; y += p.y }
    }
    return { x, y }
  }

  const hint = drag
    ? resisting && drag.valid && drag.target
      ? 'Keep pushing…'
      : drag.accepted && drag.valid && drag.target && drag.target !== drag.holder
        ? drag.target === 'alone'
          ? `Let go to keep ${dragged?.name} on its own, outside the Outer Circle`
          : `Let go to put ${dragged?.name} in ${byId.get(drag.target)?.name}`
        : drag.target && !drag.valid
          ? 'Circles can be nested at most 4 deep.'
          : ''
    : ''

  return (
    <div ref={wrapRef} className="w-full">
      <p className="h-4 text-center text-xs text-text-secondary" aria-live="polite">{hint}</p>
      <div
        ref={canvasRef}
        className={`relative mx-auto mt-2 select-none rounded-[3rem] border border-dashed transition-colors [-webkit-touch-callout:none] ${
          drag?.target === 'alone' && drag.accepted && drag.valid && drag.holder !== 'alone' ? 'border-accent/40 bg-accent-tint/30' : 'border-transparent'
        }`}
        style={{ width: canvasW, height: canvasH }}
      >
        {nodes.map(n => {
          const isMoving = !!moving?.has(n.id)
          const isDragged = drag?.id === n.id
          const pressing = !!drag && drag.valid && drag.target === n.id && n.id !== drag.holder
          const isTarget = (pressing && drag!.accepted) || dropTarget === n.id
          const isSelected = selected === n.id
          const off = isMoving ? dragOffset : nudge(n)
          const d = n.r * 2 * scale
          const atTop = n.hasChildren || n.kind === 'outer'
          const st = stats[n.id] ?? { people: 0, sections: 0 }
          const tone = n.kind === 'outer'
            ? 'bg-accent-tint/50 border-border'
            : n.kind === 'inner'
              ? 'bg-accent-subtle/60 border-accent/15'
              : n.depth % 2 ? 'bg-card border-accent/25' : 'bg-accent-tint/80 border-accent/25'
          return (
            <motion.div
              key={n.id}
              initial={false}
              animate={{
                x: px(n.x + off.x) - d / 2,
                y: py(n.y + off.y) - d / 2,
                width: d,
                height: d,
                scale: isTarget ? 1.06 : pressing ? 1.025 : isDragged ? 1.04 : 1,
              }}
              transition={reduceMotion
                ? { duration: 0 }
                : isMoving
                  ? { type: 'spring', stiffness: 520, damping: 30, mass: 0.8 }
                  : { type: 'spring', stiffness: 200, damping: 14, mass: 1 }}
              whileHover={!drag ? { scale: 1.02 } : undefined}
              className={`absolute left-0 top-0 rounded-full outline-none ${
                canArrange && n.kind === 'custom' ? (isDragged ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
              }`}
              style={{ zIndex: (isMoving ? 40 : 0) + n.depth + (n.kind === 'custom' && n.parent === null ? 1 : 0), touchAction: canArrange && n.kind === 'custom' ? 'none' : 'manipulation' }}
              role="button"
              tabIndex={0}
              aria-label={`${n.name}: ${st.people} ${st.people === 1 ? 'person' : 'people'}, ${st.sections} Vault ${st.sections === 1 ? 'section' : 'sections'}`}
              aria-pressed={isSelected}
              onPointerDown={e => onPointerDown(e, n)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onLostPointerCapture={() => { if (press.current) onPointerCancel() }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id) } }}
            >
              {/* Floats on its own (CSS "bob"); the bubble squishes and bends like jelly. */}
              <span className={`absolute inset-0 ${isMoving || reduceMotion ? '' : 'animate-bob'}`} style={bob(n.id)}>
                <span
                  className="absolute inset-0 transition-transform duration-150 ease-out"
                  style={isDragged && squish ? { transform: `rotate(${squish.angle}deg) scale(${squish.along}, ${squish.across}) rotate(${-squish.angle}deg)` } : undefined}
                >
                  <motion.span
                    initial={false}
                    animate={{ borderRadius: (isTarget || pressing) && !reduceMotion ? BLOB : '50%' }}
                    transition={{ type: 'spring', stiffness: 140, damping: 9 }}
                    className={`absolute inset-0 border transition-[box-shadow,border-color,background-color] ${tone} ${
                      isTarget ? '!border-accent/70 ring-4 ring-accent/10' : pressing ? '!border-accent/50' : ''
                    } ${isSelected ? '!border-accent ring-2 ring-accent/60 shadow-card' : ''} ${
                      isDragged ? 'shadow-card' : n.kind === 'custom' ? 'shadow-[0_2px_6px_rgba(43,30,22,0.07)]' : ''
                    }`}
                  />
                </span>
                <span
                  className={`absolute inset-x-0 flex flex-col items-center leading-tight pointer-events-none ${atTop ? 'top-0 pt-3 px-3' : 'inset-y-0 justify-center px-2'}`}
                  style={{ fontSize: 14 * textScale }}
                >
                  <span className={`max-w-full truncate font-medium ${isSelected ? 'text-accent' : n.kind === 'custom' ? 'text-text-primary' : 'text-text-secondary'}`}>{n.name}</span>
                  {!(compact && atTop) && (
                    <span className="mt-1 flex items-center gap-2.5 text-text-muted whitespace-nowrap tabular-nums" style={{ fontSize: 12 * textScale }}>
                      <span className="inline-flex items-center gap-1" title="People">
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><circle cx="6" cy="3.6" r="2.4" /><path d="M1.5 11c.4-2.6 2.3-4 4.5-4s4.1 1.4 4.5 4z" /></svg>
                        {st.people}
                      </span>
                      <span className="inline-flex items-center gap-1" title="Vault sections">
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="1.5" width="8" height="9" rx="1.5" /><path d="M4 4.5h4M4 7h3" /></svg>
                        {st.sections}
                      </span>
                    </span>
                  )}
                </span>
              </span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
