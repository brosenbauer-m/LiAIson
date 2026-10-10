'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import CirclesNote from '@/components/ui/CirclesNote'

// Settings → Profile Privacy: Public / Private (users.public_scope, 'none' =
// Private). Discoverable is no longer a separate switch (2026-10-10): everyone
// can be found by name and username; Public profiles also by description (AI
// search over the Outer Circle). Changing it refreshes the Discover index.
export default function PrivacySection() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  // Introvert (one circle) sees nothing about circles.
  const [hasCircles, setHasCircles] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [{ data }, planRes] = await Promise.all([
        supabase.from('users').select('username, public_scope').eq('id', user.id).single(),
        fetch('/api/plan', { cache: 'no-store' }).catch(() => null),
      ])
      if (planRes?.ok) setHasCircles(((await planRes.json()) as { circles?: number }).circles === 2)
      if (data) {
        setUsername(data.username ?? '')
        setIsPublic(data.public_scope !== 'none')
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = async (nextPublic: boolean) => {
    if (!userId || nextPublic === isPublic) return
    setIsPublic(nextPublic)
    // Public = everyone sees the Outer Circle (circles replace the old levels).
    const { error } = await supabase.from('users').update({ public_scope: nextPublic ? 'both' : 'none' }).eq('id', userId)
    if (error) {
      setIsPublic(!nextPublic)
      return
    }
    void fetch('/api/discover/index', { method: 'POST' }).catch(() => {})
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading...</p>

  const link = 'text-accent hover:underline'
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-full border border-border bg-background p-1" role="radiogroup" aria-label="Profile visibility">
        {[{ v: true, label: 'Public' }, { v: false, label: 'Private' }].map(o => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={isPublic === o.v}
            onClick={() => choose(o.v)}
            className={`px-5 py-2 rounded-full text-sm font-medium ${isPublic === o.v ? 'bg-accent text-white shadow-soft' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">
        {isPublic ? (
          <>
            Your LiAIson can talk to any user with the information in your{' '}
            <Link href="/vault" className={link}>{hasCircles ? 'Outer Circle' : 'Vault'}</Link>. Your{' '}
            <Link href={username ? `/${username}` : '/dashboard'} className={link}>profile</Link> can be found in{' '}
            <Link href="/discover" className={link}>Discover</Link> by name, username and description.
          </>
        ) : hasCircles ? (
          <>
            Your LiAIson can only talk to <Link href="/connections" className={link}>Connections</Link> with information from
            the <Link href="/vault" className={link}>Circle</Link> assigned to the Connection. Your profile can only be found by
            name and username.
          </>
        ) : (
          <>
            Your LiAIson can only talk to <Link href="/connections" className={link}>Connections</Link> with the information in
            your <Link href="/vault" className={link}>Vault</Link>. Your profile can only be found by name and username.
          </>
        )}
      </p>
      {!hasCircles && <CirclesNote />}
      {saved && <p className="text-sm text-success" role="status">Saved ✓</p>}
    </div>
  )
}
