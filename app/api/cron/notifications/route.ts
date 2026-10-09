import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { generateNotifications } from '@/lib/notifications'
import type { User } from '@/types'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Fails closed like the other cron routes: no secret configured = no access.
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all user IDs
  const { data: users, error } = await supabase
    .from('users')
    .select('id')

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }

  let processed = 0
  let errors = 0
  for (const user of (users as Pick<User, 'id'>[] | null) ?? []) {
    try {
      await generateNotifications(user.id)
      processed++
    } catch {
      errors++
    }
  }

  return NextResponse.json({ processed, errors })
}
