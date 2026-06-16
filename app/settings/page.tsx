'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SettingsPage() {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return
    setDeleting(true)
    // In production, call a server-side function that deletes all user data
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-surface shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="font-bold text-xl text-accent">LiAIson</Link>
          <Link href="/dashboard" className="text-text-secondary hover:text-accent text-sm font-medium transition-colors">← Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-4xl font-bold text-text-primary">Settings</h1>

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
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="py-3 px-6 border-2 border-error text-error hover:bg-error/10 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 shadow-soft"
          >
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
