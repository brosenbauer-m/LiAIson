'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Toggle from '@/components/ui/Toggle'
import { echoAllowed, isPlanId, type PlanId } from '@/lib/plans'

// "Email me my Echoes": Monthly and Weekly switches (users.report_emails_*),
// on the Echoes page and in the dashboard's Echoes widget. A switch the tier
// doesn't include is greyed out with an upgrade note.
export default function EchoEmailSettings({ compact = false }: { compact?: boolean }) {
  const [userId, setUserId] = useState<string | null>(null)
  const [plan, setPlan] = useState<PlanId | null>(null)
  const [emails, setEmails] = useState({ weekly: true, monthly: true })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [{ data }, planRes] = await Promise.all([
        supabase.from('users').select('report_emails_weekly, report_emails_monthly').eq('id', user.id).single(),
        fetch('/api/plan', { cache: 'no-store' }).catch(() => null),
      ])
      if (data) setEmails({ weekly: data.report_emails_weekly !== false, monthly: data.report_emails_monthly !== false })
      const p = planRes?.ok ? ((await planRes.json()) as { plan?: string }).plan : null
      setPlan(isPlanId(p) ? p : 'introvert')
    }
    void load()
  }, [])

  const toggle = async (which: 'weekly' | 'monthly') => {
    if (!userId) return
    const next = !emails[which]
    setEmails(prev => ({ ...prev, [which]: next }))
    const { error } = await createClient().from('users').update({ [`report_emails_${which}`]: next }).eq('id', userId)
    if (error) setEmails(prev => ({ ...prev, [which]: !next }))
  }

  if (!plan) return null
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <p className="text-sm text-text-secondary">
        Email me my Echoes.{!compact && <> <Link href="/#echoes" className="text-accent hover:underline font-medium">Learn More</Link></>}
      </p>
      <div className={compact ? 'flex flex-wrap gap-x-6 gap-y-2' : 'space-y-3'}>
        {(['monthly', 'weekly'] as const).map(which => {
          const allowed = echoAllowed(plan, which === 'weekly' ? 'week' : 'month')
          return (
            <div key={which} className={`flex items-center justify-between gap-4 ${allowed ? '' : 'opacity-60'} ${compact ? 'min-w-[9rem]' : ''}`}>
              <div>
                <p className="text-sm font-medium text-text-primary">{which === 'weekly' ? 'Weekly' : 'Monthly'}</p>
                {!allowed && (
                  <Link href="/settings#subscription" className="text-xs italic text-text-muted hover:text-accent">
                    Upgrade to a higher tier for this feature
                  </Link>
                )}
              </div>
              <Toggle
                checked={allowed && emails[which]}
                onChange={() => toggle(which)}
                disabled={!allowed}
                label={`Email me my ${which} Echoes`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
