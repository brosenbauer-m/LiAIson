// Voice recordings travel as plain WAV (16 kHz, mono, 16-bit): every browser
// can make it (iPhone Safari included) and Voxtral reads it, without guessing
// which compressed formats each browser records. Two minutes ≈ 3.8 MB, under
// the 4.5 MB request limit of the server. Used in the browser (encode) and on
// the server (check the header, length in seconds).

export const VOICE_SAMPLE_RATE = 16000
// Owner decision 2026-10-27: recordings of about two minutes at most.
export const MAX_RECORDING_SECONDS = 120

// Float samples (any rate) → 16 kHz mono 16-bit WAV.
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const pcm = resample(samples, sampleRate, VOICE_SAMPLE_RATE)
  const buffer = new ArrayBuffer(44 + pcm.length * 2)
  const view = new DataView(buffer)
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)) }
  text(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, VOICE_SAMPLE_RATE, true)
  view.setUint32(28, VOICE_SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, pcm.length * 2, true)
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

// Averages neighbouring samples down to the target rate (enough for speech).
function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = end > start ? sum / (end - start) : 0
  }
  return out
}

// Seconds of audio in a WAV made by encodeWav, or null when it is anything else.
export function wavSeconds(bytes: Uint8Array): number | null {
  if (bytes.length < 44) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const text = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4))
  if (text(0) !== 'RIFF' || text(8) !== 'WAVE' || text(12) !== 'fmt ' || text(36) !== 'data') return null
  const format = view.getUint16(20, true)
  const channels = view.getUint16(22, true)
  const rate = view.getUint32(24, true)
  const bits = view.getUint16(34, true)
  if (format !== 1 || channels !== 1 || rate !== VOICE_SAMPLE_RATE || bits !== 16) return null
  const dataBytes = Math.min(view.getUint32(40, true), bytes.length - 44)
  return dataBytes / (VOICE_SAMPLE_RATE * 2)
}
