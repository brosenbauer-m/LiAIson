'use client'

import { useEffect, useRef, useState } from 'react'
import { canRecord, startRecording, MicError, type Recording } from '@/lib/voice/recorder'
import { MAX_RECORDING_SECONDS } from '@/lib/voice/wav'

// Mic button in the chat box (owner decision 2026-10-27): press to talk, press
// again to stop; the words are written into the chat box (not sent) so they can
// be checked first. Mistral Voxtral, paid by the speaker (/api/voice/transcribe).
// Hidden in browsers that can't record.

type Phase = 'idle' | 'starting' | 'recording' | 'working'

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function MicButton({ onText, onError, disabled }: {
  onText: (text: string) => void
  onError: (message: string | null) => void
  disabled?: boolean
}) {
  const [supported, setSupported] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const rec = useRef<Recording | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSupported(canRecord()), 0)
    return () => clearTimeout(t)
  }, [])
  // Leaving the page ends a recording (and turns the microphone off).
  useEffect(() => () => rec.current?.cancel(), [])

  const send = async (wav: Blob | null) => {
    rec.current = null
    setLevel(0)
    if (!wav) { setPhase('idle'); return }
    setPhase('working')
    try {
      const res = await fetch('/api/voice/transcribe', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav })
      const d = await res.json().catch(() => ({})) as { text?: string; error?: string }
      if (!res.ok) { onError(d.error ?? 'Voice is not available right now.'); return }
      if (d.text) onText(d.text)
      else onError("Nothing was heard. Please try again a little closer to the microphone.")
      window.dispatchEvent(new Event('liaison:usage-changed'))
    } catch {
      onError('Voice is not available right now.')
    } finally {
      setPhase('idle')
    }
  }

  const press = async () => {
    if (phase === 'recording') {
      const r = rec.current
      if (r) void send(await r.stop())
      return
    }
    if (phase !== 'idle') return
    onError(null)
    setPhase('starting')
    setSeconds(0)
    try {
      rec.current = await startRecording({
        onTick: setSeconds,
        onLevel: setLevel,
        onAutoStop: wav => void send(wav),
      })
      setPhase('recording')
    } catch (err) {
      setPhase('idle')
      const kind = err instanceof MicError ? err.kind : 'failed'
      onError(
        kind === 'denied' ? 'Microphone access is off. Allow it for this site in your browser settings to talk.' :
        kind === 'unsupported' ? "This browser can't record." :
        "The microphone couldn't be started."
      )
    }
  }

  if (!supported) return null
  const recording = phase === 'recording'
  const label = recording ? 'Stop and Write Down' : phase === 'working' ? 'Writing Down…' : 'Speak Your Message*'

  return (
    <button
      type="button"
      onClick={press}
      disabled={disabled || phase === 'working' || phase === 'starting'}
      aria-label={label}
      title={recording ? `Stop (up to ${clock(MAX_RECORDING_SECONDS)})` : label}
      aria-pressed={recording}
      className={`relative shrink-0 self-stretch min-h-11 rounded-lg border flex items-center justify-center gap-1.5 text-sm font-medium transition-all disabled:opacity-60 ${
        recording
          ? 'px-3 border-error bg-error text-white'
          : 'w-11 border-border bg-surface text-text-secondary hover:text-accent hover:border-accent'
      }`}
    >
      {recording && (
        <span aria-hidden="true" className="absolute inset-0 rounded-lg ring-4 ring-error/30 transition-transform" style={{ transform: `scale(${1 + level * 0.12})` }} />
      )}
      {phase === 'working' || phase === 'starting' ? (
        <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : recording ? (
        <>
          <span aria-hidden="true" className="w-3 h-3 rounded-[3px] bg-white" />
          <span className="tabular-nums">{clock(seconds)}</span>
        </>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
        </svg>
      )}
    </button>
  )
}
