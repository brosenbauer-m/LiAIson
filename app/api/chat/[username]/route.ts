export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { buildSystemPrompt } from '@/lib/prompts/buildSystemPrompt'
import { checkRateLimit } from '@/lib/ratelimit'
import { anthropic, CHAT_MODEL, FAST_MODEL } from '@/lib/anthropic/client'
import type { ChatMessage, User } from '@/types'

// Post-process response to strip any leaked prompt structure
function sanitizeResponse(text: string): string {
  // Remove patterns that look like vault section labels
  const leakPatterns = [
    /\[VAULT DATA\]/gi,
    /\[REFERENCE ONLY\]/gi,
    /STRICT RULES/gi,
    /section_type/gi,
    /vault_section/gi,
  ]
  let sanitized = text
  for (const pattern of leakPatterns) {
    sanitized = sanitized.replace(pattern, '')
  }
  return sanitized.trim()
}

async function extractTopicCluster(message: string): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 50,
      messages: [
        {
          role: 'user',
          content: `In 3-5 words, what topic is this message asking about? Reply with only the topic, nothing else. Message: ${message}`,
        },
      ],
    })
    const content = response.content[0]
    return content.type === 'text' ? content.text.trim() : 'general inquiry'
  } catch {
    return 'general inquiry'
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
  const { messages } = body as { messages: ChatMessage[]; visitorId: string }

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

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

  // Build system prompt
  const systemPrompt = await buildSystemPrompt(user.id)

  // Stream response from Anthropic
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: CHAT_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        })

        for await (const event of anthropicStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            const sanitized = sanitizeResponse(event.delta.text)
            controller.enqueue(encoder.encode(sanitized))
          }
        }

        controller.close()
      } catch (err) {
        controller.error(err)
      }

      // Asynchronously extract topic and log it (don't await — fire and forget)
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
      if (lastUserMessage) {
        extractTopicCluster(lastUserMessage.content).then(async topic => {
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
        }).catch(() => {/* ignore async errors */})
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
