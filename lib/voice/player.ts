'use client'

// Plays read-aloud answers: one at a time, on one audio element shared by the
// whole page. iPhone Safari only plays sound that starts from a tap, and the
// audio arrives a moment later, so prime() is called in the tap itself (it
// plays a moment of silence), which lets the real audio play when it arrives.
// Audio is kept in memory only while the page is open, so playing the same
// answer again costs nothing; nothing is saved on the device.
//
// For a later hands-free mode: play() resolves when the answer has finished,
// so the next recording can start after it.

let el: HTMLAudioElement | null = null
let silentUrl: string | null = null
let finishCurrent: (() => void) | null = null
const listeners = new Set<(playingId: string | null) => void>()
let playingId: string | null = null

function audio(): HTMLAudioElement {
  if (!el) {
    el = new Audio()
    el.preload = 'auto'
    el.setAttribute('playsinline', '')
  }
  return el
}

function setPlaying(id: string | null) {
  playingId = id
  listeners.forEach(fn => fn(id))
}

export function onPlayingChange(fn: (id: string | null) => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function currentlyPlaying(): string | null {
  return playingId
}

// Call synchronously inside the tap/click handler.
export function prime() {
  const a = audio()
  if (!silentUrl) {
    // 0.1 s of silence as WAV (8 kHz, 8-bit).
    const n = 800
    const bytes = new Uint8Array(44 + n)
    const view = new DataView(bytes.buffer)
    const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i) }
    text(0, 'RIFF'); view.setUint32(4, 36 + n, true); text(8, 'WAVE'); text(12, 'fmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, 8000, true); view.setUint32(28, 8000, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true)
    text(36, 'data'); view.setUint32(40, n, true); bytes.fill(128, 44)
    silentUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
  }
  if (playingId) return
  a.src = silentUrl
  void a.play().catch(() => {})
}

export function stop() {
  const a = audio()
  a.pause()
  finishCurrent?.()
}

// Plays the audio; resolves when it ends or is stopped.
export function play(id: string, url: string): Promise<void> {
  stop()
  const a = audio()
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      a.onended = null
      a.onerror = null
      finishCurrent = null
      setPlaying(null)
    }
    finishCurrent = () => { cleanup(); resolve() }
    a.onended = () => { cleanup(); resolve() }
    a.onerror = () => { cleanup(); reject(new Error('playback')) }
    a.src = url
    setPlaying(id)
    a.play().catch(err => { cleanup(); reject(err) })
  })
}
