'use client'

import { useEffect, useState } from 'react'
import { prime, play, stop, onPlayingChange, currentlyPlaying } from '@/lib/voice/player'

// Speaker button under a LiAIson answer (owner decision 2026-10-27): reads it
// aloud in one fixed, neutral Mistral Voxtral voice, paid by the listener
// (/api/voice/speech). Press again to stop. Hearing the same answer again on
// this page is free (kept in memory until the page closes, never saved).

const kept = new Map<string, string>()
const KEEP = 20

function keep(text: string, url: string) {
  kept.set(text, url)
  while (kept.size > KEEP) {
    const [oldest, oldUrl] = kept.entries().next().value as [string, string]
    URL.revokeObjectURL(oldUrl)
    kept.delete(oldest)
  }
}

export default function ReadAloudButton({ id, text, onError }: { id: string; text: string; onError?: (message: string | null) => void }) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setPlaying(currentlyPlaying() === id), 0)
    const off = onPlayingChange(p => setPlaying(p === id))
    return () => { clearTimeout(t); off() }
  }, [id])

  const press = async () => {
    if (playing) { stop(); return }
    if (loading) return
    prime() // must run in the tap itself (iPhone)
    onError?.(null)
    let url = kept.get(text)
    if (!url) {
      setLoading(true)
      try {
        const res = await fetch('/api/voice/speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({})) as { error?: string }
          onError?.(d.error ?? 'Reading aloud is not available right now.')
          return
        }
        url = URL.createObjectURL(await res.blob())
        keep(text, url)
        window.dispatchEvent(new Event('liaison:usage-changed'))
      } catch {
        onError?.('Reading aloud is not available right now.')
        return
      } finally {
        setLoading(false)
      }
    }
    await play(id, url).catch(() => onError?.('This answer could not be played.'))
  }

  const label = playing ? 'Stop Reading' : loading ? 'Loading…' : 'Read Aloud*'
  return (
    <button
      type="button"
      onClick={press}
      aria-label={label}
      title={label}
      aria-pressed={playing}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
        playing ? 'text-accent bg-accent-tint' : 'text-text-muted hover:text-accent hover:bg-accent-tint'
      }`}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : playing ? (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="2" /></svg>
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" />
          <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
        </svg>
      )}
      <span>{playing ? 'Stop' : <>Listen<span aria-hidden="true">*</span></>}</span>
    </button>
  )
}
