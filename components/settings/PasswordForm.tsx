'use client'

import { useState } from 'react'
import Link from 'next/link'

// Settings → Account → Password: needs the current password; other devices
// are signed out after a change (see /api/account/password).
const input = 'w-full bg-background border border-border rounded-lg px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent'

export default function PasswordForm() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    if (next.length < 8) return setStatus({ type: 'error', text: 'Your new password needs at least 8 characters.' })
    if (next !== repeat) return setStatus({ type: 'error', text: 'The two new passwords are not the same.' })
    setBusy(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setStatus({ type: 'error', text: data.error ?? 'Could not change your password.' })
        return
      }
      setStatus({ type: 'success', text: 'Password changed. Other devices were signed out.' })
      setCurrent(''); setNext(''); setRepeat(''); setOpen(false)
    } catch {
      setStatus({ type: 'error', text: 'Could not change your password.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-text-primary">Password</h3>
          <p className="text-sm text-text-secondary mt-0.5">Change the password you sign in with.</p>
        </div>
        {!open && (
          <button type="button" onClick={() => { setOpen(true); setStatus(null) }} className="px-4 py-2.5 border border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg whitespace-nowrap">
            Change password
          </button>
        )}
      </div>
      {open && (
        <form onSubmit={submit} className="space-y-3">
          <input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="Current password" aria-label="Current password" required className={input} />
          <input type="password" autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} placeholder="New password (at least 8 characters)" aria-label="New password" minLength={8} maxLength={72} required className={input} />
          <input type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} placeholder="Repeat new password" aria-label="Repeat new password" maxLength={72} required className={input} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg disabled:opacity-50">
              {busy ? 'Saving…' : 'Save new password'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setStatus(null) }} className="px-4 py-2.5 text-sm text-text-secondary">Cancel</button>
            <Link href="/forgot-password" className="ml-auto text-xs text-accent hover:underline">Forgot your current password?</Link>
          </div>
        </form>
      )}
      {status && <p className={`text-sm ${status.type === 'error' ? 'text-error' : 'text-success'}`} role={status.type === 'error' ? 'alert' : 'status'}>{status.text}</p>}
    </div>
  )
}
