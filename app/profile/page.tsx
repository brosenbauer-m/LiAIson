'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User, ContactLink } from '@/types'

const PLATFORMS = ['Instagram', 'LinkedIn', 'WhatsApp', 'Twitter/X', 'GitHub', 'Email', 'Website', 'Other']

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [shortBio, setShortBio] = useState('')
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase.from('users').select('*').eq('id', user.id).single<User>()
      if (data) {
        setProfile(data)
        setDisplayName(data.display_name)
        setShortBio(data.short_bio ?? '')
        setContactLinks(data.contact_links ?? [])
        setAvatarUrl(data.avatar_url)
      }
      setLoading(false)
    }
    load()
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    const ext = file.name.split('.').pop()
    const path = `avatars/${profile.id}.${ext}`

    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed'); return }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(urlData.publicUrl)
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)

    await supabase
      .from('users')
      .update({
        display_name: displayName,
        short_bio: shortBio.substring(0, 160),
        contact_links: contactLinks,
        avatar_url: avatarUrl,
      })
      .eq('id', profile.id)

    setSaving(false)
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  const addLink = () => setContactLinks(prev => [...prev, { platform: 'Website', url: '' }])
  const removeLink = (i: number) => setContactLinks(prev => prev.filter((_, idx) => idx !== i))
  const updateLink = (i: number, field: keyof ContactLink, value: string) =>
    setContactLinks(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-text-secondary">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
        <h1 className="text-4xl font-display font-medium tracking-tight text-text-primary">Edit Profile</h1>

        <div className="bg-card border border-border rounded-xl p-8 space-y-6 shadow-soft">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div
              className="w-24 h-24 rounded-full bg-accent-tint border-2 border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-accent transition-all shadow-soft"
              onClick={() => fileRef.current?.click()}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="text-accent text-4xl font-bold">{displayName?.[0]?.toUpperCase() ?? '?'}</span>
              )}
            </div>
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="px-5 py-2 border-2 border-border hover:border-accent text-text-primary hover:text-accent text-sm font-medium rounded-lg transition-all"
              >
                Change photo
              </button>
              <p className="text-xs text-text-muted mt-2">JPG, PNG, GIF up to 5MB</p>
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
          </div>

          {/* Display name */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">Display Name</label>
            <input
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
            />
          </div>

          {/* Short bio */}
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2 uppercase tracking-wide">
              Short Bio{' '}
              <span className="text-text-muted font-normal normal-case">({shortBio.length}/160)</span>
            </label>
            <textarea
              value={shortBio}
              onChange={e => setShortBio(e.target.value.substring(0, 160))}
              rows={3}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none transition-all"
              placeholder="A short description shown on your public profile"
            />
          </div>

          {/* Contact links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-text-primary uppercase tracking-wide">Contact Links</label>
              <button onClick={addLink} className="text-sm text-accent hover:text-accent-light font-medium">+ Add link</button>
            </div>
            <div className="space-y-3">
              {contactLinks.map((link, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={link.platform}
                    onChange={e => updateLink(i, 'platform', e.target.value)}
                    className="bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  >
                    {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input
                    value={link.url}
                    onChange={e => updateLink(i, 'url', e.target.value)}
                    placeholder="URL or handle"
                    className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                  <button
                    onClick={() => removeLink(i)}
                    className="text-text-muted hover:text-error px-3 transition-colors text-lg"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {success && (
            <div className="text-success text-sm bg-success/10 border border-success/20 rounded-lg px-4 py-3 font-medium">
              Profile saved successfully ✓
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 bg-accent hover:bg-accent-light text-white font-semibold rounded-lg transition-all shadow-soft hover:shadow-card disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}
