export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, type ReaderContext } from '@/lib/prompts/buildSystemPrompt'
import { resolveCircles } from '@/lib/access/resolveScope'
import { checkRateLimit } from '@/lib/ratelimit'
import { getSenderPlan, checkTrialMessageLimit, TRIAL_TOTAL_DAILY } from '@/lib/ratelimit/trial'
import { mistral, CHAT_MODEL, messageText } from '@/lib/mistral/client'
import { captureVisitorInsight } from '@/lib/insights/capture'
import { logAiUsage, type AiActor } from '@/lib/usage/log'
import { isOverSpendLimit } from '@/lib/usage/spend'
import { getUnpaidBill } from '@/lib/billing/monthly'
import { getPlanAt } from '@/lib/billing/plan'
import { echoAllowed } from '@/lib/plans'
import { COMMON_SIGNAL } from '@/lib/chat/signals'
import type { ChatMessage, User } from '@/types'

// Chat history from the browser is untrusted: only user/assistant turns, the
// last MAX_TURNS, each cut to a sane length, and it must end with the user.
// (Never lets a request add its own system instructions.)
const MAX_TURNS = 20
const MAX_USER_CHARS = 2000
const MAX_ASSISTANT_CHARS = 4000

function cleanHistory(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null
  const turns: ChatMessage[] = []
  for (const m of raw.slice(-MAX_TURNS)) {
    if (!m || typeof m !== 'object') continue
    const { role, content } = m as { role?: unknown; content?: unknown }
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue
    const text = content.trim().slice(0, role === 'user' ? MAX_USER_CHARS : MAX_ASSISTANT_CHARS)
    if (text) turns.push({ role, content: text })
  }
  return turns.length > 0 && turns[turns.length - 1].role === 'user' ? turns : null
}

// The AI's similarity marker [[common]] (lib/chat/signals.ts), also with stray spaces.
const COMMON_MARKER_PATTERN = /\[\[\s*common\s*\]\]/gi
const MARKER_HOLD = 16

// Post-process response to strip any leaked prompt structure
function sanitizeResponse(text: string): string {
  // Remove patterns that look like vault section labels
  const leakPatterns = [
    /\[VAULT DATA\]/gi,
    /\[REFERENCE ONLY\]/gi,
    /\[READER CONTEXT\]/gi,
    /\[READER PROFILE\]/gi,
    /STRICT RULES/gi,
    /section_type/gi,
    /vault_section/gi,
  ]
  let sanitized = text
  for (const pattern of leakPatterns) {
    sanitized = sanitized.replace(pattern, '')
  }
  return sanitized
}


const READER_VAULT_MAX_CHARS = 6000

async function loadReaderContext(
  supabase: ReturnType<typeof createServiceClient>,
  visitorId: string
): Promise<ReaderContext | undefined> {
  try {
    const { data: reader, error: readerError } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', visitorId)
      .single<{ display_name: string }>()

    // Always on since 2026-10-10 (the "Use my Vault when I chat" switch was removed).
    if (readerError || !reader) return undefined

    // Everything except drafts (own circles included: it is their own Vault).
    const { data: sections } = await supabase
      .from('vault_sections')
      .select('label, content')
      .eq('user_id', visitorId)
      .in('circle', ['outer', 'inner', 'custom'])
      .order('domain', { ascending: true })

    const vaultText = ((sections as { label: string; content: string }[] | null) ?? [])
      .filter(s => s.content && s.content.trim().length > 0)
      .map(s => `${s.label.toUpperCase()}:\n${s.content}`)
      .join('\n\n')
      .slice(0, READER_VAULT_MAX_CHARS)

    if (!vaultText) return undefined
    return { displayName: reader.display_name, vaultText }
  } catch {
    return undefined
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const { username } = params

  // Get visitor IP
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  const body = await request.json().catch(() => null) as { messages?: unknown } | null
  const messages = cleanHistory(body?.messages)
  if (!messages) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const visitorSupabase = await createClient()

  // Who is sending, and whose LiAIson (looked up at the same time).
  const [{ data: { user: visitor } }, { data: user, error: userError }] = await Promise.all([
    visitorSupabase.auth.getUser(),
    supabase
      .from('users')
      .select('id, display_name')
      .eq('username', username)
      .single<Pick<User, 'id' | 'display_name'>>(),
  ])

  if (userError || !user) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Only signed-in users can chat: the sender pays for every message
  // (owner decision 2026-10-08), so there is no anonymous chat any more.
  if (!visitor) {
    return NextResponse.json(
      { error: `Sign up or log in to chat with ${user.display_name}'s LiAIson.`, signInRequired: true },
      { status: 401 }
    )
  }

  // Rate limit check
  const { allowed, remaining } = await checkRateLimit(ip, user.id)
  if (!allowed) {
    return NextResponse.json(
      {
        error: `You've reached today's message limit for ${user.display_name}'s LiAIson. Please try again tomorrow.`,
        rateLimited: true,
      },
      { status: 429 }
    )
  }

  // The checks below are independent reads, so they run at the same time; the
  // answers are still applied in this order.
  const [circles, overSpendLimit, unpaidBill, plan] = await Promise.all([
    resolveCircles(user.id, { visitorUserId: visitor.id }),
    isOverSpendLimit(visitor.id),
    getUnpaidBill(visitor.id).catch(() => null),
    getSenderPlan(visitor.id),
  ])

  if (circles === null) {
    return NextResponse.json({ error: "This chat isn't available." }, { status: 403 })
  }

  // Pay-as-you-go: the person who SENDS a message pays for it (owner decision
  // 2026-10-08), never the LiAIson's owner. A signed-in sender who has reached
  // their own monthly spending limit can't send more until the 1st of next month
  // or until they raise it in Settings. Fails open if usage can't be read.
  if (overSpendLimit) {
    return NextResponse.json(
      { error: "You've reached your monthly spending limit. You can raise it in Settings.", paused: true },
      { status: 429 }
    )
  }

  // An unpaid monthly bill pauses sending until it is paid (Settings → Pay now).
  if (unpaidBill) {
    return NextResponse.json(
      { error: 'You have an unpaid bill. Please pay it in Settings to keep chatting.', paused: true },
      { status: 429 }
    )
  }

  // Free trial limits for the sender (exempt accounts have none):
  // 5 messages per day in total (to any LiAIson) during the free month; after
  // it, only with a saved card ('paying', billed at month end).
  if (plan.kind === 'trial_ended') {
    return NextResponse.json(
      { error: 'Your free month has ended. Add a payment method in Settings to keep chatting.', trialLimit: true, paused: true },
      { status: 429 }
    )
  }
  if (plan.kind === 'trial') {
    const trial = await checkTrialMessageLimit(visitor.id)
    if (!trial.allowed) {
      return NextResponse.json(
        { error: `You've used today's ${TRIAL_TOTAL_DAILY} free messages. You can chat again tomorrow.`, trialLimit: true },
        { status: 429 }
      )
    }
  }

  // Two-vault chat: a signed-in visitor (not the owner) can have their own
  // non-draft vault used to answer them, unless they switched it off.
  // It is only added to this request's prompt — never stored or logged.
  const reader: ReaderContext | undefined = visitor.id !== user.id ? await loadReaderContext(supabase, visitor.id) : undefined
  const systemPrompt = await buildSystemPrompt(user.id, circles, reader)

  // Who caused this AI usage (for usage tracking only; no identity is stored).
  const actor: AiActor = visitor.id === user.id ? 'owner' : 'member'

  // Stream response from Mistral
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const mistralStream = await mistral.chat.stream({
          model: CHAT_MODEL,
          maxTokens: 1024,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
          ],
        })

        // The similarity marker is removed from the text (lib/chat/signals.ts).
        // A possible start of it is held back until the next chunk shows
        // whether it is the marker.
        let usage: { promptTokens?: number; completionTokens?: number } | undefined
        let pending = ''
        let common = false
        const flush = (final: boolean) => {
          pending = pending.replace(COMMON_MARKER_PATTERN, () => {
            common = true
            return ''
          })
          const bracket = pending.indexOf('[', Math.max(0, pending.length - MARKER_HOLD))
          const cut = final || bracket === -1 ? pending.length : bracket
          const out = pending.slice(0, cut)
          pending = pending.slice(cut)
          if (out) controller.enqueue(encoder.encode(sanitizeResponse(out)))
        }
        for await (const event of mistralStream) {
          if (event.data?.usage) usage = event.data.usage
          const text = messageText(event.data?.choices[0]?.delta.content)
          if (text) {
            pending += text
            flush(false)
          }
        }
        flush(true)
        if (common) controller.enqueue(encoder.encode(COMMON_SIGNAL))

        // Billed to the sender.
        await logAiUsage({ userId: visitor.id, feature: 'chat', model: CHAT_MODEL, actor, usage })
        controller.close()
      } catch (err) {
        console.error('CHAT_STREAM_ERROR', err)
        controller.error(err)
      }

      // Background work after the reply. waitUntil keeps the Vercel function
      // alive until it finishes; without it, the work is cut off once the
      // response has been sent. Errors are ignored.
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
      // Anonymous "what visitors want to know" statement for the owner's insights.
      // Skipped when the owner chats with their own LiAIson, and when the owner's
      // plan has no Echoes (Introvert), so no AI is spent on it.
      if (lastUserMessage && visitor.id !== user.id) {
        waitUntil(
          (async () => {
            if (!echoAllowed(await getPlanAt(user.id), 'month')) return
            await captureVisitorInsight(user.id, lastUserMessage.content, actor)
          })().catch(() => {/* ignore */})
        )
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Rate-Limit-Remaining': String(remaining),
    },
  })
}
