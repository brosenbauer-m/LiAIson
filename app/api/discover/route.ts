import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// Username / name search for the Discover page.
// Only returns discoverable users and only safe public columns.
// Never returns vault content, scopes, ids or any other user data.

const MAX_QUERY_LENGTH = 50
const MAX_RESULTS = 8

type SearchResult = {
  username: string
  display_name: string
  avatar_url: string | null
}

// Escape characters that have a special meaning inside ILIKE patterns.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, char => `\\${char}`)
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('q') ?? ''
  // PostgREST treats * as a wildcard, so drop it; also drop a leading @.
  const query = raw.replace(/\*/g, '').trim().replace(/^@+/, '').slice(0, MAX_QUERY_LENGTH)

  if (query.length === 0) {
    return NextResponse.json({ results: [] })
  }

  const supabase = createServiceClient()
  const pattern = escapeLike(query)

  // 1) Usernames that start with the query (best matches first).
  const { data: byUsername, error: usernameError } = await supabase
    .from('users')
    .select('username, display_name, avatar_url')
    .eq('is_discoverable', true)
    .ilike('username', `${pattern}%`)
    .order('username', { ascending: true })
    .limit(MAX_RESULTS)

  // 2) Display names that contain the query anywhere.
  const { data: byName, error: nameError } = await supabase
    .from('users')
    .select('username, display_name, avatar_url')
    .eq('is_discoverable', true)
    .ilike('display_name', `%${pattern}%`)
    .order('display_name', { ascending: true })
    .limit(MAX_RESULTS)

  if (usernameError || nameError) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  const seen = new Set<string>()
  const results: SearchResult[] = []
  for (const row of [...(byUsername ?? []), ...(byName ?? [])] as SearchResult[]) {
    if (!row.username || seen.has(row.username)) continue
    seen.add(row.username)
    results.push({
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_url,
    })
    if (results.length >= MAX_RESULTS) break
  }

  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
