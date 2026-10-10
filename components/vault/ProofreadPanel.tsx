'use client'

import { useEffect, useRef, useState } from 'react'

// Vault → Proofread (owner design 2026-10-10): after a pause in typing, the
// text is checked for grammar, spelling, punctuation and capitalisation only
// (/api/vault/proofread, paid per use). Corrections show in a lighter colour
// (removed bits struck through); Accept puts the corrected text in the editor,
// Reject keeps it as it is.

type Part = { text: string; kind: 'same' | 'add' | 'remove' }

// Word-level differences between two texts (longest common subsequence).
function diff(a: string, b: string): Part[] | null {
  const split = (s: string) => s.match(/\s+|[\p{L}\p{N}'’-]+|[^\s\p{L}\p{N}]/gu) ?? []
  const x = split(a)
  const y = split(b)
  if (x.length * y.length > 4_000_000) return null
  const dp: Uint16Array[] = Array.from({ length: x.length + 1 }, () => new Uint16Array(y.length + 1))
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const parts: Part[] = []
  const push = (text: string, kind: Part['kind']) => {
    const last = parts[parts.length - 1]
    if (last && last.kind === kind) last.text += text
    else parts.push({ text, kind })
  }
  let i = 0
  let j = 0
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { push(x[i], 'same'); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push(x[i], 'remove'); i++ }
    else { push(y[j], 'add'); j++ }
  }
  while (i < x.length) push(x[i++], 'remove')
  while (j < y.length) push(y[j++], 'add')
  return parts
}

const PAUSE_MS = 2500

export default function ProofreadPanel({ text, active, onAccept }: { text: string; active: boolean; onAccept: (corrected: string) => void }) {
  const [state, setState] = useState<
    | { kind: 'idle' }
    | { kind: 'checking' }
    | { kind: 'done'; for: string; corrected: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })
  const dismissed = useRef<string | null>(null)

  useEffect(() => {
    if (!active || text.trim().length < 20 || text === dismissed.current) return
    if (state.kind === 'done' && state.for === text) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState({ kind: 'checking' })
      try {
        const res = await fetch('/api/vault/proofread', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) { setState({ kind: 'error', message: data.error ?? 'Proofread is not available right now.' }); return }
        setState({ kind: 'done', for: text, corrected: typeof data.corrected === 'string' ? data.corrected : text })
        window.dispatchEvent(new Event('liaison:usage-changed'))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setState({ kind: 'error', message: 'Proofread is not available right now.' })
      }
    }, PAUSE_MS)
    return () => { clearTimeout(timer); controller.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active])

  if (!active) return null
  const current = state.kind === 'done' && state.for === text ? state : null
  const parts = current && current.corrected !== text ? diff(text, current.corrected) : null

  return (
    <aside className="rounded-2xl border border-border bg-surface/70 p-4 space-y-3 text-sm" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-semibold text-text-primary">Proofread<span aria-hidden="true">*</span></h4>
        {state.kind === 'checking' && <span className="text-xs text-text-muted">Checking…</span>}
      </div>
      {state.kind === 'idle' && <p className="text-xs text-text-muted">Pause typing and your text is checked for spelling, grammar and punctuation. Its meaning is never changed.</p>}
      {state.kind === 'error' && <p className="text-xs text-error">{state.message}</p>}
      {current && current.corrected === text && <p className="text-xs text-success">No corrections needed ✓</p>}
      {current && current.corrected !== text && (
        <>
          <div className="max-h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed text-text-primary">
            {parts
              ? parts.map((p, i) => (
                  p.kind === 'same' ? <span key={i}>{p.text}</span>
                    : p.kind === 'add' ? <span key={i} className="text-accent/70 bg-accent/10 rounded-sm">{p.text}</span>
                      : <span key={i} className="text-text-muted line-through decoration-text-muted/60">{p.text}</span>
                ))
              : <span className="text-accent/80">{current.corrected}</span>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { dismissed.current = current.corrected; onAccept(current.corrected); setState({ kind: 'idle' }) }}
              className="px-4 py-1.5 rounded-full bg-accent hover:bg-accent-light text-white text-xs font-medium"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => { dismissed.current = text; setState({ kind: 'idle' }) }}
              className="px-4 py-1.5 rounded-full border border-border text-text-secondary hover:text-text-primary text-xs font-medium"
            >
              Reject
            </button>
          </div>
        </>
      )}
    </aside>
  )
}
