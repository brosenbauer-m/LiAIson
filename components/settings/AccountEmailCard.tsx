'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Settings card: shows the account email and lets the person change it.
// Supabase sends a confirmation link; the email only changes once confirmed
// (the link opens /auth/confirm, see the "Change email address" template).
export default function AccountEmailCard() {
  const [email, setEmail] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const changed = new URLSearchParams(window.location.search).get('email') === 'changed'
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
      setPendingEmail(user?.new_email ?? null)
      if (changed) {
        setMessage({ type: 'success', text: 'Your email address has been changed.' })
        window.history.replaceState(null, '', '/settings')
      }
    })
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const next = newEmail.trim().toLowerCase()
    if (!next || next === email?.toLowerCase()) {
      setMessage({ type: 'error', text: 'Please enter a different email address.' })
      return
    }
    setBusy(true)
    setMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/settings` }
    )
    setBusy(false)
    if (error) {
      setMessage({ type: 'error', text: error.message })
      return
    }
    setPendingEmail(next)
    setEditing(false)
    setNewEmail('')
    setMessage({
      type: 'success',
      text: `We sent a confirmation link to ${next}. Your email changes once you open it and confirm. Please also check your current inbox, as we may ask you to confirm there too.`,
    })
  }

  return (
    <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
      <h2 className="font-semibold text-text-primary text-lg">Email address</h2>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-primary break-all">{email ?? 'Loading...'}</p>
        {!editing && email && (
          <button
            type="button"
            onClick={() => { setEditing(true); setMessage(null) }}
            className="text-sm text-accent hover:underline shrink-0"
          >
            Change
          </button>
        )}
      </div>
      {pendingEmail && !editing && (
        <p className="text-xs text-text-secondary">Waiting for you to confirm {pendingEmail}.</p>
      )}
      {editing && (
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="new-email" className="block text-sm text-text-secondary">New email address</label>
          <input
            id="new-email"
            type="email"
            required
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
            placeholder="you@example.com"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send confirmation link'}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setNewEmail('') }}
              className="px-5 py-2 border-2 border-border text-text-primary text-sm font-medium rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className={`text-sm ${message.type === 'error' ? 'text-error' : 'text-success'}`} role={message.type === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
    </div>
  )
}
