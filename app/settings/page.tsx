'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type PublicScope = 'none' | 'professional' | 'personal' | 'both'

const SCOPE_OPTIONS: { value: PublicScope; label: string; description: string }[] = [
  { value: 'none', label: 'Closed', description: 'Only your connections can chat with your LiAIson.' },
  { value: 'professional', label: 'Professional only', description: 'Anyone can chat using your professional vault.' },
  { value: 'personal', label: 'Personal only', description: 'Anyone can chat using your personal vault.' },
  { value: 'both', label: 'Open', description: 'Anyone can chat using your full vault.' },
]

export default function SettingsPage() {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [publicScope, setPublicScope] = useState<PublicScope>('none')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      const { data } = await supabase
        .from('users')
        .select('public_scope')
        .eq('id', user.id)
        .single()
      if (data) setPublicScope(data.public_scope as PublicScope)
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

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return
    setDeleting(true)
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
          <h2 className="font-semibold text-text-primary text-lg">Chat Access</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Control what a visitor can chat about when they land on your profile.
          </p>
          {loading ? (
            <p className="text-sm text-text-secondary">Loading...</p>
          ) : (
            <div className="space-y-3">
              {SCOPE_OPTIONS.map(opt => (
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
                  <div className="font-medium text-text-primary">{opt.label}</div>
                  <div className="text-sm text-text-secondary">{opt.description}</div>
                </button>
              ))}
              <p className="text-sm text-text-secondary leading-relaxed">
                Your connections always get at least this level, plus any extra access you give them on the Connections page.
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