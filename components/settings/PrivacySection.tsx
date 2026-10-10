'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Toggle from '@/components/ui/Toggle'

// Settings → Profile Privacy: Public / Private (users.public_scope, 'none' =
// Private) and Discoverable. Both refresh the Discover search index.
export default function PrivacySection() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(true)
  const [discoverable, setDiscoverable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const { data } = await supabase.from('users').select('public_scope, is_discoverable').eq('id', user.id).single()
      if (data) {
        setIsPublic(data.public_scope !== 'none')
        setDiscoverable(data.is_discoverable !== false)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const update = async (fields: { public_scope?: string; is_discoverable?: boolean }, undo: () => void) => {
    if (!userId) return
    const { error } = await supabase.from('users').update(fields).eq('id', userId)
    if (error) {
      undo()
      return
    }
    void fetch('/api/discover/index', { method: 'POST' }).catch(() => {})
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  const choose = (nextPublic: boolean) => {
    if (nextPublic === isPublic) return
    setIsPublic(nextPublic)
    // Public = everyone sees your Outer Circle (circles replace the old levels).
    void update({ public_scope: nextPublic ? 'both' : 'none' }, () => setIsPublic(!nextPublic))
  }

  const toggleDiscoverable = () => {
    const next = !discoverable
    setDiscoverable(next)
    void update({ is_discoverable: next }, () => setDiscoverable(!next))
  }

  if (loading) return <p className="text-sm text-text-secondary">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="space-y-3">
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
          {isPublic
            ? 'Anyone with an account can talk to your LiAIson about your Outer Circle. People in your Inner Circle also hear about it, and people in your own circles about their circle and every circle around it.'
            : <>Only people whose connection request you accepted can see your profile and talk to your LiAIson. You choose their circle on the <Link href="/connections" className="text-accent hover:underline">Connections page</Link>.</>}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          <p className="font-medium text-text-primary">Discoverable</p>
          <p className="text-sm text-text-secondary leading-relaxed mt-1">
            People can find you by name on Discover. If your profile is Public, they can also find you by what is in your Outer Circle with AI search (they see your name and a short reason, never your Vault text). When off, your profile can only be reached through your link.
          </p>
        </div>
        <Toggle checked={discoverable} onChange={toggleDiscoverable} label="Discoverable" />
      </div>
      {saved && <p className="text-sm text-success" role="status">Saved ✓</p>}
    </div>
  )
}
