import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, isAdminUser } from '@/lib/admin/access'
import { createServiceClient } from '@/lib/supabase/service'

// Admin only: change one account.
// PATCH { exempt?: boolean, extendDays?: number, blocked?: boolean }
// - exempt: never billed (same flag as the owner's own accounts);
// - extendDays: the free month ends that many days later than now (or than
//   its current end, whichever is later);
// - blocked: the person can't sign in (their data stays; unblock any time).

const UUID = /^[0-9a-f-]{36}$/

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin()
  if (!adminId) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const { id } = await ctx.params
  if (!UUID.test(id) || id === adminId || (await isAdminUser(id))) return NextResponse.json({ error: 'Unknown account' }, { status: 404 })
  const body = (await request.json().catch(() => ({}))) as { exempt?: unknown; extendDays?: unknown; blocked?: unknown }
  const supabase = createServiceClient()
  try {
    if (typeof body.exempt === 'boolean') {
      const { error } = await supabase.from('users').update({ billing_exempt: body.exempt }).eq('id', id)
      if (error) throw new Error(error.message)
    }
    if (typeof body.extendDays === 'number' && Number.isInteger(body.extendDays) && body.extendDays >= 1 && body.extendDays <= 365) {
      const { data: row } = await supabase.from('users').select('trial_ends_at').eq('id', id).maybeSingle<{ trial_ends_at: string }>()
      const base = Math.max(Date.now(), row ? new Date(row.trial_ends_at).getTime() : 0)
      const { error } = await supabase.from('users').update({ trial_ends_at: new Date(base + body.extendDays * 86400_000).toISOString() }).eq('id', id)
      if (error) throw new Error(error.message)
    }
    if (typeof body.blocked === 'boolean') {
      const { error } = await supabase.auth.admin.updateUserById(id, { ban_duration: body.blocked ? '876000h' : 'none' })
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('ADMIN_ACCOUNT_UPDATE_ERROR', err)
    return NextResponse.json({ error: 'The change could not be saved.' }, { status: 500 })
  }
}
