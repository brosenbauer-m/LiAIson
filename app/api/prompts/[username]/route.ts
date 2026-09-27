import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { User, VaultSection } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  const { username } = params
  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('username', username)
    .single<Pick<User, 'id' | 'display_name'>>()

  if (!user) {
    return NextResponse.json({ prompts: [] })
  }

  const { data: sections } = await supabase
    .from('vault_sections')
    .select('section_type, content')
    .eq('user_id', user.id)
    .or('is_professional.eq.true,is_personal.eq.true')

  const populated = new Set<string>(
    (sections as Pick<VaultSection, 'section_type' | 'content'>[] | null ?? [])
      .filter(s => s.content && s.content.trim().length > 10)
      .map(s => s.section_type)
  )

  const name = user.display_name

  const candidatePrompts: { prompt: string; priority: number }[] = [
    {
      prompt: `What is ${name}'s professional background?`,
      priority: populated.has('work_history') || populated.has('current_role') ? 10 : 0,
    },
    {
      prompt: `What skills does ${name} have?`,
      priority: populated.has('skills') ? 9 : 0,
    },
    {
      prompt: `What does ${name} enjoy outside of work?`,
      priority: populated.has('hobbies') || populated.has('lifestyle') ? 8 : 0,
    },
    {
      prompt: `What is ${name} looking for right now?`,
      priority: populated.has('looking_for') || populated.has('values') ? 7 : 0,
    },
    {
      prompt: `Tell me about ${name}'s work or projects`,
      priority: populated.has('projects') || populated.has('education') ? 6 : 0,
    },
    {
      prompt: `Tell me a bit about ${name} as a person`,
      priority: populated.has('bio') ? 5 : 0,
    },
    {
      prompt: `What would ${name} like me to know about them?`,
      priority: 1, // always available fallback
    },
  ]

  const prompts = candidatePrompts
    .filter(p => p.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4)
    .map(p => p.prompt)

  // Ensure we always return 4
  while (prompts.length < 4) {
    prompts.push(`What would ${name} like me to know about them?`)
  }

  return NextResponse.json({ prompts: Array.from(new Set(prompts)).slice(0, 4) })
}
