import { createServiceClient } from '@/lib/supabase/service'

// Records AI usage per call: the account it is billed to (the sender for chat
// messages; the LiAIson owner for insights and Echoes), which feature, which
// model and the token counts reported by Mistral. Never stores message content
// or prompts, and never which LiAIson a sender chatted with.
// This is the "measure first" step for usage-based pricing. Never throws.

export type AiFeature = 'chat' | 'topic' | 'insight' | 'echo'

// Who caused the call: the owner chatting with their own LiAIson, a signed-in
// member, a signed-out visitor (legacy rows only), or the system (scheduled Echoes).
export type AiActor = 'owner' | 'member' | 'visitor' | 'system'

type UsageLike = {
  promptTokens?: number | null
  completionTokens?: number | null
} | null | undefined

function toTokenCount(value: unknown): number {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n > 0 ? n : 0
}

export async function logAiUsage(entry: {
  userId: string
  feature: AiFeature
  model: string
  actor: AiActor
  usage: UsageLike
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('ai_usage').insert({
      user_id: entry.userId,
      feature: entry.feature,
      model: entry.model.slice(0, 100),
      actor: entry.actor,
      prompt_tokens: toTokenCount(entry.usage?.promptTokens),
      completion_tokens: toTokenCount(entry.usage?.completionTokens),
    })
    if (error) console.error('AI_USAGE_LOG_ERROR', error.message)
  } catch (err) {
    console.error('AI_USAGE_LOG_ERROR', err)
  }
}
