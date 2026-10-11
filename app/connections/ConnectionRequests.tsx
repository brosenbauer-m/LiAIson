'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Avatar from '@/components/ui/Avatar'
import TierMark from '@/components/ui/TierMark'
import CirclePicker from '@/components/connections/CirclePicker'

// Connection requests to you: Accept (choosing the circle on tiers with
// circles; connections go both ways) or Ignore. `collapsible` shows them as a
// section that opens and closes (+ / −) and scrolls after 10 requests.

export interface RequestUser {
  id: string
  username: string
  display_name: string
  plan?: string | null
  avatar_url: string | null
}

export interface ConnectionRequest {
  id: string
  created_at: string
  from_user: RequestUser | RequestUser[] | null
}

const VISIBLE = 10
const ROW_PX = 76

export default function ConnectionRequests({
  requests: initialRequests,
  collapsible = false,
  title = 'Requests',
  compact = false,
  onChange,
}: {
  requests: ConnectionRequest[]
  collapsible?: boolean
  title?: string
  compact?: boolean
  onChange?: () => void
}) {
  const router = useRouter()
  const [requests, setRequests] = useState(initialRequests)
  const [open, setOpen] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [choosingId, setChoosingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  const respond = async (request: ConnectionRequest, accept: boolean, placement = 'outer') => {
    setBusyId(request.id)
    setErrorId(null)
    try {
      const response = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: request.id, accept, placement }),
      })
      if (!response.ok) throw new Error('failed')
      setRequests(prev => prev.filter(item => item.id !== request.id))
      setChoosingId(null)
      window.dispatchEvent(new Event('liaison:notifications-changed'))
      onChange?.()
      router.refresh()
    } catch {
      setErrorId(request.id)
    } finally {
      setBusyId(null)
    }
  }

  if (requests.length === 0) return null

  const list = (
    <ul
      className="space-y-2 overflow-y-auto pr-1"
      style={requests.length > VISIBLE ? { maxHeight: VISIBLE * ROW_PX } : undefined}
    >
      {requests.map(request => {
        const fromUser = Array.isArray(request.from_user) ? request.from_user[0] : request.from_user
        const busy = busyId === request.id
        return (
          <li key={request.id} className="bg-card border border-border rounded-2xl px-4 py-3 shadow-soft space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar url={fromUser?.avatar_url} name={fromUser?.display_name} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{fromUser?.display_name ?? 'Unknown'} <TierMark plan={fromUser?.plan} /></p>
                  {fromUser && <Link href={`/${fromUser.username}`} className="text-xs text-accent hover:underline">@{fromUser.username}</Link>}
                </div>
              </div>
              {choosingId !== request.id && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setChoosingId(request.id)}
                    disabled={busy}
                    className="px-4 py-1.5 rounded-full bg-accent hover:bg-accent-light text-white text-sm font-medium disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respond(request, false)}
                    disabled={busy}
                    className="px-4 py-1.5 rounded-full border border-border text-text-secondary hover:border-accent/50 text-sm font-medium disabled:opacity-50"
                  >
                    Ignore
                  </button>
                </div>
              )}
            </div>
            {choosingId === request.id && (
              <div className="border-t border-border pt-3">
                <CirclePicker
                  title={`Add ${fromUser?.display_name ?? 'them'} to which circle?`}
                  busy={busy}
                  onPick={placement => void respond(request, true, placement)}
                  onCancel={() => setChoosingId(null)}
                />
              </div>
            )}
            {errorId === request.id && <p className="text-sm text-error" role="alert">Something went wrong. Please try again.</p>}
          </li>
        )
      })}
    </ul>
  )

  if (!collapsible) {
    return (
      <section className="space-y-3">
        <h2 className={compact ? 'text-sm font-semibold text-text-primary' : 'text-xl font-semibold text-text-primary'}>{title} <span className="text-text-muted font-normal tabular-nums">{requests.length}</span></h2>
        {list}
      </section>
    )
  }

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-3 shadow-soft text-left"
      >
        <span className="text-lg font-semibold text-text-primary">
          {title} <span className="text-text-muted font-normal tabular-nums">{requests.length}</span>
        </span>
        <span className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-text-secondary text-lg leading-none" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      {open && list}
    </section>
  )
}
