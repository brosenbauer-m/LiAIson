export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, type ReaderContext } from '@/lib/prompts/buildSystemPrompt'
import { resolveScope } from '@/lib/access/resolveScope'
import { checkRateLimit } from '@/lib/ratelimit'
import { getSenderPlan, checkTrialMessageLimit } from '@/lib/ratelimit/trial'
import { mistral, CHAT_MODEL } from '@/lib/mistral/client'
import { captureVisitorInsight } from '@/lib/insights/capture'
import { logAiUsage, type AiActor } from '@/lib/usage/log'
import { isOverSpendLimit } from '@/lib/usage/spend'
import { getUnpaidBill } from '@/lib/billing/monthly'
import type { ChatMessage, User } from '@/types'

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

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .filter(
      (chunk): chunk is { type: 'text'; text: string } =>
        typeof chunk === 'object' &&
        chunk !== null &&
        'type' in chunk &&
        chunk.type === 'text' &&
        'text' in chunk &&
        typeof chunk.text === 'string'
    )
    .map(chunk => chunk.text)
    .join('')
}

const READER_VAULT_MAX_CHARS = 6000

async function loadReaderContext(
  supabase: ReturnType<typeof createServiceClient>,
  visitorId: string
): Promise<ReaderContext | undefined> {
  try {
    const { data: reader, error: readerError } = await supabase
      .from('users')
      .select('display_name, use_own_vault_in_chats')
      .eq('id', visitorId)
      .single<{ display_name: string; use_own_vault_in_chats: boolean }>()

    if (readerError || !reader || reader.use_own_vault_in_chats !== true) return undefined

    // Everything except drafts (drafts have neither flag set).
    const { data: sections } = await supabase
      .from('vault_sections')
      .select('label, content')
      .eq('user_id', visitorId)
      .or('is_professional.eq.true,is_personal.eq.true')
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

  const body = await request.json()
  const { messages } = body as {
    messages: ChatMessage[]
    visitorId: string
  }

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const visitorSupabase = await createClient()
  const { data: { user: visitor } } = await visitorSupabase.auth.getUser()

  const supabase = createServiceClient()

  // Look up user by username
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('username', username)
    .single<Pick<User, 'id' | 'display_name'>>()

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

  const scope = await resolveScope(user.id, { visitorUserId: visitor.id })
  if (scope === null) {
    return NextResponse.json({ error: "This chat isn't available." }, { status: 403 })
  }

  // Pay-as-you-go: the person who SENDS a message pays for it (owner decision
  // 2026-10-08), never the LiAIson's owner. A signed-in sender who has reached
  // their own monthly spending limit can't send more until the 1st of next month
  // or until they raise it in Settings. Fails open if usage can't be read.
  if (await isOverSpendLimit(visitor.id)) {
    return NextResponse.json(
      { error: "You've reached your monthly spending limit. You can raise it in Settings.", paused: true },
      { status: 429 }
    )
  }

  // An unpaid monthly bill pauses sending until it is paid (Settings → Pay now).
  if (await getUnpaidBill(visitor.id).catch(() => null)) {
    return NextResponse.json(
      { error: 'You have an unpaid bill. Please pay it in Settings to keep chatting.', paused: true },
      { status: 429 }
    )
  }

  // Free trial limits for the sender (exempt accounts have none):
  // 3 messages per day to each LiAIson and 15 per day in total during the free
  // month; after it, only with a saved card ('paying', billed at month end).
  const plan = await getSenderPlan(visitor.id)
  if (plan.kind === 'trial_ended') {
    return NextResponse.json(
      { error: 'Your free month has ended. Add a payment method in Settings to keep chatting.', trialLimit: true, paused: true },
      { status: 429 }
    )
  }
  if (plan.kind === 'trial') {
    const trial = await checkTrialMessageLimit(visitor.id, user.id)
    if (!trial.allowed) {
      const error = trial.reason === 'total'
        ? "You've used today's 15 free-trial messages. You can chat again tomorrow."
        : `You've used today's 3 free-trial messages with ${user.display_name}'s LiAIson. You can chat again tomorrow.`
      return NextResponse.json({ error, trialLimit: true }, { status: 429 })
    }
  }

  // Two-vault chat: a signed-in visitor (not the owner) can have their own
  // non-draft vault used to answer them, unless they switched it off.
  // It is only added to this request's prompt — never stored or logged.
  let reader: ReaderContext | undefined
  if (visitor.id !== user.id) {
    reader = await loadReaderContext(supabase, visitor.id)
  }

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(user.id, scope, reader)

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

        let usage: { promptTokens?: number; completionTokens?: number } | undefined
        for await (const event of mistralStream) {
          if (event.data?.usage) usage = event.data.usage
          const text = extractTextContent(event.data?.choices[0]?.delta.content)
          if (text) {
            const sanitized = sanitizeResponse(text)
            controller.enqueue(encoder.encode(sanitized))
          }
        }

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
      // Skipped when the owner chats with their own LiAIson.
      if (lastUserMessage && visitor.id !== user.id) {
        waitUntil(captureVisitorInsight(user.id, lastUserMessage.content, actor).catch(() => {/* ignore */}))
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
