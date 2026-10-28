import { mistral } from '@/lib/mistral/client'
import { getRedis } from '@/lib/redis'

// Voice in the LiAIson chat (owner decision 2026-10-27): Mistral Voxtral only,
// through the same EU client as every other AI call. Audio is passed straight
// through and never stored (not in the database, not in Redis, not in logs).
// Server-only.
//
// Models can be changed without code (.env.example). Read-aloud always uses
// ONE preset voice from Mistral's own list: never a cloned or custom voice
// (no reference audio is ever sent).

export const STT_MODEL = process.env.MISTRAL_STT_MODEL || 'voxtral-mini-latest'
export const TTS_MODEL = process.env.MISTRAL_TTS_MODEL || 'voxtral-mini-tts-latest'

// Longest text read aloud at once (a long chat answer is ~2,500 characters).
export const MAX_SPEECH_CHARS = 3000

export class VoiceError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

// What a 16 kHz mono WAV recording says (lib/voice/wav.ts).
export async function transcribe(wav: Uint8Array): Promise<{ text: string; seconds: number | null }> {
  const res = await mistral.audio.transcriptions.complete({
    model: STT_MODEL,
    file: { fileName: 'voice.wav', content: wav },
    temperature: 0,
  })
  return { text: (res.text ?? '').trim(), seconds: res.usage?.promptAudioSeconds ?? null }
}

const VOICE_KEY = 'voice:preset:v1'
let cachedVoice: string | null = null

// The fixed read-aloud voice: MISTRAL_TTS_VOICE when set, otherwise the same
// preset every time (an English one that calls itself neutral if there is one,
// else the first by name), kept for a week so it never changes mid-conversation.
async function presetVoice(): Promise<string | null> {
  if (process.env.MISTRAL_TTS_VOICE) return process.env.MISTRAL_TTS_VOICE
  if (cachedVoice) return cachedVoice
  const kept = await getRedis().get<string>(VOICE_KEY).catch(() => null)
  if (typeof kept === 'string' && kept) return (cachedVoice = kept)
  const list = await mistral.audio.voices.list({ type: 'preset', limit: 100 }).catch(err => {
    console.error('VOICE_LIST_ERROR', err instanceof Error ? err.message : err)
    return null
  })
  // Presets only (no owner = Mistral's own voices).
  const voices = (list?.items ?? []).filter(v => !v.userId).sort((a, b) => (a.slug || a.name).localeCompare(b.slug || b.name))
  if (!voices.length) return null
  const english = voices.filter(v => !v.languages?.length || v.languages.some(l => l.toLowerCase().startsWith('en')))
  const pool = english.length ? english : voices
  const describe = (v: (typeof voices)[number]) => [v.name, v.description, ...(v.tags ?? [])].join(' ').toLowerCase()
  const pick = pool.find(v => describe(v).includes('neutral')) ?? pool[0]
  cachedVoice = pick.id
  await getRedis().set(VOICE_KEY, pick.id, { ex: 7 * 86400 }).catch(() => {})
  return pick.id
}

// MP3 audio of the text, read in the fixed preset voice.
export async function speak(text: string): Promise<Uint8Array> {
  const voiceId = await presetVoice()
  const res = await mistral.audio.speech.complete({
    model: TTS_MODEL,
    input: text,
    ...(voiceId ? { voiceId } : {}),
    responseFormat: 'mp3',
  })
  const audio = Buffer.from(res.audioData ?? '', 'base64')
  if (!audio.length) throw new VoiceError('Reading aloud is not available right now.', 502)
  return new Uint8Array(audio)
}
