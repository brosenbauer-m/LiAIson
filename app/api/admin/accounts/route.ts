import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/access'
import { listAccounts } from '@/lib/admin/stats'

// Admin only: every account with its billing state and this month's usage.
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  try {
    return NextResponse.json({ accounts: await listAccounts() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('ADMIN_ACCOUNTS_ERROR', err)
    return NextResponse.json({ error: 'Could not load the accounts.' }, { status: 500 })
  }
}
