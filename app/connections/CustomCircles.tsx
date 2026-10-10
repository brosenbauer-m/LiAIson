'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { canMoveInto, circleAt, layoutCircles, subtreeIds, type LaidOut, type StudioCircle } from '@/components/circles/layout'
import { play } from '@/components/circles/sound'

// Social Butterfly: the Circle Studio. The owner's circles drawn inside each
// other (Outer > Inner > own circles), plus circles on their own outside the
// Outer Circle. Drag a circle into another one (or out onto the empty space),
// or tap it and choose "Move to". Everyone in a circle also sees every circle
// around it (lib/circles.ts). Who is in each circle is chosen per connection
// below; what each circle sees is chosen in the Vault.

// Where a circle can go: 'outer', 'inner', another circle's id, or 'alone'
// (on its own outside the Outer Circle).
type Drag = { id: string; dx: number; dy: number; target: string | null; valid: boolean }

const MIN_DRAG = 6 // px before a press becomes a drag (a shorter press is a tap)
const MAX_WIDTH = 440
const MARGIN = 26 // empty space around the Outer Circle to drop circles "on their own"

// A slightly different, slow bob per circle, so they float out of step.
function bob(id: string): React.CSSProperties {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { animationDuration: `${5 + (h % 30) / 10}s`, animationDelay: `-${(h % 50) / 10}s` }
}

export default function CustomCircles({
  circles,
  allowed,
  innerAllowed,
  innerCount,
}: {
  circles: StudioCircle[]
  allowed: number
  innerAllowed: boolean
  innerCount: number
}) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const [list, setList] = useState(circles)
  // Fresh data from the server (after router.refresh) replaces the local copy.
  const [fromServer, setFromServer] = useState(circles)
  if (circles !== fromServer) {
    setFromServer(circles)
    setList(circles)
  }
  const [selected, setSelected] = useState<string | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [pulse, setPulse] = useState<string | null>(null)
  const [width, setWidth] = useState(0)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
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

  const maxWidth = Math.min(width || 340, MAX_WIDTH)
  // On a small screen the drawing is scaled down, so it is laid out again
  // (a few times, settling) with more room for names and bigger small circles.
  // When very small, circles with circles inside show only their name.
  const { nodes, bounds } = useMemo(() => {
    const unitsWide = (b: { minX: number; maxX: number }) => b.maxX - b.minX + MARGIN * 2
    let result = layoutCircles(list, { innerAllowed, innerCount })
    for (let i = 0; i < 3; i++) {
      const s = maxWidth / unitsWide(result.bounds)
      if (s >= 0.9) break
      const text = Math.max(0.8, Math.min(1, s))
      const label = Math.min(64, Math.max(24, ((s < 0.75 ? 16 : 28) * text + 10) / s))
      result = layoutCircles(list, { innerAllowed, innerCount, label, leafMin: Math.min(72, Math.max(36, 32 / s)) })
    }
    return result
  }, [list, innerAllowed, innerCount, maxWidth])
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const unitsW = bounds.maxX - bounds.minX + MARGIN * 2
  const unitsH = bounds.maxY - bounds.minY + MARGIN * 2
  const scale = Math.min(1, maxWidth / unitsW)
  const canvasW = unitsW * scale
  const canvasH = unitsH * scale
  const px = (x: number) => (x - bounds.minX + MARGIN) * scale
  const py = (y: number) => (y - bounds.minY + MARGIN) * scale
  const textScale = Math.max(0.85, Math.min(1, scale))
  const compact = scale < 0.75
  const moving = drag ? subtreeIds(nodes, drag.id) : null

  const placeOf = (id: string) => byId.get(id)?.parent ?? 'alone'
  // The circles around a circle (innermost first): what its people also see.
  const around = (id: string): LaidOut[] => {
    const chain: LaidOut[] = []
    for (let n = byId.get(byId.get(id)?.parent ?? ''); n; n = n.parent ? byId.get(n.parent) : undefined) chain.push(n)
    return chain
  }
  const nameOf = (id: string) => byId.get(id)?.name ?? ''
  const inPhrase = (id: string) => (id === 'outer' || id === 'inner' ? `the ${nameOf(id)}` : nameOf(id))
  const whereText = (id: string) => (placeOf(id) === 'alone' ? 'on its own, outside the Outer Circle' : `in ${inPhrase(placeOf(id))}`)
  const listText = (names: string[]) => names.join(', ').replace(/, ([^,]*)$/, ' and $1')

  const toLayout = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    return { x: (clientX - rect.left) / scale + bounds.minX - MARGIN, y: (clientY - rect.top) / scale + bounds.minY - MARGIN, inside }
  }

  const api = async (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, string>) => {
    const res = await fetch('/api/circles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
    return data
  }

  const move = async (id: string, target: string) => {
    const before = list
    setError('')
    setList(prev => prev.map(c => c.id === id
      ? { ...c, parent_id: ['outer', 'inner', 'alone'].includes(target) ? null : target, in_inner: target === 'inner', isolated: target === 'alone' }
      : c))
    play('drop')
    setPulse(target)
    setTimeout(() => setPulse(p => (p === target ? null : p)), 600)
    try {
      await api('PATCH', { id, parent: target })
      router.refresh()
    } catch (err) {
      setList(before)
      play('back')
      setError((err as Error).message)
    }
  }

  // Pointer: a short press selects, a longer move drags (mouse, pen and touch).
  const onPointerDown = (e: React.PointerEvent, node: LaidOut) => {
    if (node.kind !== 'custom' || e.button > 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    press.current = { id: node.id, x: e.clientX, y: e.clientY, dragging: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const p = press.current
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    if (!p.dragging && Math.hypot(dx, dy) < MIN_DRAG) return
    if (!p.dragging) { p.dragging = true; play('lift'); setSelected(null); setConfirmDelete(false); setEditing(null) }
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
    if (!p.dragging || !drag) {
      if (p.dragging) return
      setSelected(s => (s === p.id ? null : p.id))
      setConfirmDelete(false)
      setEditing(null)
      return
    }
    const d = drag
    setDrag(null)
    if (d.valid && d.target && d.target !== placeOf(d.id)) void move(d.id, d.target)
    else play('back')
  }
  const onPointerCancel = () => { press.current = null; setDrag(null) }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      const { circle } = await api('POST', { name })
      setList(prev => [...prev, { ...circle, memberCount: 0 }])
      setName('')
      setSelected(circle.id)
      play('drop')
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const rename = async (id: string, value: string) => {
    setBusy(true)
    setError('')
    try {
      const { circle } = await api('PATCH', { id, name: value })
      setList(prev => prev.map(c => (c.id === id ? { ...c, name: circle.name } : c)))
      setEditing(null)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      await api('DELETE', { id })
      // Circles inside it move up one level, as on the server.
      setList(prev => {
        const gone = prev.find(c => c.id === id)
        const top = !gone?.parent_id
        return prev
          .filter(c => c.id !== id)
          .map(c => (c.parent_id === id
            ? { ...c, parent_id: gone?.parent_id ?? null, in_inner: top && !!gone?.in_inner, isolated: top && !!gone?.isolated }
            : c))
      })
      setSelected(null)
      setConfirmDelete(false)
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const sel = selected ? byId.get(selected) : undefined
  const selAlone = sel?.kind === 'custom' && around(sel.id).every(n => n.kind === 'custom')
  const targets: { id: string; name: string }[] = sel?.kind === 'custom'
    ? [
        ...nodes.filter(n => n.id !== placeOf(sel.id) && canMoveInto(nodes, sel.id, n.id)).map(n => ({ id: n.id, name: n.name })),
        ...(placeOf(sel.id) !== 'alone' ? [{ id: 'alone', name: 'On Its Own' }] : []),
      ]
    : []
  const dragHint = drag
    ? drag.valid && drag.target && drag.target !== placeOf(drag.id)
      ? drag.target === 'alone'
        ? `Let go to keep ${nameOf(drag.id)} on its own, outside the Outer Circle`
        : `Let go to put ${nameOf(drag.id)} in ${inPhrase(drag.target)}`
      : drag.target && !drag.valid
        ? 'Circles can be nested at most 4 deep.'
        : `Drag ${nameOf(drag.id)} into another circle, or outside the Outer Circle`
    : null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-soft space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-semibold text-text-primary text-lg">Your Circles</h2>
        <span className="text-xs text-text-secondary tabular-nums">{list.length} of {allowed} own circles</span>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">
        Circles sit inside each other: everyone in a circle also sees what the circles around it see, so you never write the
        same thing twice. Drag a circle into another one, or outside the Outer Circle to keep it on its own. Tap a circle for details.
      </p>

      <div ref={wrapRef}>
        <p className="h-4 text-center text-xs text-text-secondary" aria-live="polite">{dragHint ?? ''}</p>
        <div
          ref={canvasRef}
          className={`relative mx-auto mt-2 select-none rounded-3xl border border-dashed transition-colors [-webkit-touch-callout:none] ${
            drag?.target === 'alone' && drag.valid && placeOf(drag.id) !== 'alone' ? 'border-accent/40 bg-accent-tint/40' : 'border-transparent'
          }`}
          style={{ width: canvasW, height: canvasH }}
        >
          {nodes.map(n => {
            const isMoving = !!moving?.has(n.id)
            const isDragged = drag?.id === n.id
            const isTarget = !!drag && drag.valid && drag.target === n.id && n.id !== placeOf(drag.id)
            const offX = isMoving ? drag!.dx : 0
            const offY = isMoving ? drag!.dy : 0
            const d = n.r * 2 * scale
            const atTop = n.hasChildren || n.kind === 'outer'
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
                  scale: isTarget || pulse === n.id ? 1.06 : isDragged ? 1.04 : 1,
                }}
                transition={reduceMotion
                  ? { duration: 0 }
                  : isMoving
                    ? { type: 'spring', stiffness: 650, damping: 40, mass: 0.7 }
                    : { type: 'spring', stiffness: 230, damping: 21, mass: 0.9 }}
                whileHover={!drag && n.kind === 'custom' ? { scale: 1.025 } : undefined}
                className={`absolute left-0 top-0 rounded-full outline-none ${
                  n.kind === 'custom' ? (isDragged ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
                }`}
                style={{ zIndex: (isMoving ? 40 : 0) + n.depth + (n.kind === 'custom' && n.parent === null ? 1 : 0), touchAction: n.kind === 'custom' ? 'none' : 'auto' }}
                role="button"
                tabIndex={0}
                aria-label={n.kind === 'custom' ? `${n.name}, ${whereText(n.id)}. Press to choose where it goes.` : n.name}
                aria-pressed={selected === n.id}
                onPointerDown={e => onPointerDown(e, n)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerCancel}
                onLostPointerCapture={() => { if (press.current) onPointerCancel() }}
                onClick={() => { if (n.kind !== 'custom') { setSelected(s => (s === n.id ? null : n.id)); setConfirmDelete(false); setEditing(null) } }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(s => (s === n.id ? null : n.id)) }
                  if (e.key === 'Escape') setSelected(null)
                }}
              >
                {/* The visible circle floats gently on its own (CSS, see tailwind "bob"). */}
                <span
                  className={`absolute inset-0 rounded-full border transition-[box-shadow,border-color,background-color] ${tone} ${
                    isMoving || reduceMotion ? '' : 'animate-bob'
                  } ${isTarget ? '!border-accent/70 ring-4 ring-accent/10' : ''} ${selected === n.id ? 'ring-2 ring-accent/70' : ''} ${
                    isDragged ? 'shadow-card' : n.kind === 'custom' ? 'shadow-[0_1px_2px_rgba(43,30,22,0.06)]' : ''
                  }`}
                  style={bob(n.id)}
                >
                  <span
                    className={`absolute inset-x-0 flex flex-col items-center leading-tight pointer-events-none ${atTop ? 'top-0 pt-1.5 px-2' : 'inset-y-0 justify-center px-1'}`}
                    style={{ fontSize: 12 * textScale }}
                  >
                    <span className={`max-w-full truncate font-medium ${n.kind === 'custom' ? 'text-text-primary' : 'text-text-secondary'}`}>{n.name}</span>
                    {!(compact && atTop) && (
                      <span className="text-text-muted whitespace-nowrap" style={{ fontSize: 10 * textScale }}>
                        {n.kind === 'outer' ? 'everyone' : `${n.count} ${n.count === 1 ? 'person' : 'people'}`}
                      </span>
                    )}
                  </span>
                </span>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Details of the tapped circle: where it is, who sees what, Move to */}
      <div className="min-h-[2.5rem]" aria-live="polite">
        {!sel && (
          <p className="text-sm text-text-muted text-center">Tap a circle to see who sees what.</p>
        )}
        {sel?.kind === 'outer' && (
          <p className="text-sm text-text-secondary leading-relaxed">
            <b className="text-text-primary">Outer Circle.</b> Everyone who can see your profile. Circles inside it also see what you
            put here; circles on their own outside it don&apos;t.
          </p>
        )}
        {sel?.kind === 'inner' && (
          <p className="text-sm text-text-secondary leading-relaxed">
            <b className="text-text-primary">Inner Circle.</b> {sel.count} {sel.count === 1 ? 'person' : 'people'} you chose below.
            They also see the Outer Circle. People in a circle placed inside it see the Inner Circle too.
          </p>
        )}
        {sel?.kind === 'custom' && (
          <div className="space-y-3">
            {editing === sel.id ? (
              <form
                className="flex gap-2"
                onSubmit={e => {
                  e.preventDefault()
                  const value = new FormData(e.currentTarget).get('name')
                  if (typeof value === 'string' && value.trim()) void rename(sel.id, value)
                }}
              >
                <input
                  name="name"
                  defaultValue={sel.name}
                  maxLength={40}
                  autoFocus
                  aria-label="Circle name"
                  className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
                <button type="submit" disabled={busy} className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg disabled:opacity-50">Save</button>
                <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-text-secondary">Cancel</button>
              </form>
            ) : (
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-sm text-text-secondary leading-relaxed">
                  <b className="text-text-primary">{sel.name}</b> is {whereText(sel.id)}. Its {sel.count}{' '}
                  {sel.count === 1 ? 'person sees' : 'people see'} {listText([sel.name, ...around(sel.id).map(n => n.name)])}
                  {selAlone ? ' (and your Outer Circle too if your profile is Public).' : '.'}
                </p>
                <span className="flex gap-3 text-sm">
                  <button type="button" onClick={() => setEditing(sel.id)} className="text-accent hover:underline">Rename</button>
                  <button type="button" onClick={() => setConfirmDelete(true)} className="text-red-700 hover:underline">Delete</button>
                </span>
              </div>
            )}
            {confirmDelete && (
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-text-secondary">Delete {sel.name}? Its Vault sections become drafts and circles inside it move up one level.</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(sel.id)}
                  className="px-3 py-1 text-red-700 border border-red-300 rounded-lg hover:bg-red-600 hover:text-white disabled:opacity-50"
                >
                  Yes, Delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-text-secondary">Cancel</button>
              </p>
            )}
            {targets.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-text-muted mr-1">Move to</span>
                {targets.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void move(sel.id, t.id)}
                    className="h-7 px-3 rounded-full border border-border text-xs font-medium text-text-secondary hover:border-accent hover:text-accent"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {list.length < allowed ? (
        <form onSubmit={create} className="flex gap-2">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={40}
            placeholder="New circle, e.g. Family"
            aria-label="New circle name"
            className="flex-1 min-w-0 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            Add
          </button>
        </form>
      ) : (
        <p className="text-xs text-text-secondary">
          You have all {allowed} circles your plan allows. You can allow more in{' '}
          <Link href="/settings#subscription" className="text-accent hover:underline">Settings</Link>.
        </p>
      )}
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </div>
  )
}
