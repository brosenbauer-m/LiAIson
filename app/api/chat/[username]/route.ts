export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { buildSystemPrompt, type ReaderContext } from '@/lib/prompts/buildSystemPrompt'
import { resolveScope } from '@/lib/access/resolveScope'
import { checkRateLimit } from '@/lib/ratelimit'
import { checkAnonMessageLimit, ANON_MESSAGE_LIMIT } from '@/lib/ratelimit/anon'
import { mistral, CHAT_MODEL, FAST_MODEL } from '@/lib/mistral/client'
import { captureVisitorInsight } from '@/lib/insights/capture'
import { logAiUsage, type AiActor } from '@/lib/usage/log'
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

async function extractTopicCluster(message: string, ownerId: string, actor: AiActor): Promise<string> {
  try {
    const response = await mistral.chat.complete({
      model: FAST_MODEL,
      maxTokens: 50,
      messages: [
        {
          role: 'user',
          content: `In 3-5 words, what topic is this message asking about? Reply with only the topic, nothing else. Message: ${message}`,
        },
      ],
    })
    await logAiUsage({ userId: ownerId, feature: 'topic', model: FAST_MODEL, actor, usage: response.usage })
    const content = extractTextContent(response.choices[0]?.message?.content)
    return content.trim() || 'general inquiry'
  } catch {
    return 'general inquiry'
  }
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

export async function POST(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
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

  // Rate limit check
  const { allowed, remaining } = await checkRateLimit(ip, user.id)
  if (!allowed) {
    return NextResponse.json(
      {
        error: `You've had a great conversation! Sign up to connect with ${user.display_name} directly.`,
        rateLimited: true,
      },
      { status: 429 }
    )
  }

  const scope = await resolveScope(user.id, { visitorUserId: visitor?.id })
  if (scope === null) {
    return NextResponse.json({ error: "This chat isn't available." }, { status: 403 })
  }

  // Signed-out visitors: max 3 messages per profile, enforced on the server.
  if (!visitor) {
    const anonLimitMessage = `You've had a great conversation! Sign up to keep chatting with ${user.display_name}.`
    const userTurns = messages.filter(m => m.role === 'user').length
    if (userTurns > ANON_MESSAGE_LIMIT) {
      return NextResponse.json({ error: anonLimitMessage, rateLimited: true }, { status: 429 })
    }
    const anon = await checkAnonMessageLimit(ip, user.id)
    if (!anon.allowed) {
      return NextResponse.json({ error: anonLimitMessage, rateLimited: true }, { status: 429 })
    }
  }

  // Two-vault chat: a signed-in visitor (not the owner) can have their own
  // non-draft vault used to answer them, unless they switched it off.
  // It is only added to this request's prompt — never stored or logged.
  let reader: ReaderContext | undefined
  if (visitor && visitor.id !== user.id) {
    reader = await loadReaderContext(supabase, visitor.id)
  }

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(user.id, scope, reader)

  // Who caused this AI usage (for usage tracking only; no identity is stored).
  const actor: AiActor = !visitor ? 'visitor' : visitor.id === user.id ? 'owner' : 'member'

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

        await logAiUsage({ userId: user.id, feature: 'chat', model: CHAT_MODEL, actor, usage })
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
      if (lastUserMessage && visitor?.id !== user.id) {
        waitUntil(captureVisitorInsight(user.id, lastUserMessage.content, actor).catch(() => {/* ignore */}))
      }

      if (lastUserMessage) {
        waitUntil(extractTopicCluster(lastUserMessage.content, user.id, actor).then(async topic => {
          // Check if topic already exists for this profile
          const { data: existing } = await supabase
            .from('visitor_query_log')
            .select('id, count')
            .eq('profile_user_id', user.id)
            .ilike('topic_cluster', topic)
            .limit(1)
            .single()

          if (existing) {
            await supabase
              .from('visitor_query_log')
              .update({ count: (existing.count as number) + 1 })
              .eq('id', existing.id)
          } else {
            await supabase.from('visitor_query_log').insert({
              profile_user_id: user.id,
              topic_cluster: topic,
              count: 1,
              surfaced_to_owner: false,
            })
          }
        }).catch(() => {/* ignore async errors */}))
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
