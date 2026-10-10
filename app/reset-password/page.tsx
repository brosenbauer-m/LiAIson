'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Choose a new password after opening a reset link (the link signs you in
// for this step; see /auth/confirm). Other devices are signed out afterwards.
export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setReady(!!data.user))
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Your new password needs at least 8 characters.')
    if (password !== repeat) return setError('The two passwords are not the same.')
    setBusy(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setBusy(false)
      setError(/weak|short/i.test(updateError.message) ? 'Please choose a stronger password.' : 'Could not change your password. Please request a new link.')
      return
    }
    await supabase.auth.signOut({ scope: 'others' }).catch(() => {})
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-3xl text-accent">LiAIson</Link>
          <h1 className="text-2xl font-display font-medium tracking-tight text-text-primary mt-4">Choose a new password</h1>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8">
          {ready === null && <p className="text-sm text-text-secondary">Loading…</p>}
          {ready === false && (
            <div className="space-y-4 text-center">
              <p className="text-text-primary">This reset link has expired or was already used.</p>
              <Link href="/forgot-password" className="inline-block text-accent hover:underline text-sm">Request a new link</Link>
            </div>
          )}
          {ready && (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <label htmlFor="pw" className="block text-sm font-medium text-text-primary mb-1.5">New password</label>
                <input id="pw" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} maxLength={72} required className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent/60" placeholder="At least 8 characters" />
              </div>
              <div>
                <label htmlFor="pw2" className="block text-sm font-medium text-text-primary mb-1.5">Repeat new password</label>
                <input id="pw2" type="password" autoComplete="new-password" value={repeat} onChange={e => setRepeat(e.target.value)} maxLength={72} required className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent/60" />
              </div>
              {error && <p className="text-sm text-error" role="alert">{error}</p>}
              <button type="submit" disabled={busy} className="w-full py-3 bg-accent hover:bg-accent-light text-white font-semibold rounded-lg disabled:opacity-50">
                {busy ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
