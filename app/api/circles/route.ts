import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'

// The signed-in owner's own circles (Social Butterfly; see lib/circles.ts).
// GET → { extraCircles, circles: [{ id, name, memberIds }] }
// POST { name } → create · PATCH { id, name } → rename · DELETE { id } → delete
// (its sections become drafts, done by the database).
// custom_circles is server-only: names and members are never shown to others.

const MAX_NAME = 40

async function ownerId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const name = value.replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= MAX_NAME ? name : null
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function GET() {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  try {
    const supabase = createServiceClient()
    const [limits, { data: circles, error }] = await Promise.all([
      getPlanLimits(userId),
      supabase.from('custom_circles').select('id, name').eq('owner_id', userId).order('created_at', { ascending: true }),
    ])
    if (error) throw new Error(error.message)
    const list = (circles as { id: string; name: string }[] | null) ?? []
    const { data: members } = list.length
      ? await supabase.from('custom_circle_members').select('circle_id, member_id').in('circle_id', list.map(c => c.id))
      : { data: [] }
    const byCircle = new Map<string, string[]>()
    for (const m of (members as { circle_id: string; member_id: string }[] | null) ?? []) {
      byCircle.set(m.circle_id, [...(byCircle.get(m.circle_id) ?? []), m.member_id])
    }
    return NextResponse.json(
      { extraCircles: limits.extraCircles, circles: list.map(c => ({ ...c, memberIds: byCircle.get(c.id) ?? [] })) },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('CIRCLES_GET_ERROR', err)
    return NextResponse.json({ error: 'Could not load your circles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await request.json().catch(() => null) as { name?: unknown } | null
  const name = cleanName(body?.name)
  if (!name) return NextResponse.json({ error: `Please give the circle a name of up to ${MAX_NAME} characters.` }, { status: 400 })

  const supabase = createServiceClient()
  const limits = await getPlanLimits(userId)
  if (limits.extraCircles <= 0) {
    return NextResponse.json({ error: 'Your own circles are part of Social Butterfly.', locked: true }, { status: 403 })
  }
  const { count } = await supabase.from('custom_circles').select('id', { count: 'exact', head: true }).eq('owner_id', userId)
  if ((count ?? 0) >= limits.extraCircles) {
    return NextResponse.json(
      { error: `Your plan allows ${limits.extraCircles} circles of your own. You can allow more on the Plans page.` },
      { status: 409 }
    )
  }
  const { data, error } = await supabase.from('custom_circles').insert({ owner_id: userId, name }).select('id, name').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You already have a circle with this name.' }, { status: 409 })
    console.error('CIRCLE_CREATE_ERROR', error.message)
    return NextResponse.json({ error: 'Could not create the circle. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ circle: { ...data, memberIds: [] } })
}

export async function PATCH(request: NextRequest) {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await request.json().catch(() => null) as { id?: unknown; name?: unknown } | null
  const name = cleanName(body?.name)
  if (!isUuid(body?.id) || !name) {
    return NextResponse.json({ error: `Please give the circle a name of up to ${MAX_NAME} characters.` }, { status: 400 })
  }
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('custom_circles')
    .update({ name })
    .eq('id', body.id)
    .eq('owner_id', userId)
    .select('id, name')
    .maybeSingle()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You already have a circle with this name.' }, { status: 409 })
    return NextResponse.json({ error: 'Could not rename the circle. Please try again.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
  return NextResponse.json({ circle: data })
}

export async function DELETE(request: NextRequest) {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await request.json().catch(() => null) as { id?: unknown } | null
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('custom_circles')
    .delete()
    .eq('id', body.id)
    .eq('owner_id', userId)
    .select('id')
  if (error) return NextResponse.json({ error: 'Could not delete the circle. Please try again.' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
  return NextResponse.json({ deleted: true })
}
