// Soft sounds for the Circle Studio (Web Audio, no files). Off when the
// person mutes them (remembered in this browser only).

const KEY = 'liaison:circle-sounds'
let ctx: AudioContext | null = null

export function soundsOn(): boolean {
  try { return localStorage.getItem(KEY) !== 'off' } catch { return true }
}

export function setSoundsOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private window */ }
}

function note(at: number, from: number, to: number, length: number, volume: number) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(from, at)
  osc.frequency.exponentialRampToValueAtTime(to, at + length * 0.4)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + length + 0.02)
}

export function play(kind: 'lift' | 'drop' | 'back'): void {
  if (!soundsOn()) return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    if (kind === 'lift') note(t, 420, 560, 0.12, 0.05)
    else if (kind === 'back') note(t, 440, 330, 0.16, 0.04)
    else {
      // A small two-note "plink" (E6, then B6).
      note(t, 1100, 1319, 0.28, 0.06)
      note(t + 0.06, 1700, 1976, 0.34, 0.04)
    }
  } catch { /* no audio */ }
  try { navigator.vibrate?.(kind === 'drop' ? 12 : 6) } catch { /* no vibration */ }
}
