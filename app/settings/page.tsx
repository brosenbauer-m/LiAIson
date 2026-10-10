'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import ProfileSection from '@/components/settings/ProfileSection'
import PrivacySection from '@/components/settings/PrivacySection'
import TierSection from '@/components/settings/TierSection'
import SpendingLimitCard from '@/components/settings/SpendingLimitCard'
import PaymentMethodCard from '@/components/settings/PaymentMethodCard'
import PrepaidBalanceCard from '@/components/settings/PrepaidBalanceCard'
import MonthlyBillCard from '@/components/settings/MonthlyBillCard'

// Settings (profile merged in, owner decision 2026-10-10): Profile, Profile
// Privacy, Subscription (tier with usage, credits and limit; payment method;
// invoices), then signing out and deleting the account.

const card = 'bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-soft'

function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return <h2 id={id} className="font-display text-2xl text-text-primary scroll-mt-24">{children}</h2>
}

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [showDelete, setShowDelete] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const deleteAccount = async () => {
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
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">
        <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">Settings</h1>

        <section className="space-y-4">
          <SectionTitle id="profile">Profile</SectionTitle>
          <div className={card}><ProfileSection /></div>
        </section>

        <section className="space-y-4">
          <SectionTitle id="privacy">Profile Privacy</SectionTitle>
          <div className={card}><PrivacySection /></div>
        </section>

        <section className="space-y-4">
          <SectionTitle id="subscription">Subscription</SectionTitle>
          <div className={`${card} space-y-8`}>
            <TierSection />
            <div className="border-t border-border pt-8"><SpendingLimitCard bare /></div>
            <div className="border-t border-border pt-8"><MonthlyBillCard bare /></div>
            <div className="border-t border-border pt-8"><PrepaidBalanceCard bare /></div>
          </div>
          <div id="payment" className={`${card} scroll-mt-24`}><PaymentMethodCard bare /></div>
          <div className={`${card} flex items-center justify-between gap-4`}>
            <div>
              <h3 className="font-semibold text-text-primary text-lg">Invoices</h3>
              <p className="text-sm text-text-secondary mt-1">Every bill and top-up, with a printable receipt.</p>
            </div>
            <Link href="/billing/receipts" className="px-4 py-2.5 border border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg whitespace-nowrap">
              View invoices
            </Link>
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>Account</SectionTitle>
          <div className={`${card} space-y-6`}>
            <button
              type="button"
              onClick={signOut}
              className="w-full py-3 border border-border hover:border-accent text-text-primary rounded-lg text-sm font-medium"
            >
              Sign out
            </button>
            <div className="border-t border-border pt-6 space-y-4">
              <h3 className="font-semibold text-error">Delete account</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Permanently deletes your account, your Vault, your connections and everything else. This can&apos;t be undone.
              </p>
              {!showDelete ? (
                <button
                  type="button"
                  onClick={() => { setShowDelete(true); setDeleteError('') }}
                  className="py-2.5 px-5 border border-error/40 text-error hover:bg-error hover:text-white rounded-lg text-sm font-medium"
                >
                  Delete account
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-error/30 bg-error/5 p-4">
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    placeholder="Enter your password to confirm"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-error/60"
                  />
                  {deleteError && <p className="text-sm text-error" role="alert">{deleteError}</p>}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={deleteAccount}
                      disabled={!deletePassword || deleting}
                      className="py-2.5 px-5 bg-error text-white rounded-lg text-sm font-medium disabled:opacity-50"
                    >
                      {deleting ? 'Deleting…' : 'Permanently delete my account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowDelete(false); setDeletePassword(''); setDeleteError('') }}
                      disabled={deleting}
                      className="py-2.5 px-5 border border-border text-text-secondary rounded-lg text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
