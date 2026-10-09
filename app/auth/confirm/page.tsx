'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

// Email links land here (Supabase email templates point to
// /auth/confirm?token_hash=…&type=…). Nothing is confirmed until the person
// clicks the button, so email link scanners that open every link can't
// confirm an account by themselves.

const TYPES: EmailOtpType[] = ['email', 'signup', 'email_change', 'recovery', 'invite', 'magiclink']

type ConfirmLink = { tokenHash: string; type: EmailOtpType; next: string }

function safeNext(value: string | null, type: EmailOtpType): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) return value
  return type === 'email_change' ? '/settings?email=changed' : '/vault?welcome=1'
}

export default function ConfirmPage() {
  const router = useRouter()
  const [link, setLink] = useState<ConfirmLink | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tokenHash = params.get('token_hash')
    const type = params.get('type') as EmailOtpType | null
    const timer = setTimeout(() => {
      if (!tokenHash || !type || !TYPES.includes(type)) setInvalid(true)
      else setLink({ tokenHash, type, next: safeNext(params.get('next'), type) })
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const confirm = async () => {
    if (!link) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
    if (verifyError) {
      setError('This link has expired or was already used. Please sign in, or request a new email.')
      setBusy(false)
      return
    }
    router.push(link.next)
    router.refresh()
  }

  const title = link?.type === 'email_change' ? 'Confirm your new email' : 'Confirm your email'

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-3xl text-accent">LiAIson</Link>
          <h1 className="text-2xl font-display font-medium tracking-tight text-text-primary mt-4">{title}</h1>
        </div>
        <div className="bg-card border border-border rounded-2xl p-8 space-y-5">
          {invalid ? (
            <p className="text-sm text-text-secondary">
              This link is not complete. Please open the link from your email again, or{' '}
              <Link href="/login" className="text-accent-light hover:underline">sign in</Link>.
            </p>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                {link?.type === 'email_change'
                  ? 'Click the button to confirm this email address for your LiAIson account.'
                  : 'Click the button to confirm your email address and open your LiAIson.'}
              </p>
              {error && (
                <div className="text-error text-sm bg-error/10 border border-error/30 rounded-lg px-3 py-2" role="alert">
                  {error}{' '}
                  <Link href="/login" className="underline">Sign in</Link>
                </div>
              )}
              <button
                type="button"
                onClick={confirm}
                disabled={!link || busy}
                className="w-full py-3 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {busy ? 'Confirming…' : 'Confirm'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
