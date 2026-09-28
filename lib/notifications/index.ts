import { createServiceClient } from '@/lib/supabase/service'
import type { VaultSection, VisitorQueryLog, Notification } from '@/types'
import { sendEmail, isEmailConfigured, escapeHtml } from '@/lib/email/scaleway'

const SENSITIVE_PATTERNS = [
  /address/i, /phone/i, /financ/i, /explicit/i, /password/i, /ssn/i, /credit.?card/i
]

export async function generateNotifications(userId: string): Promise<void> {
  const supabase = createServiceClient()

  const notifications: Omit<Notification, 'id' | 'created_at'>[] = []

  // 1. Gap Detection
  const { data: sections } = await supabase
    .from('vault_sections')
    .select('*')
    .eq('user_id', userId)

  const defaultSections = (sections as VaultSection[] | null) ?? []

  for (const section of defaultSections) {
    if ((section.content?.length ?? 0) < 50) {
      // Check if a gap notification was sent in the last 14 days
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'gap_detection')
        .contains('metadata', { section_id: section.id })
        .gte('created_at', new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString())
        .limit(1)

      if (!existing || existing.length === 0) {
        notifications.push({
          user_id: userId,
          type: 'gap_detection',
          message: `Hey! You haven't told me about your ${section.label} yet — want to add it?`,
          metadata: { section_id: section.id, section_type: section.section_type },
          read: false,
        })
      }
    }
  }

  // 2. Query Surfacing
  const { data: queries } = await supabase
    .from('visitor_query_log')
    .select('*')
    .eq('profile_user_id', userId)
    .gte('count', 3)
    .eq('surfaced_to_owner', false)

  for (const query of (queries as VisitorQueryLog[] | null) ?? []) {
    const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(query.topic_cluster))
    if (!isSensitive) {
      notifications.push({
        user_id: userId,
        type: 'query_surfacing',
        message: `Visitors have been asking about '${query.topic_cluster}' — would you like to share that with your Maimoir?`,
        metadata: { query_id: query.id, topic: query.topic_cluster },
        read: false,
      })

      await supabase
        .from('visitor_query_log')
        .update({ surfaced_to_owner: true })
        .eq('id', query.id)
    }
  }

  // 3. Temporal Refresh
  const now = new Date()
  const professional180 = new Date(now.getTime() - 180 * 24 * 3600 * 1000).toISOString()
  const personal365 = new Date(now.getTime() - 365 * 24 * 3600 * 1000).toISOString()

  const staleProfessional = defaultSections.filter(
    s => s.domain === 'professional' &&
      s.last_confirmed_at &&
      s.last_confirmed_at < professional180 &&
      s.content && s.content.length > 0
  )
  const stalePersonal = defaultSections.filter(
    s => s.domain !== 'professional' &&
      s.last_confirmed_at &&
      s.last_confirmed_at < personal365 &&
      s.content && s.content.length > 0
  )

  for (const section of [...staleProfessional, ...stalePersonal]) {
    const snippet = section.content.substring(0, 60)
    notifications.push({
      user_id: userId,
      type: 'temporal_refresh',
      message: `You mentioned '${snippet}...' a while ago — is that still accurate?`,
      metadata: { section_id: section.id },
      read: false,
    })
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications)

    // Send email digest via Scaleway Transactional Email
    const { data: userData } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .single()

    if (userData && isEmailConfigured()) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId)
        const userEmail = authUser?.user?.email
        if (!userEmail) throw new Error('No email found for user')

        const count = notifications.length
        const plural = count > 1 ? 's' : ''
        const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`

        await sendEmail({
          from: { email: 'noreply@my-liaison.app', name: 'Maimoir' },
          to: userEmail,
          subject: 'Your Maimoir has some questions for you 👋',
          html: `<h2>Hi ${escapeHtml(userData.display_name ?? '')}!</h2><p>Your Maimoir has ${count} update${plural} for you.</p><ul>${notifications.map(n => `<li>${escapeHtml(n.message)}</li>`).join('')}</ul><p><a href="${dashboardUrl}">View your dashboard</a></p>`,
          text: `Hi ${userData.display_name ?? ''}!\n\nYour Maimoir has ${count} update${plural} for you:\n\n${notifications.map(n => `- ${n.message}`).join('\n')}\n\nView your dashboard: ${dashboardUrl}`,
        })
      } catch (e) {
        console.error('Email send failed:', e)
      }
    }
  }
}
