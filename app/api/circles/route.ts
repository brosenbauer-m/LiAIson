import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getPlanLimits } from '@/lib/billing/plan'

// The signed-in owner's own circles (Social Butterfly; see lib/circles.ts).
// GET → { extraCircles, innerAllowed, circles: [{ id, name, parent_id, in_inner, memberIds }] }
// POST { name } → create · PATCH { id, name } → rename
// PATCH { id, parent: 'outer' | 'inner' | <circle id> } → move (circles are
// nested: members also see every circle around theirs; the database refuses
// loops, other people's circles and more than 4 levels, migration 30)
// DELETE { id } → delete: circles inside it move up one level, its sections
// become drafts (done by the database).
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
      supabase.from('custom_circles').select('id, name, parent_id, in_inner').eq('owner_id', userId).order('created_at', { ascending: true }),
    ])
    if (error) throw new Error(error.message)
    const list = (circles as { id: string; name: string; parent_id: string | null; in_inner: boolean }[] | null) ?? []
    const { data: members } = list.length
      ? await supabase.from('custom_circle_members').select('circle_id, member_id').in('circle_id', list.map(c => c.id))
      : { data: [] }
    const byCircle = new Map<string, string[]>()
    for (const m of (members as { circle_id: string; member_id: string }[] | null) ?? []) {
      byCircle.set(m.circle_id, [...(byCircle.get(m.circle_id) ?? []), m.member_id])
    }
    return NextResponse.json(
      { extraCircles: limits.extraCircles, innerAllowed: limits.circles === 2, circles: list.map(c => ({ ...c, memberIds: byCircle.get(c.id) ?? [] })) },
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
      { error: `Your plan allows ${limits.extraCircles} circles of your own. You can allow more in Settings → Subscription.` },
      { status: 409 }
    )
  }
  const { data, error } = await supabase.from('custom_circles').insert({ owner_id: userId, name }).select('id, name, parent_id, in_inner').single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'You already have a circle with this name.' }, { status: 409 })
    console.error('CIRCLE_CREATE_ERROR', error.message)
    return NextResponse.json({ error: 'Could not create the circle. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ circle: { ...data, memberIds: [] } })
}

const MOVE_ERRORS: Record<string, string> = {
  CIRCLE_PARENT_LOOP: "A circle can't go inside a circle that is inside it.",
  CIRCLE_TOO_DEEP: 'Circles can be nested at most 4 deep.',
  CIRCLE_PARENT_INVALID: 'Circle not found',
}

export async function PATCH(request: NextRequest) {
  const userId = await ownerId()
  if (!userId) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const body = await request.json().catch(() => null) as { id?: unknown; name?: unknown; parent?: unknown } | null
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const supabase = createServiceClient()

  // Move into the Outer Circle, the Inner Circle or another own circle.
  if (body.parent !== undefined) {
    const parent = body.parent
    if (parent !== 'outer' && parent !== 'inner' && !isUuid(parent)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    if (parent === body.id) return NextResponse.json({ error: MOVE_ERRORS.CIRCLE_PARENT_LOOP }, { status: 409 })
    const limits = await getPlanLimits(userId)
    if (limits.extraCircles <= 0) {
      return NextResponse.json({ error: 'Your own circles are part of Social Butterfly.', locked: true }, { status: 403 })
    }
    if (parent === 'inner' && limits.circles !== 2) return NextResponse.json({ error: 'Your plan has no Inner Circle.' }, { status: 403 })
    const fields = isUuid(parent) ? { parent_id: parent, in_inner: false } : { parent_id: null, in_inner: parent === 'inner' }
    const { data, error } = await supabase
      .from('custom_circles')
      .update(fields)
      .eq('id', body.id)
      .eq('owner_id', userId)
      .select('id, name, parent_id, in_inner')
      .maybeSingle()
    if (error) {
      const known = Object.keys(MOVE_ERRORS).find(code => error.message?.includes(code))
      if (known) return NextResponse.json({ error: MOVE_ERRORS[known] }, { status: known === 'CIRCLE_PARENT_INVALID' ? 404 : 409 })
      console.error('CIRCLE_MOVE_ERROR', error.message)
      return NextResponse.json({ error: 'Could not move the circle. Please try again.' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
    return NextResponse.json({ circle: data })
  }

  const name = cleanName(body.name)
  if (!name) return NextResponse.json({ error: `Please give the circle a name of up to ${MAX_NAME} characters.` }, { status: 400 })
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
  // Circles inside it move up one level (to where it sat). If this step were
  // skipped they would land directly in the Outer Circle, which shows less.
  const { data: circle } = await supabase
    .from('custom_circles')
    .select('parent_id, in_inner')
    .eq('id', body.id)
    .eq('owner_id', userId)
    .maybeSingle<{ parent_id: string | null; in_inner: boolean }>()
  if (!circle) return NextResponse.json({ error: 'Circle not found' }, { status: 404 })
  const { error: moveError } = await supabase
    .from('custom_circles')
    .update({ parent_id: circle.parent_id, in_inner: circle.parent_id ? false : circle.in_inner })
    .eq('parent_id', body.id)
    .eq('owner_id', userId)
  if (moveError) return NextResponse.json({ error: 'Could not delete the circle. Please try again.' }, { status: 500 })
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
