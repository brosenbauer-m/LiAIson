'use client'

import { useState } from 'react'
import Link from 'next/link'

// Ask for a password reset link (sent by email; see /api/auth/forgot).
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setError(data.error ?? 'Something went wrong. Please try again.')
      else setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-3xl text-accent">LiAIson</Link>
          <h1 className="text-2xl font-display font-medium tracking-tight text-text-primary mt-4">Forgot your password?</h1>
          <p className="text-text-secondary mt-2">We&apos;ll email you a link to choose a new one.</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8">
          {sent ? (
            <div className="space-y-4 text-center">
              <p className="text-text-primary">If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.</p>
              <p className="text-sm text-text-secondary">The link works for one hour. Check your spam folder if you don&apos;t see it.</p>
              <Link href="/login" className="inline-block text-accent hover:underline text-sm">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/60"
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="text-sm text-error" role="alert">{error}</p>}
              <button type="submit" disabled={busy} className="w-full py-3 bg-accent hover:bg-accent-light text-white font-semibold rounded-lg disabled:opacity-50">
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <p className="text-center text-sm text-text-secondary">
                <Link href="/login" className="text-accent hover:underline">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
