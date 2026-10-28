export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAiUsage } from '@/lib/usage/log'
import { paidUsePause } from '@/lib/usage/gate'
import { underLimit } from '@/lib/redis'
import { transcribe, STT_MODEL } from '@/lib/voice/server'
import { wavSeconds, MAX_RECORDING_SECONDS, VOICE_SAMPLE_RATE } from '@/lib/voice/wav'

// Mic button in the LiAIson chat (owner decision 2026-10-27): a recording
// (16 kHz mono WAV, at most about two minutes; usually a piece of a few
// seconds up to the next pause, so the words appear while talking) → its text, which the browser
// puts into the chat box to check before sending. Signed-in only; paid by the
// speaker per second like messages (spending limit, free-month limits).
// The audio is only passed to Mistral Voxtral and never stored.
// POST body = the WAV → { text }.

const MAX_BYTES = 44 + (MAX_RECORDING_SECONDS + 5) * VOICE_SAMPLE_RATE * 2

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to use voice.' }, { status: 401 })

  const declared = Number(request.headers.get('content-length') || 0)
  if (declared > MAX_BYTES) return NextResponse.json({ error: 'Recordings can be up to two minutes long.' }, { status: 413 })

  // Pieces of a few seconds each: ~25 per two-minute recording.
  if (!(await underLimit(`voice:stt:${user.id}`, 400, 3600))) {
    return NextResponse.json({ error: 'Please wait a little before recording again.' }, { status: 429 })
  }
  const pause = await paidUsePause(user.id, { voice: true })
  if (pause) return NextResponse.json({ error: pause.error, paused: true }, { status: pause.status })

  const audio = new Uint8Array(await request.arrayBuffer().catch(() => new ArrayBuffer(0)))
  if (audio.length > MAX_BYTES) return NextResponse.json({ error: 'Recordings can be up to two minutes long.' }, { status: 413 })
  const seconds = wavSeconds(audio)
  if (seconds === null) return NextResponse.json({ error: 'This recording could not be read.' }, { status: 400 })
  if (seconds > MAX_RECORDING_SECONDS + 2) return NextResponse.json({ error: 'Recordings can be up to two minutes long.' }, { status: 413 })
  if (seconds < 0.3) return NextResponse.json({ text: '' })

  try {
    const result = await transcribe(audio)
    // Billed by the second (rounded up), as Mistral counts it.
    const billed = Math.ceil(result.seconds && result.seconds > 0 ? result.seconds : seconds)
    await logAiUsage({ userId: user.id, feature: 'voice_transcribe', model: STT_MODEL, actor: 'member', usage: { promptTokens: billed, completionTokens: 0 } })
    return NextResponse.json({ text: result.text.slice(0, 2000) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('VOICE_TRANSCRIBE_ERROR', err instanceof Error ? err.message : 'failed')
    return NextResponse.json({ error: 'Voice is not available right now.' }, { status: 502 })
  }
}
