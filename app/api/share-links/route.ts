import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('share_links')
    .select('id, scope, token, created_at, revoked_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to load links' }, { status: 500 })
  return NextResponse.json({ links: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const scope = typeof body === 'object' && body !== null && 'scope' in body
    ? body.scope
    : null

  if (scope !== 'professional' && scope !== 'personal' && scope !== 'both') {
    return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
  }

  const token = randomBytes(16).toString('hex')
  const { data, error } = await supabase
    .from('share_links')
    .insert({ user_id: user.id, scope, token })
    .select('id, scope, token, created_at, revoked_at')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
  return NextResponse.json({ link: data })
}