'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RESERVED_USERNAMES, USERNAME_REGEX } from '@/lib/constants/username'
import Toggle from '@/components/ui/Toggle'
import { PLANS, SIGNUP_PLAN_IDS, isPlanId, type PlanId } from '@/lib/plans'
import PlanFeatures from '@/components/plans/PlanFeatures'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [isDiscoverable, setIsDiscoverable] = useState(true)
  const [plan, setPlan] = useState<PlanId>('introvert')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signedInEmail, setSignedInEmail] = useState('')
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  // The account just created and waiting for email confirmation, so "Use a
  // different email" can undo it and keep everything else that was filled in.
  const [pending, setPending] = useState<{ userId: string; nonce: string } | null>(null)

  // Plan chosen on the plans page (/signup?plan=…).
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('plan')
    const timer = setTimeout(() => {
      if (isPlanId(fromUrl) && SIGNUP_PLAN_IDS.includes(fromUrl)) setPlan(fromUrl)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setSignedInEmail(data.user.email)
    })
  }, [])

  useEffect(() => {
    if (!checkingEmail || !email || !password) return

    const supabase = createClient()
    const startedAt = Date.now()
    let attemptInProgress = false

    const attemptContinue = async () => {
      if (attemptInProgress || Date.now() - startedAt >= 10 * 60 * 1000) return
      attemptInProgress = true
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData.session) {
          router.push('/vault?welcome=1')
          router.refresh()
          return
        }

        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (!authError && data.session) {
          router.push('/vault?welcome=1')
          router.refresh()
        }
      } catch {
        // Automatic continuation is intentionally silent; the user can retry manually.
      } finally {
        attemptInProgress = false
      }
    }

    const interval = window.setInterval(() => {
      if (Date.now() - startedAt >= 10 * 60 * 1000) {
        window.clearInterval(interval)
        return
      }
      void attemptContinue()
    }, 15000)
    const onFocus = () => { void attemptContinue() }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void attemptContinue()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [checkingEmail, email, password, router])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = window.setInterval(() => {
      setResendCooldown(current => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendCooldown])

  const checkUsername = useCallback(async (val: string) => {
    if (!val) { setUsernameStatus('idle'); return }
    if (!USERNAME_REGEX.test(val) || RESERVED_USERNAMES.includes(val)) {
      setUsernameStatus('invalid')
      return
    }
    setUsernameStatus('checking')
    try {
      const res = await fetch(`/api/username-available?u=${encodeURIComponent(val)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) { setUsernameStatus('idle'); return }
      setUsernameStatus(data.available ? 'available' : data.valid === false ? 'invalid' : 'taken')
    } catch {
      setUsernameStatus('idle')
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => checkUsername(username), 500)
    return () => clearTimeout(timer)
  }, [username, checkUsername])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ageConfirmed || !privacyAccepted) {
      setError('Please accept the required terms')
      return
    }
    if (usernameStatus !== 'available') {
      setError('Please choose a valid, available username')
      return
    }

    setError('')
    setLoading(true)
    const supabase = createClient()

    const { data: currentUserData } = await supabase.auth.getUser()
    if (currentUserData.user) {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        setError(signOutError.message)
        setLoading(false)
        return
      }
      setSignedInEmail('')
    }

    const nonce = crypto.randomUUID()
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, username, is_discoverable: isDiscoverable, plan, signup_nonce: nonce },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user?.identities?.length === 0) {
      setError('An account with this email may already exist. Try signing in, or reset your password.')
      setLoading(false)
      return
    }

    if (data.session) {
      router.push('/vault?welcome=1')
      router.refresh()
    } else if (data.user) {
      setPending({ userId: data.user.id, nonce })
      setCheckingEmail(true)
    }
    setLoading(false)
  }

  const handleConfirmedContinue = async () => {
    setError('')
    setConfirming(true)
    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message.toLowerCase().includes('not confirmed')
        ? 'Not confirmed yet — check your inbox and spam folder.'
        : authError.message)
      setConfirming(false)
      return
    }

    if (data.session) {
      router.push('/vault?welcome=1')
      router.refresh()
    }
    setConfirming(false)
  }

  const handleResend = async () => {
    setError('')
    setResending(true)
    const supabase = createClient()
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (resendError) {
      setError(resendError.message)
    } else {
      setResendCooldown(60)
    }
    setResending(false)
  }

  // Go back to the form with everything still filled in. The unconfirmed
  // account is removed first, so the username is free to use again.
  const handleDifferentEmail = async () => {
    setError('')
    if (pending) {
      try {
        await fetch('/api/auth/discard-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pending),
        })
      } catch {
        // If this fails, the unconfirmed account is removed automatically later.
      }
      setPending(null)
    }
    setCheckingEmail(false)
    setResendCooldown(0)
    void checkUsername(username)
  }

  const usernameIndicator = () => {
    if (usernameStatus === 'checking') return <span className="text-text-secondary">Checking...</span>
    if (usernameStatus === 'available') return <span className="text-success">✓ Available</span>
    if (usernameStatus === 'taken') return <span className="text-error">✗ Taken</span>
    if (usernameStatus === 'invalid') return <span className="text-error">✗ Invalid (lowercase letters, numbers, hyphens only, 3-30 chars, no reserved words)</span>
    return null
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-bold text-2xl text-accent-light">LiAIson</Link>
          <h1 className="text-2xl font-bold text-text-primary mt-4">{checkingEmail ? 'Check your email' : 'Create your LiAIson'}</h1>
          <p className="text-text-secondary mt-2">{checkingEmail ? 'Confirm your email to activate your account' : 'Set up your personal AI representative'}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {checkingEmail ? (
            <div className="space-y-5">
              <p className="text-sm text-text-secondary">
                We sent a confirmation link to {email}. Open it to activate your account. You can keep this page open — it will continue automatically once you&apos;ve confirmed.
              </p>

              {error && (
                <div className="text-error text-sm bg-error/10 border border-error/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleConfirmedContinue}
                disabled={confirming}
                className="w-full py-3 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {confirming ? 'Checking...' : "I've confirmed — continue"}
              </button>

              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                className="w-full py-3 border border-border text-text-primary font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {resending ? 'Sending...' : resendCooldown > 0 ? `Email sent (${resendCooldown}s)` : 'Resend email'}
              </button>

              <button
                type="button"
                onClick={handleDifferentEmail}
                className="w-full text-center text-accent-light hover:underline text-sm"
              >
                Use a different email
              </button>
            </div>
          ) : (
          <>
          {signedInEmail && (
            <p className="mb-5 text-sm text-text-secondary bg-surface border border-border rounded-lg px-3 py-2">
              You&apos;re currently signed in as {signedInEmail}. Creating a new account will sign you out of it.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase())}
                required
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
                placeholder="your-username"
              />
              <div className="text-xs mt-1">{usernameIndicator()}</div>
              {username && usernameStatus === 'available' && (
                <p className="text-xs text-text-secondary mt-1">Your profile: my-liaison.app/{username}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent/60"
                placeholder="Min. 8 characters"
              />
            </div>

            <fieldset>
              <legend className="block text-sm font-medium text-text-primary mb-1.5">Plan</legend>
              <div className="grid grid-cols-3 gap-2">
                {SIGNUP_PLAN_IDS.map(id => (
                  <label
                    key={id}
                    className={`cursor-pointer rounded-lg border px-3 py-2.5 text-center transition-all ${
                      plan === id ? 'border-accent bg-accent-tint' : 'border-border bg-surface hover:border-accent/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={id}
                      checked={plan === id}
                      onChange={() => setPlan(id)}
                      className="sr-only"
                    />
                    <span className="block text-sm font-medium text-text-primary">{PLANS[id].name}</span>
                    <span className="block text-xs text-text-secondary">{PLANS[id].feeEur === 0 ? 'Free' : `€${PLANS[id].feeEur}/month`}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-border bg-surface px-4 py-3 space-y-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {PLANS[plan].name}: {PLANS[plan].feeEur === 0 ? 'free' : `€${PLANS[plan].feeEur} per month`}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5">{PLANS[plan].tagline}</p>
                </div>
                <PlanFeatures plan={PLANS[plan]} />
                <p className="text-xs text-text-secondary leading-relaxed">
                  Tap a line to learn more. Your first month is free. After that, your plan continues automatically and you&apos;ll need to save a card. You can change your plan at any time.{' '}
                  <Link href="/plans" className="text-accent-light hover:underline" target="_blank">Compare all plans</Link>
                </p>
              </div>
            </fieldset>

            <div className="flex items-center justify-between gap-4 py-1">
              <p className="text-sm text-text-secondary">
                Let people find me on Discover: by my name, and (if my profile is Public) by what I share in my Outer Circle, using AI search. You can change this anytime in Settings.
              </p>
              <Toggle
                checked={isDiscoverable}
                onChange={() => setIsDiscoverable(!isDiscoverable)}
                label="Discoverable"
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={e => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                <span className="text-sm text-text-secondary">I am 18 or older</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={e => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                <span className="text-sm text-text-secondary">
                  I accept the{' '}
                  <Link href="/privacy" className="text-accent-light hover:underline" target="_blank">
                    privacy policy
                  </Link>
                </span>
              </label>
            </div>

            {error && (
              <div className="text-error text-sm bg-error/10 border border-error/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || usernameStatus !== 'available'}
              className="w-full py-3 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating your LiAIson...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-text-secondary text-sm mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-accent-light hover:underline">Sign in</Link>
          </p>
          </>
          )}
        </div>
      </div>
    </div>
  )
}
