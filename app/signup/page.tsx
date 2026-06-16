'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { RESERVED_USERNAMES, USERNAME_REGEX } from '@/lib/constants/username'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const checkUsername = useCallback(async (val: string) => {
    if (!val) { setUsernameStatus('idle'); return }
    if (!USERNAME_REGEX.test(val) || RESERVED_USERNAMES.includes(val)) {
      setUsernameStatus('invalid')
      return
    }
    setUsernameStatus('checking')
    const supabase = createClient()
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('username', val)
      .limit(1)
    setUsernameStatus(data && data.length > 0 ? 'taken' : 'available')
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

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, username },
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Insert user profile
      await supabase.from('users').insert({
        id: data.user.id,
        username,
        display_name: displayName,
        is_discoverable: false,
        discover_mode: 'all',
        contact_links: [],
      })

      // Create default vault sections
      const defaultSections = [
        { domain: 'professional', section_type: 'current_role', label: 'Current Role' },
        { domain: 'professional', section_type: 'skills', label: 'Skills & Expertise' },
        { domain: 'professional', section_type: 'work_history', label: 'Work History' },
        { domain: 'professional', section_type: 'education', label: 'Education' },
        { domain: 'professional', section_type: 'projects', label: 'Projects & Publications' },
        { domain: 'professional', section_type: 'opportunities', label: 'Open to Opportunities' },
        { domain: 'personal', section_type: 'bio', label: 'About Me' },
        { domain: 'personal', section_type: 'hobbies', label: 'Hobbies & Interests' },
        { domain: 'personal', section_type: 'location', label: 'Location' },
        { domain: 'personal', section_type: 'looking_for', label: 'Looking For' },
        { domain: 'personal', section_type: 'values', label: 'Values & Personality' },
        { domain: 'personal', section_type: 'lifestyle', label: 'Lifestyle' },
      ]

      await supabase.from('vault_sections').insert(
        defaultSections.map(s => ({
          ...s,
          user_id: data.user!.id,
          content: '',
          visibility: 'public',
          source: 'manual',
        }))
      )

      router.push('/vault?welcome=1')
    }
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
          <h1 className="text-2xl font-bold text-text-primary mt-4">Create your LiAIson</h1>
          <p className="text-text-secondary mt-2">Set up your personal AI representative</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
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
        </div>
      </div>
    </div>
  )
}
