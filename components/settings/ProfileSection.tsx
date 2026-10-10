'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import Toggle from '@/components/ui/Toggle'
import AccountEmailCard from '@/components/settings/AccountEmailCard'
import type { ContactLink } from '@/types'

// Settings → Profile: photo, name, email (+ Echo emails), bio and links.
// The bio is the "Profile Bio" section of the Vault (always public, every
// circle); the database keeps users.short_bio in step with it.

const PLATFORMS = ['Instagram', 'LinkedIn', 'WhatsApp', 'Twitter/X', 'GitHub', 'Email', 'Website', 'Other']
const MAX_BIO = 300

const inputClass =
  'w-full bg-background border border-border rounded-lg px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'
const labelClass = 'block text-sm font-medium text-text-primary mb-2'

export default function ProfileSection() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([])
  const [bio, setBio] = useState('')
  const [bioSectionId, setBioSectionId] = useState<string | null>(null)
  const [reportEmails, setReportEmails] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)
      const [{ data: profile }, { data: bioRow }] = await Promise.all([
        supabase.from('users').select('display_name, avatar_url, contact_links, short_bio, report_emails').eq('id', user.id).single(),
        supabase.from('vault_sections').select('id, content').eq('user_id', user.id).eq('section_type', 'profile_bio').maybeSingle(),
      ])
      if (profile) {
        setDisplayName(profile.display_name ?? '')
        setAvatarUrl(profile.avatar_url)
        setContactLinks(Array.isArray(profile.contact_links) ? profile.contact_links : [])
        setReportEmails(profile.report_emails !== false)
        setBio(bioRow?.content ?? profile.short_bio ?? '')
      }
      setBioSectionId(bioRow?.id ?? null)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ type: 'error', text: 'That picture is too large. The limit is 5 MB.' })
      return
    }
    const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const path = `avatars/${userId}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) {
      setStatus({ type: 'error', text: 'The picture could not be uploaded. Please try again.' })
      return
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`)
  }

  const toggleReportEmails = async () => {
    if (!userId) return
    const next = !reportEmails
    setReportEmails(next)
    const { error } = await supabase.from('users').update({ report_emails: next }).eq('id', userId)
    if (error) setReportEmails(!next)
  }

  const save = async () => {
    if (!userId) return
    setSaving(true)
    setStatus(null)
    const { error: profileError } = await supabase
      .from('users')
      .update({ display_name: displayName.trim(), contact_links: contactLinks.filter(l => l.url.trim()), avatar_url: avatarUrl })
      .eq('id', userId)

    const content = bio.trim().slice(0, MAX_BIO)
    const { data: bioRow, error: bioError } = bioSectionId
      ? await supabase.from('vault_sections').update({ content, updated_at: new Date().toISOString() }).eq('id', bioSectionId).select('id').single()
      : await supabase
          .from('vault_sections')
          .insert({ user_id: userId, domain: 'personal', section_type: 'profile_bio', label: 'Profile Bio', content, source: 'manual', circle: 'outer' })
          .select('id')
          .single()
    if (bioRow?.id) setBioSectionId(bioRow.id)
    setSaving(false)

    if (profileError || bioError) {
      const full = /VAULT_LIMIT/.test(bioError?.message ?? '')
      setStatus({ type: 'error', text: full ? 'Your Vault is full, so the bio could not get longer. Shorten something in your Vault first.' : 'Could not save everything. Please check your name and links and try again.' })
      return
    }
    void fetch('/api/discover/index', { method: 'POST' }).catch(() => {})
    setStatus({ type: 'success', text: 'Saved ✓' })
    window.setTimeout(() => setStatus(s => (s?.type === 'success' ? null : s)), 2500)
  }

  const updateLink = (i: number, field: keyof ContactLink, value: string) =>
    setContactLinks(prev => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))

  if (loading) return <p className="text-sm text-text-secondary">Loading...</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-5">
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-full" aria-label="Change photo">
          <Avatar url={avatarUrl} name={displayName} size="lg" className="shadow-soft" />
        </button>
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="px-4 py-2 border border-border hover:border-accent text-text-primary text-sm font-medium rounded-lg"
          >
            Change photo
          </button>
          <p className="text-xs text-text-muted mt-2">JPG, PNG or GIF, up to 5 MB</p>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
      </div>

      <div>
        <label htmlFor="display-name" className={labelClass}>Name</label>
        <input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={80} className={inputClass} />
      </div>

      <div className="space-y-4">
        <AccountEmailCard bare />
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Email me my Echoes (weekly on Mondays and monthly on the 1st, depending on your tier).
          </p>
          <Toggle checked={reportEmails} onChange={toggleReportEmails} label="Email me my Echoes" />
        </div>
      </div>

      <div>
        <label htmlFor="bio" className={labelClass}>
          Bio <span className="text-text-muted font-normal">({bio.length}/{MAX_BIO})</span>
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={e => setBio(e.target.value.slice(0, MAX_BIO))}
          rows={3}
          className={`${inputClass} resize-none`}
          placeholder="A few words about you"
        />
        <p className="mt-1.5 text-xs text-text-secondary italic">
          Your bio is always public: everyone who can see your profile sees it, in every circle, and your LiAIson knows it. It is also shown in your Vault. If your profile is Private, only your connections see it.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className={labelClass + ' mb-0'}>Links</span>
          <button type="button" onClick={() => setContactLinks(prev => [...prev, { platform: 'Website', url: '' }])} className="text-sm text-accent hover:underline font-medium">
            + Add link
          </button>
        </div>
        <div className="space-y-2">
          {contactLinks.map((link, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={link.platform}
                onChange={e => updateLink(i, 'platform', e.target.value)}
                aria-label="Link type"
                className="bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
              >
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                value={link.url}
                onChange={e => updateLink(i, 'url', e.target.value)}
                placeholder="Link or email address"
                maxLength={300}
                aria-label="Link"
                className="flex-1 min-w-0 bg-background border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <button type="button" onClick={() => setContactLinks(prev => prev.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-error px-2" aria-label="Remove link">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={saving || !displayName.trim()}
          className="px-6 py-3 bg-accent hover:bg-accent-light text-white font-medium rounded-lg shadow-soft disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>
        {status && (
          <p className={`text-sm ${status.type === 'error' ? 'text-error' : 'text-success'}`} role={status.type === 'error' ? 'alert' : 'status'}>
            {status.text}
          </p>
        )}
      </div>
    </div>
  )
}
