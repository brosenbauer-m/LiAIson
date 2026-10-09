'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Avatar from '@/components/ui/Avatar'

interface RequestUser {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

interface ConnectionRequest {
  id: string
  created_at: string
  from_user: RequestUser | RequestUser[] | null
}

interface Props {
  requests: ConnectionRequest[]
  // Inner Circle only on plans with two circles (Ambivert / Extrovert).
  innerAllowed: boolean
}

const CIRCLE_OPTIONS: { inner: boolean; label: string; help: string }[] = [
  { inner: false, label: 'Outer Circle', help: 'They see what everyone sees.' },
  { inner: true, label: 'Inner Circle', help: 'They also see your Inner Circle.' },
]

export default function ConnectionRequests({ requests: initialRequests, innerAllowed }: Props) {
  const router = useRouter()
  const [requests, setRequests] = useState(initialRequests)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [choosingId, setChoosingId] = useState<string | null>(null)
  const [selectedInner, setSelectedInner] = useState(false)
  const [errorIds, setErrorIds] = useState<Set<string>>(new Set())

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds(previous => {
      const next = new Set(previous)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const respond = async (request: ConnectionRequest, accept: boolean, inner = false) => {
    setBusy(request.id, true)
    setErrorIds(previous => {
      const next = new Set(previous)
      next.delete(request.id)
      return next
    })

    try {
      const response = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: request.id, accept, inner }),
      })
      if (!response.ok) throw new Error('Failed to respond to request')

      setRequests(previous => previous.filter(item => item.id !== request.id))
      setChoosingId(null)
      if (accept) router.refresh()
    } catch {
      setErrorIds(previous => new Set(previous).add(request.id))
    } finally {
      setBusy(request.id, false)
    }
  }

  const handleAccept = (request: ConnectionRequest) => {
    if (!innerAllowed) {
      void respond(request, true)
      return
    }
    setChoosingId(request.id)
    setSelectedInner(false)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-text-primary">Requests</h2>
      <div className="space-y-3">
        {requests.map(request => {
          const fromUser = Array.isArray(request.from_user) ? request.from_user[0] : request.from_user
          const busy = busyIds.has(request.id)
          const choosing = choosingId === request.id

          return (
            <div key={request.id} className="bg-card border border-border rounded-xl p-5 shadow-soft space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar url={fromUser?.avatar_url} name={fromUser?.display_name} size="md" />
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{fromUser?.display_name ?? 'Unknown'}</p>
                    {fromUser && (
                      <Link href={`/${fromUser.username}`} className="text-xs text-accent hover:underline">
                        @{fromUser.username}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAccept(request)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respond(request, false)}
                    disabled={busy}
                    className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:border-accent/50 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Ignore
                  </button>
                </div>
              </div>

              {choosing && (
                <fieldset disabled={busy} className="space-y-3 border-t border-border pt-4">
                  <legend className="text-sm font-medium text-text-primary">
                    Which circle should @{fromUser?.username ?? 'this person'} join?
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {CIRCLE_OPTIONS.map(option => (
                      <label
                        key={option.label}
                        className={`cursor-pointer px-3 py-2 rounded-lg border text-sm transition-colors ${
                          selectedInner === option.inner
                            ? 'border-accent bg-accent-tint text-accent'
                            : 'border-border text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`circle-${request.id}`}
                          checked={selectedInner === option.inner}
                          onChange={() => setSelectedInner(option.inner)}
                          className="sr-only"
                        />
                        <span className="block font-medium">{option.label}</span>
                        <span className="block text-xs">{option.help}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void respond(request, true, selectedInner)}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium disabled:opacity-50"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setChoosingId(null)}
                      disabled={busy}
                      className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </fieldset>
              )}

              {errorIds.has(request.id) && (
                <p className="text-sm text-error" role="alert">Something went wrong. Please try again.</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}