import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mistral, FAST_MODEL } from '@/lib/mistral/client'
import type { VaultSection } from '@/types'

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

async function generateCompatibilitySummary(
  vaultA: string,
  vaultB: string
): Promise<string> {
  try {
    const response = await mistral.chat.complete({
      model: FAST_MODEL,
      maxTokens: 200,
      messages: [
        {
          role: 'user',
          content: `In 2-3 warm, specific sentences, explain why these two people might enjoy connecting, based on their profiles. Person A: ${vaultA}. Person B: ${vaultB}. Focus on genuine shared interests or complementary traits. Be specific, not generic.`,
        },
      ],
    })
    return extractTextContent(response.choices[0]?.message?.content).trim()
  } catch {
    return ''
  }
}

async function getVaultSummary(userId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data: sections } = await supabase
    .from('vault_sections')
    .select('label, content')
    .eq('user_id', userId)
    .eq('visibility', 'public')

  return (sections as Pick<VaultSection, 'label' | 'content'>[] | null ?? [])
    .filter(s => s.content && s.content.trim().length > 0)
    .map(s => `${s.label}: ${s.content}`)
    .join('; ')
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const serviceSupabase = createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { toUserId } = await request.json()

  if (!toUserId || toUserId === user.id) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Check if interest already exists
  const { data: existing } = await serviceSupabase
    .from('connection_interests')
    .select('id, status')
    .eq('from_user_id', user.id)
    .eq('to_user_id', toUserId)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Interest already registered', status: existing.status })
  }

  // Insert new interest
  const { data: newInterest, error } = await serviceSupabase
    .from('connection_interests')
    .insert({
      from_user_id: user.id,
      to_user_id: toUserId,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to register interest' }, { status: 500 })
  }

  // Check if the reverse already exists (mutual match)
  const { data: reverse } = await serviceSupabase
    .from('connection_interests')
    .select('id')
    .eq('from_user_id', toUserId)
    .eq('to_user_id', user.id)
    .single()

  if (reverse) {
    // It's a match! Update both to 'matched'
    await Promise.all([
      serviceSupabase
        .from('connection_interests')
        .update({ status: 'matched' })
        .eq('id', newInterest.id),
      serviceSupabase
        .from('connection_interests')
        .update({ status: 'matched' })
        .eq('id', reverse.id),
    ])

    // Generate compatibility summary
    const [vaultA, vaultB] = await Promise.all([
      getVaultSummary(user.id),
      getVaultSummary(toUserId),
    ])
    const summary = await generateCompatibilitySummary(vaultA, vaultB)

    if (summary) {
      await serviceSupabase
        .from('connection_interests')
        .update({ compatibility_summary: summary })
        .eq('id', newInterest.id)
    }

    // Notify both users
    const { data: userAData } = await serviceSupabase
      .from('users')
      .select('display_name')
      .eq('id', user.id)
      .single()
    const { data: userBData } = await serviceSupabase
      .from('users')
      .select('display_name')
      .eq('id', toUserId)
      .single()

    await serviceSupabase.from('notifications').insert([
      {
        user_id: user.id,
        type: 'connection_match',
        message: `You have a new match! ${userBData?.display_name ?? 'Someone'} also wants to connect with you.`,
        metadata: { matched_user_id: toUserId },
        read: false,
      },
      {
        user_id: toUserId,
        type: 'connection_match',
        message: `You have a new match! ${userAData?.display_name ?? 'Someone'} also wants to connect with you.`,
        metadata: { matched_user_id: user.id },
        read: false,
      },
    ])

    return NextResponse.json({ matched: true, summary })
  }

  return NextResponse.json({ matched: false, message: "Your interest has been noted — we'll let you know if it's mutual." })
}
