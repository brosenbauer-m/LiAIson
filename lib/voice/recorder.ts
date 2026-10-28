'use client'

import { encodeWav, MAX_RECORDING_SECONDS } from '@/lib/voice/wav'

// Records the microphone in the browser (desktop and phones, iPhone Safari
// included) and hands back a 16 kHz mono WAV. The browser asks for microphone
// permission only when recording starts, i.e. when the mic is first pressed.
// Stops by itself after MAX_RECORDING_SECONDS. Audio stays in memory until it
// is sent; nothing is saved on the device.
//
// With onSegment, the recording is handed over in pieces while the person
// talks: a piece ends at a short pause (or after ~20 s), so it can be written
// down right away (owner request 2026-10-28: text appears while speaking).
// Pieces with nothing said in them are dropped (nothing sent, nothing paid).
//
// Built so a hands-free conversation mode can be added later without changing
// this: onLevel reports loudness about 10 times a second, pauses are already
// detected here, and stop() can be called by code, not only by a button.

export type Recording = {
  // Ends the recording; resolves with the WAV (null if almost nothing was
  // recorded). With onSegment: only the last piece, null if nothing was said.
  stop: () => Promise<Blob | null>
  // Ends the recording and throws it away.
  cancel: () => void
}

export type RecorderOptions = {
  onLevel?: (level: number) => void // 0–1
  onTick?: (seconds: number) => void
  onAutoStop?: (wav: Blob | null) => void
  onSegment?: (wav: Blob) => void
  maxSeconds?: number
}

// Pause detection (loudness 0–1 as reported by onLevel).
const PAUSE_SECONDS = 0.7
const MIN_PIECE_SECONDS = 2
const SOFT_MAX_PIECE_SECONDS = 20
const HARD_MAX_PIECE_SECONDS = 28
const KEEP_BEFORE_SPEECH_SECONDS = 0.5

export class MicError extends Error {
  constructor(public kind: 'unsupported' | 'denied' | 'failed') {
    super(kind)
  }
}

export function canRecord(): boolean {
  return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia &&
    !!(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
}

export async function startRecording(opts: RecorderOptions = {}): Promise<Recording> {
  if (!canRecord()) throw new MicError('unsupported')
  const maxSeconds = opts.maxSeconds ?? MAX_RECORDING_SECONDS
  // Made before waiting for permission: Safari only lets sound start from the
  // tap itself.
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new Ctx()
  void ctx.resume().catch(() => {})

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
  } catch (err) {
    void ctx.close().catch(() => {})
    const name = (err as { name?: string })?.name
    throw new MicError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'failed')
  }

  const source = ctx.createMediaStreamSource(stream)
  // ScriptProcessor works in every browser that records (AudioWorklet is not
  // reliable enough on older iPhones yet).
  const node = ctx.createScriptProcessor(4096, 1, 1)
  const rate = ctx.sampleRate
  const maxLength = Math.ceil(maxSeconds * rate)
  const pieces = !!opts.onSegment
  // The current piece (the whole recording without onSegment).
  let chunks: Float32Array[] = []
  let length = 0
  let total = 0
  let heard = false // something above the quiet level in this piece
  let quietFor = 0 // samples since the last loud moment
  let noise = 0.02 // slowly follows the room's quiet level
  let done = false
  let lastTick = -1

  const encode = (): Blob | null => {
    if (length < rate * 0.3) return null
    const all = new Float32Array(length)
    let at = 0
    for (const c of chunks) { all.set(c, at); at += c.length }
    return encodeWav(all, rate)
  }

  const cut = () => {
    const wav = heard ? encode() : null
    chunks = []
    length = 0
    heard = false
    quietFor = 0
    if (wav) opts.onSegment?.(wav)
  }

  const finish = (): Blob | null => {
    if (done) return null
    done = true
    node.disconnect()
    source.disconnect()
    stream.getTracks().forEach(t => t.stop())
    void ctx.close().catch(() => {})
    return pieces && !heard ? null : encode()
  }

  node.onaudioprocess = e => {
    if (done) return
    const input = e.inputBuffer.getChannelData(0)
    const take = Math.min(input.length, maxLength - total)
    chunks.push(input.slice(0, take))
    length += take
    total += take

    let sum = 0
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
    const level = Math.min(1, Math.sqrt(sum / input.length) * 4)
    opts.onLevel?.(level)

    if (pieces) {
      const loud = level > Math.max(0.04, noise * 2.5)
      if (loud) { heard = true; quietFor = 0 } else { quietFor += take; noise = noise * 0.9 + level * 0.1 }
      const seconds = length / rate
      if (!heard) {
        // Nothing said yet: keep only the last moment before speech starts.
        while (chunks.length > 1 && length - chunks[0].length >= KEEP_BEFORE_SPEECH_SECONDS * rate) {
          length -= chunks.shift()!.length
        }
      } else if (
        (quietFor >= PAUSE_SECONDS * rate && seconds >= MIN_PIECE_SECONDS) ||
        (!loud && seconds >= SOFT_MAX_PIECE_SECONDS) ||
        seconds >= HARD_MAX_PIECE_SECONDS
      ) {
        cut()
      }
    }

    const elapsed = Math.floor(total / rate)
    if (elapsed !== lastTick) { lastTick = elapsed; opts.onTick?.(elapsed) }
    if (total >= maxLength) opts.onAutoStop?.(finish())
  }
  source.connect(node)
  // Some browsers only run the processor while it is connected to the output;
  // it writes silence, so nothing is heard.
  node.connect(ctx.destination)

  return {
    stop: async () => finish(),
    cancel: () => { finish() },
  }
}
