export const runtime = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logAiUsage } from '@/lib/usage/log'
import { paidUsePause } from '@/lib/usage/gate'
import { underLimit } from '@/lib/redis'
import { speak, TTS_MODEL, MAX_SPEECH_CHARS, VoiceError } from '@/lib/voice/server'

// Speaker button on a LiAIson answer (owner decision 2026-10-27): the answer
// read aloud by Mistral Voxtral in one fixed preset voice (never a cloned
// one). Signed-in only; paid by the listener per character like messages
// (spending limit, free-month limits). The audio goes straight back to the
// browser and is never stored.
// POST { text } → audio/mpeg.

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to use voice.' }, { status: 401 })

  const body = await request.json().catch(() => null) as { text?: unknown } | null
  const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : ''
  if (!text) return NextResponse.json({ error: 'Nothing to read aloud.' }, { status: 400 })
  const chars = Array.from(text).length
  if (chars > MAX_SPEECH_CHARS) return NextResponse.json({ error: 'This answer is too long to read aloud.' }, { status: 413 })

  if (!(await underLimit(`voice:tts:${user.id}`, 60, 3600))) {
    return NextResponse.json({ error: 'Please wait a little before reading aloud again.' }, { status: 429 })
  }
  const pause = await paidUsePause(user.id, { voice: true })
  if (pause) return NextResponse.json({ error: pause.error, paused: true }, { status: pause.status })

  try {
    const audio = await speak(text)
    await logAiUsage({ userId: user.id, feature: 'voice_speech', model: TTS_MODEL, actor: 'member', usage: { promptTokens: chars, completionTokens: 0 } })
    return new NextResponse(Buffer.from(audio), {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'Content-Length': String(audio.length) },
    })
  } catch (err) {
    console.error('VOICE_SPEECH_ERROR', err instanceof Error ? err.message : 'failed')
    const status = err instanceof VoiceError ? err.status : 502
    return NextResponse.json({ error: 'Reading aloud is not available right now.' }, { status })
  }
}
