'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { openContextMenu } from '@/components/ui/ContextMenu'

// "What Matters to {name}" under the profile and chat on a LiAIson page (owner
// decisions 2026-10-27; /api/interests/[username]). Floating bubbles without a
// box, sized by how much each topic matters to them (relative to their own
// biggest topic), never overlapping. Opens by itself when the page opens: a
// kept map is free, otherwise it is made at once and paid by the viewer like a
// message. Can be folded away (remembered on this device); while folded,
// nothing is loaded or made. Ambivert and up only. Tapping a bubble puts a
// question into the chat box (not sent). Signed-out visitors get a greyed box
// and no topics at all.

type Topic = { label: string; score: number }
type Placed = Topic & { x: number; y: number; r: number }
type State =
  | { kind: 'loading' }
  | { kind: 'working' }
  | { kind: 'locked' }
  | { kind: 'empty' }
  | { kind: 'map'; topics: Topic[] }
  | { kind: 'error'; text: string }

const OPEN_KEY = 'liaison:interest-map-open'

function drift(id: string): React.CSSProperties {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { animationDuration: `${6.5 + (h % 30) / 10}s`, animationDelay: `-${(h % 70) / 10}s` }
}

// Biggest in the middle, the rest spiralling out and pushed apart. If they
// can't all fit, every bubble shrinks a little (same proportions) and it tries
// again, so none overlap.
function place(topics: Topic[], W: number, H: number): Placed[] {
  const max = Math.max(1, ...topics.map(t => t.score))
  const sorted = [...topics].sort((a, b) => b.score - a.score)
  const attempt = (scale: number): { out: Placed[]; worst: number } => {
    const out: Placed[] = sorted.map((t, i) => {
      // Size follows the score only (equal scores = equal bubbles); long
      // names get smaller text instead.
      const r = (18 + 38 * Math.sqrt(t.score / max)) * scale
      const a = i * 2.399963
      const d = 10 + 22 * Math.sqrt(i)
      return { ...t, r, x: W / 2 + Math.cos(a) * d * 1.8, y: H / 2 + Math.sin(a) * d }
    })
    for (let step = 0; step < 320; step++) {
      for (const b of out) {
        b.x += (W / 2 - b.x) * 0.015
        b.y += (H / 2 - b.y) * 0.03
      }
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          const a = out[i]
          const b = out[j]
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.hypot(dx, dy) || 0.01
          const overlap = a.r + b.r + 6 - dist
          if (overlap > 0) {
            a.x -= (dx / dist) * overlap / 2
            a.y -= (dy / dist) * overlap / 2
            b.x += (dx / dist) * overlap / 2
            b.y += (dy / dist) * overlap / 2
          }
        }
      }
      for (const b of out) {
        b.x = Math.min(W - b.r - 4, Math.max(b.r + 4, b.x))
        b.y = Math.min(H - b.r - 6, Math.max(b.r + 6, b.y))
      }
    }
    let worst = 0
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        worst = Math.max(worst, out[i].r + out[j].r + 2 - Math.hypot(out[j].x - out[i].x, out[j].y - out[i].y))
      }
    }
    return { out, worst }
  }
  let scale = 1
  let best = attempt(scale)
  for (let tries = 0; tries < 8 && best.worst > 0; tries++) {
    scale *= 0.88
    best = attempt(scale)
  }
  return best.out
}

export default function InterestMap({ username, firstName, signedIn }: { username: string; firstName: string; signedIn: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(true)
  const [state, setState] = useState<State>({ kind: 'loading' })

  // The folded/open choice is remembered on this device.
  useEffect(() => {
    let saved: string | null = null
    try { saved = localStorage.getItem(OPEN_KEY) } catch { /* private mode */ }
    if (saved === '0') {
      const t = setTimeout(() => setOpen(false), 0)
      return () => clearTimeout(t)
    }
  }, [])

  const toggle = () => {
    setOpen(o => {
      try { localStorage.setItem(OPEN_KEY, o ? '0' : '1') } catch { /* private mode */ }
      return !o
    })
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [open])

  // Loads by itself while open: a kept map, or a new one made right away.
  const loaded = state.kind === 'map' || state.kind === 'locked' || state.kind === 'empty'
  useEffect(() => {
    if (!signedIn || !open || loaded) return
    let cancelled = false
    const url = `/api/interests/${encodeURIComponent(username)}`
    const run = async () => {
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null)
      if (cancelled) return
      if (res?.status === 403) {
        const d = await res.json().catch(() => ({}))
        setState(d.locked ? { kind: 'locked' } : { kind: 'empty' })
        return
      }
      const d = res?.ok ? ((await res.json().catch(() => null)) as { topics: Topic[] | null; empty: boolean } | null) : null
      if (cancelled) return
      if (!d) { setState({ kind: 'error', text: 'This is not available right now.' }); return }
      if (d.empty || (d.topics && d.topics.length === 0)) { setState({ kind: 'empty' }); return }
      if (d.topics) { setState({ kind: 'map', topics: d.topics }); return }
      setState({ kind: 'working' })
      const made = await fetch(url, { method: 'POST' }).catch(() => null)
      const body = made ? await made.json().catch(() => ({})) : {}
      if (cancelled) return
      if (!made?.ok) { setState({ kind: 'error', text: body.error ?? 'This is not available right now.' }); return }
      setState(body.topics?.length ? { kind: 'map', topics: body.topics } : { kind: 'empty' })
      window.dispatchEvent(new Event('liaison:usage-changed'))
    }
    void run()
    return () => { cancelled = true }
  }, [signedIn, open, loaded, username])

  const H = Math.round(Math.min(320, Math.max(220, width * 0.26)))
  const placed = useMemo(() => (state.kind === 'map' && width > 0 ? place(state.topics, width, H) : []), [state, width, H])

  const ask = (topic: string) => {
    window.dispatchEvent(new CustomEvent('liaison:prefill-chat', { detail: `Tell me more about ${firstName}'s interest in ${topic}.` }))
  }

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-6 text-center text-sm text-text-muted">
        <Link href="/signup" className="hover:text-text-secondary">Sign up to see what matters to {firstName}.</Link>
      </div>
    )
  }

  return (
    <section aria-label={`What Matters to ${firstName}`}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mx-auto flex items-center gap-3 rounded-full px-4 py-1.5 text-sm font-semibold text-text-secondary hover:text-text-primary"
      >
        What Matters to {firstName}
        <span className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-base leading-none" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div ref={wrapRef} className="relative mt-2 w-full" style={{ height: state.kind === 'map' ? H : undefined }}>
          {state.kind === 'map' && placed.map(t => {
            // Darker for what matters most to them (relative to their own topics).
            const share = t.score / Math.max(1, ...state.topics.map(x => x.score))
            const tone = share > 0.8 ? 'bg-accent text-white border-accent' : share > 0.5 ? 'bg-[#8C6A52] text-white border-[#8C6A52]' : 'bg-accent-tint text-text-primary border-accent/20'
            return (
              <span key={t.label} className="absolute" style={{ left: t.x - t.r, top: t.y - t.r, width: t.r * 2, height: t.r * 2 }}>
                <span className={`absolute inset-0 ${reduceMotion ? '' : 'animate-bob'}`} style={drift(t.label)}>
                  <button
                    type="button"
                    onClick={() => ask(t.label)}
                    onContextMenu={e => openContextMenu(e, [{ heading: t.label }, { label: 'Ask About This', onSelect: () => ask(t.label) }])}
                    title={`Ask about ${t.label}`}
                    className={`absolute inset-0 rounded-full border font-medium leading-tight px-1 flex items-center justify-center text-center transition-transform duration-300 hover:scale-110 shadow-[0_2px_8px_rgba(43,30,22,0.1)] ${tone}`}
                    style={{ fontSize: Math.max(8, Math.min(12, (t.r * 2 - 8) / (Math.max(...t.label.split(' ').map(w => w.length)) * 0.62))) }}
                  >
                    {t.label}
                  </button>
                </span>
              </span>
            )
          })}
          {(state.kind === 'loading' || state.kind === 'working') && (
            <p className="py-6 text-center text-sm text-text-muted animate-pulse">{state.kind === 'working' ? `Finding what matters to ${firstName}…` : ''}</p>
          )}
          {state.kind === 'locked' && (
            <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-5 text-center text-sm text-text-muted">
              <Link href="/settings#subscription" className="hover:text-text-secondary">See what matters to {firstName} from Ambivert up.</Link>
            </div>
          )}
          {state.kind === 'empty' && <p className="py-4 text-sm text-text-muted text-center">Nothing shared with you yet.</p>}
          {state.kind === 'error' && <p className="py-4 text-sm text-error text-center" role="alert">{state.text}</p>}
        </div>
      )}
      {open && state.kind === 'map' && <p className="mt-1 text-[11px] text-text-muted text-center">Tap a topic to ask about it.</p>}
    </section>
  )
}
