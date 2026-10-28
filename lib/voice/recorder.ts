'use client'

import { encodeWav, MAX_RECORDING_SECONDS } from '@/lib/voice/wav'

// Records the microphone in the browser (desktop and phones, iPhone Safari
// included) and hands back a 16 kHz mono WAV. The browser asks for microphone
// permission only when recording starts, i.e. when the mic is first pressed.
// Stops by itself after MAX_RECORDING_SECONDS. Audio stays in memory until it
// is sent; nothing is saved on the device.
//
// Built so a hands-free conversation mode can be added later without changing
// this: onLevel reports loudness about 10 times a second (enough to notice
// when someone stops talking) and stop() can be called by code, not only by a
// button.

export type Recording = {
  // Ends the recording; resolves with the WAV (null if almost nothing was recorded).
  stop: () => Promise<Blob | null>
  // Ends the recording and throws it away.
  cancel: () => void
}

export type RecorderOptions = {
  onLevel?: (level: number) => void // 0–1
  onTick?: (seconds: number) => void
  onAutoStop?: (wav: Blob | null) => void
  maxSeconds?: number
}

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
  const chunks: Float32Array[] = []
  let length = 0
  const maxLength = Math.ceil(maxSeconds * ctx.sampleRate)
  let done = false
  let lastTick = -1

  const finish = (): Blob | null => {
    if (done) return null
    done = true
    node.disconnect()
    source.disconnect()
    stream.getTracks().forEach(t => t.stop())
    void ctx.close().catch(() => {})
    if (length < ctx.sampleRate * 0.3) return null
    const all = new Float32Array(length)
    let at = 0
    for (const c of chunks) { all.set(c, at); at += c.length }
    return encodeWav(all, ctx.sampleRate)
  }

  node.onaudioprocess = e => {
    if (done) return
    const input = e.inputBuffer.getChannelData(0)
    const take = Math.min(input.length, maxLength - length)
    chunks.push(input.slice(0, take))
    length += take
    if (opts.onLevel) {
      let sum = 0
      for (let i = 0; i < input.length; i++) sum += input[i] * input[i]
      opts.onLevel(Math.min(1, Math.sqrt(sum / input.length) * 4))
    }
    const seconds = Math.floor(length / ctx.sampleRate)
    if (seconds !== lastTick) { lastTick = seconds; opts.onTick?.(seconds) }
    if (length >= maxLength) opts.onAutoStop?.(finish())
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
