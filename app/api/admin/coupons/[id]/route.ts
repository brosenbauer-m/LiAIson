import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/access'
import { campaignCodesCsv, setCampaign } from '@/lib/admin/coupons'

// Admin only: one campaign. PATCH { active?, archived? }; GET → CSV of its codes.

const UUID = /^[0-9a-f-]{36}$/

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown campaign' }, { status: 404 })
  const body = (await request.json().catch(() => ({}))) as { active?: unknown; archived?: unknown }
  try {
    await setCampaign(id, {
      active: typeof body.active === 'boolean' ? body.active : undefined,
      archived: typeof body.archived === 'boolean' ? body.archived : undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('ADMIN_COUPON_UPDATE_ERROR', err)
    return NextResponse.json({ error: 'The change could not be saved.' }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const { id } = await ctx.params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Unknown campaign' }, { status: 404 })
  try {
    const csv = await campaignCodesCsv(id)
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="codes-${id.slice(0, 8)}.csv"`, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('ADMIN_COUPON_EXPORT_ERROR', err)
    return NextResponse.json({ error: 'The export failed.' }, { status: 500 })
  }
}
