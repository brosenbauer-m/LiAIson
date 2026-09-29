'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props {
  ownerId: string
  username: string
  displayName: string
  signedIn: boolean
}

type Status = 'loading' | 'none' | 'requested' | 'connected' | 'self' | 'signed_out'

export default function PrivateProfileCard({ ownerId, username, displayName, signedIn }: Props) {
  const [status, setStatus] = useState<Status>(signedIn ? 'loading' : 'signed_out')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!signedIn) return
    fetch(`/api/connections/status?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(d => setStatus((d.status as Status) ?? 'none'))
      .catch(() => setStatus('none'))
  }, [signedIn, username])

  const handleConnect = async () => {
    setError('')
    setStatus('loading')
    try {
      const res = await fetch('/api/connections/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: ownerId }),
      })
      if (!res.ok) {
        setStatus('none')
        setError('Something went wrong. Please try again.')
        return
      }
      const data = await res.json()
      setStatus(data.status === 'connected' ? 'connected' : data.status === 'requested' ? 'requested' : 'none')
    } catch {
      setStatus('none')
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-card p-8 text-center flex flex-col items-center justify-center gap-4" style={{ minHeight: '320px' }}>
      <div className="w-12 h-12 rounded-full bg-accent-tint flex items-center justify-center" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-accent">
          <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
        </svg>
      </div>
      <div>
        <p className="font-semibold text-text-primary text-lg">This LiAIson is private.</p>
        <p className="text-sm text-text-secondary mt-1">
          {status === 'signed_out'
            ? `Sign up or log in to connect with ${displayName}.`
            : status === 'requested'
            ? `Your request was sent. You can chat once ${displayName} accepts.`
            : `Connect to chat with ${displayName}'s LiAIson.`}
        </p>
      </div>

      {status === 'signed_out' ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft"
          >
            Sign up
          </Link>
          <Link
            href={`/login?redirect=/${encodeURIComponent(username)}`}
            className="px-5 py-2.5 border-2 border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg transition-all"
          >
            Log in
          </Link>
        </div>
      ) : status === 'self' || status === 'connected' ? null : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={status === 'loading' || status === 'requested'}
          className={`px-6 py-2.5 text-sm rounded-lg font-medium transition-all shadow-soft disabled:cursor-default ${
            status === 'requested'
              ? 'bg-accent-subtle text-accent border border-accent/30'
              : 'bg-accent hover:bg-accent-light text-white disabled:opacity-60'
          }`}
        >
          {status === 'requested' ? 'Requested' : status === 'loading' ? '...' : 'Connect'}
        </button>
      )}

      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </div>
  )
}
