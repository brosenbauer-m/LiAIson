'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import { canMoveInto, circleAt, layoutCircles, subtreeIds, type LaidOut, type StudioCircle } from '@/components/circles/layout'
import { play, setSoundsOn, soundsOn } from '@/components/circles/sound'

// Social Butterfly: the Circle Studio. The owner's circles drawn inside each
// other (Outer > Inner > own circles); drag a circle into another one, or tap
// it and choose "Move to". Everyone in a circle also sees every circle around
// it (lib/circles.ts). Who is in each circle is chosen per connection below;
// what each circle sees is chosen in the Vault.

type Drag = { id: string; dx: number; dy: number; target: string | null; valid: boolean }

const MIN_DRAG = 6 // px before a press becomes a drag (a shorter press is a tap)

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
  const [sound, setSound] = useState(true)
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
    const t = setTimeout(() => setSound(soundsOn()), 0)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [])

  const size = Math.min(width || 360, 620)
  // On a small screen the drawing is scaled down, so it is laid out again
  // (a few times, settling) with more room for names and bigger small circles.
  // When very small, circles with circles inside show only their name.
  const { nodes, radius } = useMemo(() => {
    let result = layoutCircles(list, { innerAllowed, innerCount })
    for (let i = 0; i < 3; i++) {
      const s = size / (result.radius * 2 + 8)
      if (s >= 0.9) break
      const text = Math.max(0.8, Math.min(1, s))
      const label = Math.min(64, Math.max(24, ((s < 0.75 ? 17 : 30) * text + 10) / s))
      result = layoutCircles(list, { innerAllowed, innerCount, label, leafMin: Math.min(72, Math.max(38, 34 / s)) })
    }
    return result
  }, [list, innerAllowed, innerCount, size])
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes])
  const scale = size / (radius * 2 + 8)
  const textScale = Math.max(0.8, Math.min(1, scale))
  const compact = scale < 0.75
  const moving = drag ? subtreeIds(nodes, drag.id) : null

  // The circles around a circle (innermost first): what its people also see.
  const around = (id: string): LaidOut[] => {
    const chain: LaidOut[] = []
    for (let n = byId.get(byId.get(id)?.parent ?? ''); n; n = n.parent ? byId.get(n.parent) : undefined) chain.push(n)
    return chain
  }
  const nameOf = (id: string) => byId.get(id)?.name ?? ''
  const inPhrase = (id: string) => (id === 'outer' || id === 'inner' ? `the ${nameOf(id)}` : nameOf(id))

  const toLayout = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left - size / 2) / scale, y: (clientY - rect.top - size / 2) / scale }
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
      ? { ...c, parent_id: target === 'outer' || target === 'inner' ? null : target, in_inner: target === 'inner' }
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
    const target = circleAt(nodes, point.x, point.y, subtreeIds(nodes, p.id))
    const valid = !!target && canMoveInto(nodes, p.id, target.id)
    setDrag({ id: p.id, dx: dx / scale, dy: dy / scale, target: target?.id ?? null, valid })
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
    if (d.valid && d.target && d.target !== byId.get(d.id)?.parent) void move(d.id, d.target)
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
        return prev
          .filter(c => c.id !== id)
          .map(c => (c.parent_id === id ? { ...c, parent_id: gone?.parent_id ?? null, in_inner: gone?.parent_id ? false : !!gone?.in_inner } : c))
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
  const selCircle = sel?.kind === 'custom' ? list.find(c => c.id === sel.id) : undefined
  const targets = sel?.kind === 'custom'
    ? nodes.filter(n => n.id !== sel.parent && canMoveInto(nodes, sel.id, n.id))
    : []
  const dragHint = drag
    ? drag.valid && drag.target && drag.target !== byId.get(drag.id)?.parent
      ? `Let go to put ${nameOf(drag.id)} in ${inPhrase(drag.target)}`
      : drag.target && !drag.valid
        ? 'Circles can be nested at most 4 deep.'
        : `Drag ${nameOf(drag.id)} into another circle`
    : null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-soft space-y-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-semibold text-text-primary text-lg">Your circles</h2>
        <span className="text-xs text-text-secondary tabular-nums">{list.length} of {allowed} own circles</span>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">
        Circles sit inside each other, and everyone in a circle also sees what the circles around it see, so you never
        write the same thing twice. Drag a circle into another one, or tap it.
      </p>

      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => { const next = !sound; setSound(next); setSoundsOn(next); if (next) play('drop') }}
          aria-label={sound ? 'Turn sounds off' : 'Turn sounds on'}
          aria-pressed={sound}
          className="absolute right-0 top-0 z-[60] w-9 h-9 rounded-full border border-border bg-surface/90 backdrop-blur text-text-secondary hover:text-accent flex items-center justify-center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H3v6h3l5 4V5z" />
            {sound ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <path d="m16 9 5 6m0-6-5 6" />}
          </svg>
        </button>
        <p className="h-5 text-center text-xs text-text-secondary" aria-live="polite">{dragHint ?? ''}</p>
        <div
          ref={canvasRef}
          className="relative mx-auto mt-2 select-none [-webkit-touch-callout:none]"
          style={{ width: size, height: size }}
        >
          {nodes.map(n => {
            const isMoving = !!moving?.has(n.id)
            const isDragged = drag?.id === n.id
            const isTarget = !!drag && drag.valid && drag.target === n.id && n.id !== byId.get(drag.id)?.parent
            const offX = isMoving ? drag!.dx : 0
            const offY = isMoving ? drag!.dy : 0
            const d = n.r * 2 * scale
            const tone = n.kind === 'outer'
              ? 'bg-accent-tint/70 border-border'
              : n.kind === 'inner'
                ? 'bg-accent-subtle/80 border-accent/20'
                : n.depth % 2 ? 'bg-card border-accent/30' : 'bg-accent-tint border-accent/30'
            const atTop = n.hasChildren || n.kind === 'outer'
            const label = (
              <span
                className={`absolute inset-x-0 flex flex-col items-center leading-tight pointer-events-none ${atTop ? 'top-0 pt-2 px-2' : 'inset-y-0 justify-center px-1'}`}
                style={{ fontSize: 13 * textScale }}
              >
                <span className={`max-w-full truncate font-medium ${n.kind === 'custom' ? 'text-text-primary' : 'text-text-secondary'}`}>{n.name}</span>
                {!(compact && atTop) && (
                  <span className="text-text-muted whitespace-nowrap" style={{ fontSize: 11 * textScale }}>
                    {n.kind === 'outer' ? 'everyone' : `${n.count} ${n.count === 1 ? 'person' : 'people'}`}
                  </span>
                )}
              </span>
            )
            return (
              <motion.div
                key={n.id}
                initial={false}
                animate={{
                  x: size / 2 + (n.x + offX) * scale - d / 2,
                  y: size / 2 + (n.y + offY) * scale - d / 2,
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
                className={`absolute left-0 top-0 rounded-full border transition-[box-shadow,border-color,background-color] ${tone} ${
                  isTarget ? '!border-accent ring-4 ring-accent/15' : ''
                } ${selected === n.id ? 'ring-2 ring-accent' : ''} ${
                  isDragged ? 'shadow-card cursor-grabbing' : n.kind === 'custom' ? 'cursor-grab shadow-soft' : 'cursor-pointer'
                } ${drag && !isMoving && !isTarget && n.kind === 'custom' ? 'opacity-90' : ''} focus-visible:ring-2 focus-visible:ring-accent outline-none`}
                style={{ zIndex: (isMoving ? 40 : 0) + n.depth, touchAction: n.kind === 'custom' ? 'none' : 'auto' }}
                role="button"
                tabIndex={0}
                aria-label={n.kind === 'custom' ? `${n.name}, in ${inPhrase(n.parent ?? 'outer')}. Press to choose where it goes.` : n.name}
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
                {label}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Details of the tapped circle: where it is, who sees what, Move to */}
      <div className="min-h-[3rem]" aria-live="polite">
        {!sel && (
          <p className="text-sm text-text-muted text-center">Tap a circle to see who sees what.</p>
        )}
        {sel?.kind === 'outer' && (
          <p className="text-sm text-text-secondary leading-relaxed">
            <b className="text-text-primary">Outer Circle.</b> Everyone who can see your profile. Every other circle is inside it,
            so everyone sees what you put here.
          </p>
        )}
        {sel?.kind === 'inner' && (
          <p className="text-sm text-text-secondary leading-relaxed">
            <b className="text-text-primary">Inner Circle.</b> {sel.count} {sel.count === 1 ? 'person' : 'people'} you chose below.
            They also see the Outer Circle. People in a circle placed inside it see the Inner Circle too.
          </p>
        )}
        {sel?.kind === 'custom' && selCircle && (
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
                  <b className="text-text-primary">{sel.name}</b> is in {inPhrase(sel.parent ?? 'outer')}. Its {sel.count}{' '}
                  {sel.count === 1 ? 'person sees' : 'people see'} {[sel.name, ...around(sel.id).map(n => n.name)].join(', ').replace(/, ([^,]*)$/, ' and $1')}.
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
                  Yes, delete
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-text-secondary">Cancel</button>
              </p>
            )}
            {targets.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted">Move to</span>
                {targets.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => void move(sel.id, t.id)}
                    className="px-3 py-1.5 rounded-full border border-border text-sm text-text-primary hover:border-accent hover:text-accent"
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
