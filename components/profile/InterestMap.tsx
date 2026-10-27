'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'

// "What matters to {name}" at the bottom of the profile card (owner decision
// 2026-10-27; /api/interests/[username]). Floating bubbles sized by how much
// each topic matters to them (relative to their own biggest topic). Tapping a
// bubble puts a question into the chat box (not sent). Signed-out visitors
// get a greyed box and no topics at all.

type Topic = { label: string; score: number }
type Placed = Topic & { x: number; y: number; r: number }

const H = 210

function drift(id: string): React.CSSProperties {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return { animationDuration: `${6.5 + (h % 30) / 10}s`, animationDelay: `-${(h % 70) / 10}s` }
}

// Biggest in the middle, the rest spiralling out, pushed apart so none overlap.
function place(topics: Topic[], W: number): Placed[] {
  const max = Math.max(1, ...topics.map(t => t.score))
  const sorted = [...topics].sort((a, b) => b.score - a.score)
  const out: Placed[] = sorted.map((t, i) => {
    const longest = Math.max(...t.label.split(' ').map(w => w.length), Math.min(t.label.length, 12))
    const r = Math.max(14 + 34 * Math.sqrt(t.score / max), longest * 3.4 + 8)
    const a = i * 2.399963
    const d = 8 + 16 * Math.sqrt(i)
    return { ...t, r, x: W / 2 + Math.cos(a) * d * 1.6, y: H / 2 + Math.sin(a) * d }
  })
  for (let step = 0; step < 300; step++) {
    for (const b of out) {
      b.x += (W / 2 - b.x) * 0.02
      b.y += (H / 2 - b.y) * 0.03
    }
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.hypot(dx, dy) || 0.01
        const overlap = a.r + b.r + 4 - dist
        if (overlap > 0) {
          a.x -= (dx / dist) * overlap / 2
          a.y -= (dy / dist) * overlap / 2
          b.x += (dx / dist) * overlap / 2
          b.y += (dy / dist) * overlap / 2
        }
      }
    }
    for (const b of out) {
      b.x = Math.min(W - b.r - 2, Math.max(b.r + 2, b.x))
      b.y = Math.min(H - b.r - 2, Math.max(b.r + 2, b.y))
    }
  }
  return out
}

export default function InterestMap({ username, firstName, signedIn }: { username: string; firstName: string; signedIn: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const reduceMotion = useReducedMotion()
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'none' } | { kind: 'empty' } | { kind: 'map'; topics: Topic[] } | { kind: 'error'; text: string }>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => setWidth(Math.round(entries[0]?.contentRect.width ?? 0)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    fetch(`/api/interests/${encodeURIComponent(username)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { topics: Topic[] | null; empty: boolean } | null) => {
        if (cancelled) return
        if (!d) setState({ kind: 'none' })
        else if (d.empty || (d.topics && d.topics.length === 0)) setState({ kind: 'empty' })
        else if (d.topics) setState({ kind: 'map', topics: d.topics })
        else setState({ kind: 'none' })
      })
      .catch(() => { if (!cancelled) setState({ kind: 'none' }) })
    return () => { cancelled = true }
  }, [signedIn, username])

  const create = async () => {
    setBusy(true)
    try {
      const res = await fetch(`/api/interests/${encodeURIComponent(username)}`, { method: 'POST' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setState({ kind: 'error', text: d.error ?? 'This is not available right now. Please try again.' }); return }
      setState(d.topics?.length ? { kind: 'map', topics: d.topics } : { kind: 'empty' })
      window.dispatchEvent(new Event('liaison:usage-changed'))
    } finally {
      setBusy(false)
    }
  }

  const placed = useMemo(() => (state.kind === 'map' && width > 0 ? place(state.topics, width) : []), [state, width])

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
    <div className="text-left">
      <p className="text-xs text-text-secondary font-semibold uppercase tracking-wide mb-2 text-center">What Matters to {firstName}</p>
      <div ref={wrapRef} className="relative w-full" style={{ height: state.kind === 'map' ? H : undefined }}>
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
                title={`Ask about ${t.label}`}
                className={`absolute inset-0 rounded-full border text-[11px] font-medium leading-tight px-1 flex items-center justify-center text-center transition-transform duration-300 hover:scale-110 shadow-[0_2px_8px_rgba(43,30,22,0.1)] ${tone}`}
              >
                {t.label}
              </button>
            </span>
          </span>
          )
        })}
        {state.kind === 'none' && (
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy}
            className="w-full rounded-xl border border-accent/30 bg-accent-tint px-4 py-3 text-sm font-medium text-accent hover:bg-accent-subtle disabled:opacity-60"
          >
            {busy ? 'Working it out…' : `Show What Matters to ${firstName}*`}
          </button>
        )}
        {state.kind === 'empty' && <p className="text-sm text-text-muted text-center">Nothing shared with you yet.</p>}
        {state.kind === 'error' && <p className="text-sm text-error text-center" role="alert">{state.text}</p>}
        {state.kind === 'loading' && <div className="h-10" aria-hidden="true" />}
      </div>
      {state.kind === 'map' && <p className="mt-1 text-[11px] text-text-muted text-center">Tap a topic to ask about it.</p>}
    </div>
  )
}
