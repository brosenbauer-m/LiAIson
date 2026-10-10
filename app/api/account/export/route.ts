import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { underLimit } from '@/lib/redis'

// "Download my data" (GDPR right of access / portability): everything stored
// about the signed-in person, as one JSON file. Other people appear only by
// username and display name. Payment provider ids are left out.

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  if (!(await underLimit(`export:${user.id}`, 5, 3600))) {
    return NextResponse.json({ error: 'Please try again in an hour.' }, { status: 429 })
  }

  const s = createServiceClient()
  const id = user.id
  const person = 'username, display_name'
  const [
    profile, sections, folders, outgoing, incoming, circles, planChanges, documents, balance, reports, notifications,
  ] = await Promise.all([
    s.from('users').select('username, display_name, short_bio, avatar_url, contact_links, public_scope, is_discoverable, report_emails, monthly_spend_limit_cents, trial_ends_at, plan, plan_options, created_at').eq('id', id).single(),
    s.from('vault_sections').select('label, section_type, content, circle, custom_circle_id, source, updated_at').eq('user_id', id).order('domain'),
    s.from('vault_folders').select('name, color, created_at').eq('user_id', id),
    s.from('connection_interests').select(`status, created_at, to_user:users!connection_interests_to_user_id_fkey(${person})`).eq('from_user_id', id),
    s.from('connection_interests').select(`status, in_inner_circle, created_at, from_user:users!connection_interests_from_user_id_fkey(${person})`).eq('to_user_id', id),
    s.from('custom_circles').select(`id, name, created_at, custom_circle_members(member:users(${person}))`).eq('owner_id', id),
    s.from('plan_changes').select('from_plan, to_plan, options, effective_at').eq('user_id', id).order('effective_at'),
    s.from('billing_documents').select('kind, receipt_number, period_start, period_end, usage_eur, plan, plan_fee_eur, net_eur, vat_eur, total_eur, status, created_at, paid_at').eq('user_id', id).order('created_at'),
    s.from('billing_balance_entries').select('amount_eur, kind, created_at').eq('user_id', id).order('created_at'),
    s.from('visitor_reports').select('period_type, period_start, period_end, total, report, created_at').eq('profile_user_id', id).order('period_start'),
    s.from('notifications').select('type, message, read, created_at').eq('user_id', id).order('created_at'),
  ])

  const data = {
    exported_at: new Date().toISOString(),
    account: { email: user.email, created_at: user.created_at },
    profile: profile.data,
    vault: { sections: sections.data ?? [], folders: folders.data ?? [] },
    connections: { you_connected_to: outgoing.data ?? [], connected_to_you: incoming.data ?? [] },
    own_circles: circles.data ?? [],
    plan_history: planChanges.data ?? [],
    bills_and_receipts: documents.data ?? [],
    prepaid_balance: balance.data ?? [],
    echoes: reports.data ?? [],
    notifications: notifications.data ?? [],
  }

  const day = new Date().toISOString().slice(0, 10)
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="liaison-data-${day}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
