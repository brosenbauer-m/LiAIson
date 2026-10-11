'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NotificationItem from '@/components/ui/NotificationItem'
import type { Notification } from '@/types'

// Header bell: shows how many unread notifications there are; a click opens
// "Notifications" with the list. Clicking the bell again, anywhere else, or
// pressing Escape closes it. Dismissing or opening a notification marks it as
// read. The number counts unread notifications that arrived since the list was
// last opened, and refreshes on every page change and whenever notifications
// change elsewhere (event `liaison:notifications-changed`).
const SEEN_KEY = 'liaison:notifications-seen'

function readSeen(): string {
  try { return localStorage.getItem(SEEN_KEY) ?? '' } catch { return '' }
}

export default function NotificationBell() {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [seen, setSeen] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20)
    setItems((data as Notification[] | null) ?? [])
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => { setSeen(readSeen()); void load() }, 0)
    return () => clearTimeout(timer)
  }, [load, pathname])

  useEffect(() => {
    const onChange = () => { void load() }
    window.addEventListener('liaison:notifications-changed', onChange)
    window.addEventListener('focus', onChange)
    return () => {
      window.removeEventListener('liaison:notifications-changed', onChange)
      window.removeEventListener('focus', onChange)
    }
  }, [load])

  const markSeen = () => {
    const now = new Date().toISOString()
    try { localStorage.setItem(SEEN_KEY, now) } catch { /* private mode */ }
    setSeen(now)
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const dismiss = async (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id))
    await createClient().from('notifications').update({ read: true }).eq('id', id)
  }

  const openItem = (n: Notification) => {
    setOpen(false)
    void dismiss(n.id)
    router.push('/dashboard#notifications')
  }

  const fresh = items.filter(n => !seen || Date.parse(n.created_at) > Date.parse(seen)).length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (!open) { void load(); markSeen() } setOpen(o => !o) }}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={fresh > 0 ? `Notifications (${fresh} new)` : 'Notifications'}
        className={`relative flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-medium ${open ? 'bg-accent-subtle text-text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-accent-tint'}`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
        </svg>
        {open && <span className="animate-message-in">Notifications</span>}
        {fresh > 0 && !open && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-white text-[10px] leading-4 text-center">
            {fresh > 9 ? '9+' : fresh}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-surface shadow-card p-2 animate-message-in z-50">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-text-secondary">You&apos;re all caught up.</p>
          ) : (
            <div className="space-y-2">
              {items.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onDismiss={dismiss}
                  onAction={n.type === 'connection_interest' ? openItem : undefined}
                  actionLabel={n.type === 'connection_interest' ? 'Review →' : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
