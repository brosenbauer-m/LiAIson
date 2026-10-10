'use client'

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { canMoveInto, circleAt, layoutCircles, subtreeIds, type LaidOut, type StudioCircle } from '@/components/circles/layout'
import { play } from '@/components/circles/sound'

// The circles in the middle of the Circles page: Outer > Inner > own circles
// drawn inside each other (plus own circles on their own outside the Outer
// Circle). Circles float gently like bubbles; tapping one selects it. With own
// circles (Social Butterfly) a circle can be dragged into another one or onto
// the empty space ("on its own"). People and sections dragged from the side
// panels are dropped with hitTest(); the circle under them bends a little.

export type BoardHandle = { hitTest: (clientX: number, clientY: number) => string | null }
export type CircleStats = Record<string, { people: number; sections: number }>

type Drag = { id: string; dx: number; dy: number; target: string | null; valid: boolean }

const MIN_DRAG = 6 // px before a press becomes a drag (a shorter press is a tap)
const MARGIN = 30 // empty space around the Outer Circle (drop zone for "on its own")
const BLOB = '46% 54% 52% 48% / 55% 45% 55% 45%'

function bob(id: string): React.CSSProperties {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { animationDuration: `${6 + (h % 30) / 10}s`, animationDelay: `-${(h % 60) / 10}s` }
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
  maxWidth = 620,
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

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const avail = Math.min(width || 340, maxWidth)
  // Laid out again on small screens (settling) so names stay legible.
  const { nodes, bounds } = useMemo(() => {
    const unitsWide = (b: { minX: number; maxX: number }) => b.maxX - b.minX + MARGIN * 2
    const base = { innerAllowed, innerCount: 0 }
    let result = layoutCircles(circles, { ...base, label: 34, leafMin: 46 })
    for (let i = 0; i < 3; i++) {
      const s = avail / unitsWide(result.bounds)
      if (s >= 0.9) break
      const text = Math.max(0.85, Math.min(1, s))
      result = layoutCircles(circles, {
        ...base,
        label: Math.min(70, Math.max(34, (30 * text + 10) / s)),
        leafMin: Math.min(80, Math.max(46, 40 / s)),
      })
    }
    return result
  }, [circles, innerAllowed, avail])
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const unitsW = bounds.maxX - bounds.minX + MARGIN * 2
  const unitsH = bounds.maxY - bounds.minY + MARGIN * 2
  const scale = Math.min(1.15, avail / unitsW)
  const px = (x: number) => (x - bounds.minX + MARGIN) * scale
  const py = (y: number) => (y - bounds.minY + MARGIN) * scale
  const textScale = Math.max(0.85, Math.min(1, scale))
  // Small screens: circles with circles inside show only their name.
  const compact = scale < 0.8
  const moving = drag ? subtreeIds(nodes, drag.id) : null
  const placeOf = (id: string) => byId.get(id)?.parent ?? 'alone'

  const toLayout = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    return { x: (clientX - rect.left) / scale + bounds.minX - MARGIN, y: (clientY - rect.top) / scale + bounds.minY - MARGIN, inside }
  }

  useImperativeHandle(ref, () => ({
    hitTest: (clientX, clientY) => {
      if (!canvasRef.current) return null
      const p = toLayout(clientX, clientY)
      return p.inside ? circleAt(nodes, p.x, p.y, new Set())?.id ?? null : null
    },
  }))

  const onPointerDown = (e: React.PointerEvent, node: LaidOut) => {
    if (e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    press.current = { id: node.id, x: e.clientX, y: e.clientY, dragging: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current
    if (!p || !canArrange || byId.get(p.id)?.kind !== 'custom') return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.dragging && Math.hypot(dx, dy) < MIN_DRAG) return
    if (!p.dragging) { p.dragging = true; play('lift') }
    const point = toLayout(e.clientX, e.clientY)
    const hit = circleAt(nodes, point.x, point.y, subtreeIds(nodes, p.id))
    const target = hit ? hit.id : point.inside ? 'alone' : null
    const valid = target === 'alone' || (!!target && canMoveInto(nodes, p.id, target))
    setDrag({ id: p.id, dx: dx / scale, dy: dy / scale, target, valid })
  }
  const onPointerUp = () => {
    const p = press.current
    press.current = null
    if (!p) return
    if (!p.dragging) {
      onSelect(p.id)
      return
    }
    const d = drag
    setDrag(null)
    if (d && d.valid && d.target && d.target !== placeOf(d.id)) {
      play('drop')
      onMoveCircle(d.id, d.target)
    } else play('back')
  }
  const onPointerCancel = () => { press.current = null; setDrag(null) }

  const hint = drag
    ? drag.valid && drag.target && drag.target !== placeOf(drag.id)
      ? drag.target === 'alone'
        ? `Let go to keep ${byId.get(drag.id)?.name} on its own, outside the Outer Circle`
        : `Let go to put ${byId.get(drag.id)?.name} in ${byId.get(drag.target)?.name}`
      : drag.target && !drag.valid
        ? 'Circles can be nested at most 4 deep.'
        : ''
    : ''

  return (
    <div ref={wrapRef} className="w-full">
      <p className="h-4 text-center text-xs text-text-secondary" aria-live="polite">{hint}</p>
      <div
        ref={canvasRef}
        className={`relative mx-auto mt-2 select-none rounded-[2.5rem] border border-dashed transition-colors [-webkit-touch-callout:none] ${
          drag?.target === 'alone' && drag.valid && placeOf(drag.id) !== 'alone' ? 'border-accent/40 bg-accent-tint/40' : 'border-transparent'
        }`}
        style={{ width: unitsW * scale, height: unitsH * scale }}
      >
        {nodes.map(n => {
          const isMoving = !!moving?.has(n.id)
          const isDragged = drag?.id === n.id
          const isTarget = (!!drag && drag.valid && drag.target === n.id && n.id !== placeOf(drag.id)) || dropTarget === n.id
          const isSelected = selected === n.id
          const offX = isMoving ? drag!.dx : 0
          const offY = isMoving ? drag!.dy : 0
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
                x: px(n.x + offX) - d / 2,
                y: py(n.y + offY) - d / 2,
                width: d,
                height: d,
                scale: isTarget ? 1.06 : isDragged ? 1.04 : 1,
              }}
              transition={reduceMotion
                ? { duration: 0 }
                : isMoving
                  ? { type: 'spring', stiffness: 650, damping: 40, mass: 0.7 }
                  : { type: 'spring', stiffness: 220, damping: 18, mass: 0.9 }}
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
              {/* The visible bubble floats on its own and bends a little when something is dragged onto it. */}
              <motion.span
                initial={false}
                animate={{ borderRadius: isTarget && !reduceMotion ? BLOB : '50%' }}
                transition={{ type: 'spring', stiffness: 160, damping: 12 }}
                className={`absolute inset-0 border transition-[box-shadow,border-color,background-color] ${tone} ${
                  isMoving || reduceMotion ? '' : 'animate-bob'
                } ${isTarget ? '!border-accent/70 ring-4 ring-accent/10' : ''} ${
                  isSelected ? '!border-accent ring-2 ring-accent/60 shadow-card' : ''
                } ${isDragged ? 'shadow-card' : n.kind === 'custom' ? 'shadow-[0_1px_2px_rgba(43,30,22,0.06)]' : ''}`}
                style={bob(n.id)}
              >
                <span
                  className={`absolute inset-x-0 flex flex-col items-center leading-tight pointer-events-none ${atTop ? 'top-0 pt-2.5 px-3' : 'inset-y-0 justify-center px-2'}`}
                  style={{ fontSize: 13 * textScale }}
                >
                  <span className={`max-w-full truncate font-medium ${isSelected ? 'text-accent' : n.kind === 'custom' ? 'text-text-primary' : 'text-text-secondary'}`}>{n.name}</span>
                  {!(compact && atTop) && <span className="mt-0.5 flex items-center gap-2 text-text-muted whitespace-nowrap tabular-nums" style={{ fontSize: 10.5 * textScale }}>
                    <span className="inline-flex items-center gap-0.5" title="People">
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><circle cx="6" cy="3.6" r="2.4" /><path d="M1.5 11c.4-2.6 2.3-4 4.5-4s4.1 1.4 4.5 4z" /></svg>
                      {st.people}
                    </span>
                    <span className="inline-flex items-center gap-0.5" title="Vault sections">
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><rect x="2" y="1.5" width="8" height="9" rx="1.5" /><path d="M4 4.5h4M4 7h3" /></svg>
                      {st.sections}
                    </span>
                  </span>}
                </span>
              </motion.span>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
