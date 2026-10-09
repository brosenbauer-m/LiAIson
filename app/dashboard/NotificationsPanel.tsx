'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import NotificationItem from '@/components/ui/NotificationItem'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/types'

interface Props {
  initialNotifications: Notification[]
}

export default function NotificationsPanel({ initialNotifications }: Props) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const supabase = createClient()

  const handleDismiss = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  if (notifications.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-soft">
        <div className="text-5xl mb-4">✨</div>
        <p className="text-text-secondary text-base">You&apos;re all caught up!</p>
        <p className="text-text-muted text-sm mt-1">Check back later for new updates</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notifications.map(n => (
        <NotificationItem
          key={n.id}
          notification={n}
          onDismiss={handleDismiss}
          onAction={n.type === 'connection_interest' ? () => router.push('/connections') : undefined}
          actionLabel={n.type === 'connection_interest' ? 'Review →' : undefined}
        />
      ))}
    </div>
  )
}
