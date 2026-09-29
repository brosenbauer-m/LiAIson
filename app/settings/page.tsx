'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Toggle from '@/components/ui/Toggle'

type PublicScope = 'none' | 'professional' | 'personal' | 'both'
type PublicLevel = 'professional' | 'personal' | 'both'

const PUBLIC_LEVEL_OPTIONS: { value: PublicLevel; label: string; description: string }[] = [
  { value: 'professional', label: 'Professional only', description: 'Anyone can talk to your professional LiAIson (uses your professional vault).' },
  { value: 'personal', label: 'Personal only', description: 'Anyone can talk to your personal LiAIson (uses your personal vault).' },
  { value: 'both', label: 'Both', description: 'Anyone can talk to both (uses your professional and personal vaults).' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [publicScope, setPublicScope] = useState<PublicScope>('none')
  const [lastPublicLevel, setLastPublicLevel] = useState<PublicLevel>('both')
  const [isDiscoverable, setIsDiscoverable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [discoverableSaving, setDiscoverableSaving] = useState(false)
  const [discoverableSuccess, setDiscoverableSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('users')
        .select('public_scope, is_discoverable')
        .eq('id', user.id)
        .single()
      if (data) {
        const scope = data.public_scope as PublicScope
        setPublicScope(scope)
        if (scope !== 'none') setLastPublicLevel(scope)
        setIsDiscoverable(data.is_discoverable)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSaveScope = async (scope: PublicScope) => {
    if (!userId) return
    setSaving(true)
    setPublicScope(scope)
    if (scope !== 'none') setLastPublicLevel(scope)
    const { error } = await supabase
      .from('users')
      .update({ public_scope: scope })
      .eq('id', userId)
    setSaving(false)
    if (!error) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  const handleSelectVisibility = (visibility: 'public' | 'private') => {
    if (visibility === 'private') {
      handleSaveScope('none')
    } else {
      handleSaveScope(lastPublicLevel)
    }
  }

  const handleToggleDiscoverable = async () => {
    if (!userId) return
    const next = !isDiscoverable
    setDiscoverableSaving(true)
    setIsDiscoverable(next)
    const { error } = await supabase
      .from('users')
      .update({ is_discoverable: next })
      .eq('id', userId)
    setDiscoverableSaving(false)
    if (!error) {
      setDiscoverableSuccess(true)
      setTimeout(() => setDiscoverableSuccess(false), 3000)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setDeleteError('')

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: unknown } | null
        setDeleteError(typeof result?.error === 'string' ? result.error : 'Something went wrong. Please try again.')
        setDeleting(false)
        return
      }

      await supabase.auth.signOut({ scope: 'local' })
      router.push('/')
      router.refresh()
    } catch {
      setDeleteError('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-4xl font-bold text-text-primary">Settings</h1>

        <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
          <h2 className="font-semibold text-text-primary text-lg">Who can talk to your LiAIson</h2>
          {loading ? (
            <p className="text-sm text-text-secondary">Loading...</p>
          ) : (
            <div className="space-y-5">
              <div className="flex rounded-lg border-2 border-border overflow-hidden">
                <button
                  onClick={() => handleSelectVisibility('public')}
                  disabled={saving}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                    publicScope !== 'none' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-accent-tint'
                  }`}
                >
                  Public
                </button>
                <button
                  onClick={() => handleSelectVisibility('private')}
                  disabled={saving}
                  className={`flex-1 py-2.5 text-sm font-medium transition-all ${
                    publicScope === 'none' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-accent-tint'
                  }`}
                >
                  Private
                </button>
              </div>

              {publicScope !== 'none' ? (
                <div className="space-y-3">
                  {PUBLIC_LEVEL_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => handleSaveScope(opt.value)}
                      disabled={saving}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        publicScope === opt.value
                          ? 'border-accent bg-accent-tint'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-medium text-text-primary">{opt.label}</div>
                          <div className="text-sm text-text-secondary">{opt.description}</div>
                        </div>
                        {publicScope === opt.value && (
                          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white" aria-label="Selected">
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                              <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.5 7.55a1 1 0 0 1-1.42 0l-3.5-3.53a1 1 0 1 1 1.42-1.408l2.79 2.813 6.79-6.834a1 1 0 0 1 1.414-.006Z" clipRule="evenodd" />
                            </svg>
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  <p className="text-sm text-text-secondary leading-relaxed">
                    Visitors without an account can send up to 3 messages.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary leading-relaxed">
                  Only your connections can talk to your LiAIson. When you accept a connection request, you choose what they can access — you can change it anytime on the{' '}
                  <Link href="/connections" className="text-accent hover:underline">Connections page</Link>.
                </p>
              )}

              <p className="text-sm text-text-secondary leading-relaxed">
                People you&apos;ve already connected with keep the access you gave them.
              </p>
            </div>
          )}
          {success && (
            <div className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-4 py-3 font-medium">
              Saved ✓
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
          <h2 className="font-semibold text-text-primary text-lg">Discoverable</h2>
          {loading ? (
            <p className="text-sm text-text-secondary">Loading...</p>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-text-secondary leading-relaxed">
                When on, people can find you by searching in LiAIson. When off, your profile can only be reached through your link.
              </p>
              <Toggle
                checked={isDiscoverable}
                onChange={handleToggleDiscoverable}
                disabled={discoverableSaving}
                label="Discoverable"
              />
            </div>
          )}
          {discoverableSuccess && (
            <div className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-4 py-3 font-medium">
              Saved ✓
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
          <h2 className="font-semibold text-text-primary text-lg">Account</h2>
          <button
            onClick={handleSignOut}
            className="w-full py-3 border-2 border-border hover:border-accent text-text-primary hover:text-accent rounded-lg text-sm font-medium transition-all"
          >
            Sign Out
          </button>
        </div>

        <div className="bg-card border-2 border-error/20 rounded-xl p-8 space-y-5 shadow-soft">
          <h2 className="font-semibold text-error text-lg">Danger Zone</h2>
          <p className="text-sm text-text-secondary leading-relaxed">Permanently delete your account and all associated data. This action cannot be undone.</p>
          <button
            onClick={() => {
              setShowDeleteConfirmation(true)
              setDeleteError('')
            }}
            disabled={deleting}
            className="py-3 px-6 border-2 border-error text-error hover:bg-error/10 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 shadow-soft"
          >
            Delete Account
          </button>
          {showDeleteConfirmation && (
            <div className="space-y-4 rounded-lg border border-error/30 bg-error/5 p-4">
              <p className="text-sm text-text-secondary leading-relaxed">
                This permanently deletes your account, your vault, your connections and any files you uploaded. This cannot be undone.
              </p>
              <input
                type="password"
                autoComplete="current-password"
                value={deletePassword}
                onChange={event => setDeletePassword(event.target.value)}
                placeholder="Enter your password to confirm"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-error/60"
              />
              {deleteError && (
                <p className="text-sm text-error" role="alert">{deleteError}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDeleteAccount}
                  disabled={!deletePassword || deleting}
                  className="py-3 px-6 border-2 border-error bg-error text-white hover:bg-error/90 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Permanently delete my account'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirmation(false)
                    setDeletePassword('')
                    setDeleteError('')
                  }}
                  disabled={deleting}
                  className="py-3 px-6 border-2 border-border text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}