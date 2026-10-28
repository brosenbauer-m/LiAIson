import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/access'
import { createCampaign, listCampaigns, parseCampaignInput, CouponInputError } from '@/lib/admin/coupons'

// Admin only: event code campaigns. GET ?archived=1 → list; POST → create
// (returns the codes once, for copying or the CSV export).

export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  try {
    const campaigns = await listCampaigns(request.nextUrl.searchParams.get('archived') === '1')
    return NextResponse.json({ campaigns }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('ADMIN_COUPONS_LIST_ERROR', err)
    return NextResponse.json({ error: 'Could not load the campaigns.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  try {
    const input = parseCampaignInput(await request.json().catch(() => null))
    const made = await createCampaign(adminId, input)
    return NextResponse.json(made)
  } catch (err) {
    if (err instanceof CouponInputError) return NextResponse.json({ error: err.message }, { status: 400 })
    console.error('ADMIN_COUPONS_CREATE_ERROR', err)
    return NextResponse.json({ error: 'The campaign could not be created.' }, { status: 500 })
  }
}
