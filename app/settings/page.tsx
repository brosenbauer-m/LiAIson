'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Toggle from '@/components/ui/Toggle'
import SpendingLimitCard from '@/components/settings/SpendingLimitCard'
import PaymentMethodCard from '@/components/settings/PaymentMethodCard'
import PrepaidBalanceCard from '@/components/settings/PrepaidBalanceCard'
import MonthlyBillCard from '@/components/settings/MonthlyBillCard'
import PlanCard from '@/components/settings/PlanCard'
import AccountEmailCard from '@/components/settings/AccountEmailCard'

type PublicScope = 'none' | 'professional' | 'personal' | 'both'

export default function SettingsPage() {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [publicScope, setPublicScope] = useState<PublicScope>('none')
  const [isDiscoverable, setIsDiscoverable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [discoverableSaving, setDiscoverableSaving] = useState(false)
  const [discoverableSuccess, setDiscoverableSuccess] = useState(false)
  const [useOwnVault, setUseOwnVault] = useState(true)
  const [ownVaultAvailable, setOwnVaultAvailable] = useState(false)
  const [ownVaultSaving, setOwnVaultSaving] = useState(false)
  const [ownVaultSuccess, setOwnVaultSuccess] = useState(false)
  const [reportEmails, setReportEmails] = useState(true)
  const [reportEmailsAvailable, setReportEmailsAvailable] = useState(false)
  const [reportEmailsSaving, setReportEmailsSaving] = useState(false)
  const [reportEmailsSuccess, setReportEmailsSuccess] = useState(false)
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
        setIsDiscoverable(data.is_discoverable)
      }
      // Loaded separately so the rest of Settings still works if this fails.
      const { data: ownVault, error: ownVaultError } = await supabase
        .from('users')
        .select('use_own_vault_in_chats')
        .eq('id', user.id)
        .single()
      if (!ownVaultError && ownVault) {
        setUseOwnVault(ownVault.use_own_vault_in_chats !== false)
        setOwnVaultAvailable(true)
      }
      const { data: emailPref, error: emailPrefError } = await supabase
        .from('users')
        .select('report_emails')
        .eq('id', user.id)
        .single()
      if (!emailPrefError && emailPref) {
        setReportEmails(emailPref.report_emails !== false)
        setReportEmailsAvailable(true)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleSaveScope = async (scope: PublicScope) => {
    if (!userId) return
    setSaving(true)
    setPublicScope(scope)
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
      // Public = everyone sees your Outer Circle (circles replace the old levels).
      handleSaveScope('both')
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

  const handleToggleOwnVault = async () => {
    if (!userId) return
    const next = !useOwnVault
    setOwnVaultSaving(true)
    setUseOwnVault(next)
    const { error } = await supabase
      .from('users')
      .update({ use_own_vault_in_chats: next })
      .eq('id', userId)
    setOwnVaultSaving(false)
    if (error) {
      setUseOwnVault(!next)
      return
    }
    setOwnVaultSuccess(true)
    setTimeout(() => setOwnVaultSuccess(false), 3000)
  }

  const handleToggleReportEmails = async () => {
    if (!userId) return
    const next = !reportEmails
    setReportEmailsSaving(true)
    setReportEmails(next)
    const { error } = await supabase
      .from('users')
      .update({ report_emails: next })
      .eq('id', userId)
    setReportEmailsSaving(false)
    if (error) {
      setReportEmails(!next)
      return
    }
    setReportEmailsSuccess(true)
    setTimeout(() => setReportEmailsSuccess(false), 3000)
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

        <AccountEmailCard />

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
                <p className="text-sm text-text-secondary leading-relaxed">
                  Everyone can talk to your LiAIson about what is in your Outer Circle. People you put in your Inner Circle also hear about your Inner Circle. Visitors need an account to chat, and they pay for their own messages.
                </p>
              ) : (
                <p className="text-sm text-text-secondary leading-relaxed">
                  Only people whose connection request you accepted can talk to your LiAIson. You decide who is in your Inner Circle on the{' '}
                  <Link href="/connections" className="text-accent hover:underline">Connections page</Link>.
                </p>
              )}

              <p className="text-sm text-text-secondary leading-relaxed">
                People you&apos;ve already connected with keep their circle.
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

        {ownVaultAvailable && (
          <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
            <h2 className="font-semibold text-text-primary text-lg">Use my Vault when I chat</h2>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-text-secondary leading-relaxed">
                When you chat with someone else&apos;s LiAIson, it can also use your own Vault (everything except drafts) to answer things like &ldquo;What do we have in common?&rdquo;. It&apos;s only used to answer you &mdash; never shown to them or saved.
              </p>
              <Toggle
                checked={useOwnVault}
                onChange={handleToggleOwnVault}
                disabled={ownVaultSaving}
                label="Use my Vault when I chat"
              />
            </div>
            {ownVaultSuccess && (
              <div className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-4 py-3 font-medium">
                Saved ✓
              </div>
            )}
          </div>
        )}

        {reportEmailsAvailable && (
          <div className="bg-card border border-border rounded-xl p-8 space-y-5 shadow-soft">
            <h2 className="font-semibold text-text-primary text-lg">Email me my Echoes</h2>
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-text-secondary leading-relaxed">
                Get your weekly (Monday) and monthly (1st of the month) Echo, what visitors wanted to know, by email. You can always read them on the <Link href="/insights" className="text-accent hover:underline">Echoes page</Link>.
              </p>
              <Toggle
                checked={reportEmails}
                onChange={handleToggleReportEmails}
                disabled={reportEmailsSaving}
                label="Email me my Echoes"
              />
            </div>
            {reportEmailsSuccess && (
              <div className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-4 py-3 font-medium">
                Saved ✓
              </div>
            )}
          </div>
        )}

        {userId && <PlanCard />}

        {userId && <SpendingLimitCard />}

        {userId && <MonthlyBillCard />}

        {userId && <PaymentMethodCard />}

        {userId && <PrepaidBalanceCard />}

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