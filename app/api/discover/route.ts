import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { mistral, FAST_MODEL } from '@/lib/mistral/client'
import type { User, VaultSection } from '@/types'

type DiscoverMode = 'professional' | 'personal' | 'all'

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

async function extractKeywords(query: string): Promise<string[]> {
  try {
    const response = await mistral.chat.complete({
      model: FAST_MODEL,
      maxTokens: 100,
      messages: [
        {
          role: 'user',
          content: `Extract 3-6 search keywords from this query as a JSON array of strings. Query: ${query}`,
        },
      ],
    })
    const content = extractTextContent(response.choices[0]?.message?.content)
    const match = content.match(/\[[\s\S]*\]/)
    if (match) {
      const keywords = JSON.parse(match[0])
      return Array.isArray(keywords) ? keywords : []
    }
    return query.split(' ').filter(w => w.length > 3).slice(0, 5)
  } catch {
    return query.split(' ').filter(w => w.length > 3).slice(0, 5)
  }
}

export async function POST(request: NextRequest) {
  const { query, mode = 'all', location } = await request.json() as {
    query: string
    mode: DiscoverMode
    location?: string
  }

  if (!query || typeof query !== 'string') {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const keywords = await extractKeywords(query)

  // Build OR conditions for keyword matching
  const keywordConditions = keywords
    .map(k => `content.ilike.%${k}%`)
    .join(',')

  let sectionsQuery = supabase
    .from('vault_sections')
    .select('user_id, content, section_type, domain')
    .or(keywordConditions)
    .eq('visibility', 'public')

  if (mode !== 'all') {
    sectionsQuery = sectionsQuery.eq('domain', mode)
  }

  const { data: sections } = await sectionsQuery

  if (!sections || sections.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // Count keyword matches per user
  const userMatchCounts = new Map<string, number>()
  for (const section of sections as Pick<VaultSection, 'user_id' | 'content' | 'section_type' | 'domain'>[]) {
    const count = keywords.filter(k =>
      section.content.toLowerCase().includes(k.toLowerCase())
    ).length
    userMatchCounts.set(section.user_id, (userMatchCounts.get(section.user_id) ?? 0) + count)
  }

  // Get distinct user IDs sorted by match count
  const sortedUserIds = Array.from(userMatchCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, 20)

  // Fetch user profiles
  let usersQuery = supabase
    .from('users')
    .select('*')
    .in('id', sortedUserIds)
    .eq('is_discoverable', true)

  if (mode !== 'all') {
    usersQuery = usersQuery.in('discover_mode', [mode, 'all'])
  }

  if (location) {
    usersQuery = usersQuery.ilike('short_bio', `%${location}%`)
  }

  const { data: users } = await usersQuery

  if (!users || users.length === 0) {
    return NextResponse.json({ results: [] })
  }

  // For each user, get their top tags
  const results = await Promise.all(
    (users as User[]).map(async user => {
      const { data: tags } = await supabase
        .from('vault_sections')
        .select('content')
        .eq('user_id', user.id)
        .eq('visibility', 'public')
        .in('section_type', ['skills', 'hobbies', 'interests'])
        .limit(3)

      const tagList = (tags ?? [])
        .flatMap(t => t.content.split(','))
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 3)

      return { user, tags: tagList, matchScore: userMatchCounts.get(user.id) ?? 0 }
    })
  )

  // Sort by match score
  results.sort((a, b) => b.matchScore - a.matchScore)

  return NextResponse.json({ results })
}
