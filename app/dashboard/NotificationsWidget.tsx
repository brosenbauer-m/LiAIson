'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import NotificationItem from '@/components/ui/NotificationItem'
import ConnectionRequests, { type ConnectionRequest } from '../connections/ConnectionRequests'
import type { Notification } from '@/types'

// Dashboard → Notifications (under Echoes): connection requests, which can be
// accepted or ignored right here, and the other unread notifications.
export default function NotificationsWidget({ requests, notifications }: { requests: ConnectionRequest[]; notifications: Notification[] }) {
  const [items, setItems] = useState(notifications)
  const [requestCount, setRequestCount] = useState(requests.length)

  const dismiss = async (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id))
    await createClient().from('notifications').update({ read: true }).eq('id', id)
    window.dispatchEvent(new Event('liaison:notifications-changed'))
  }

  return (
    <div id="notifications" className="bg-card border border-border rounded-2xl p-6 shadow-soft space-y-5 scroll-mt-24">
      <h2 className="text-xl font-semibold text-text-primary">Notifications</h2>
      {requestCount === 0 && items.length === 0 && <p className="text-sm text-text-secondary">You&apos;re all caught up.</p>}
      <ConnectionRequests requests={requests} title="Connection Requests" compact onChange={() => setRequestCount(c => Math.max(0, c - 1))} />
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map(n => <NotificationItem key={n.id} notification={n} onDismiss={dismiss} />)}
        </div>
      )}
    </div>
  )
}
