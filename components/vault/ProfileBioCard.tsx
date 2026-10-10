'use client'

import { useState } from 'react'
import type { VaultSection } from '@/types'

// The Profile Bio in the Vault: always public and in every circle, can't be
// deleted (the database enforces both). Same text as the bio in Settings.
const MAX_BIO = 300

export default function ProfileBioCard({
  section,
  onUpdate,
}: {
  section: VaultSection
  onUpdate: (id: string, data: Partial<VaultSection>) => Promise<void>
}) {
  const [content, setContent] = useState(section.content ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await onUpdate(section.id, { content: content.trim() })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch {
      // The page shows the error.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-card border border-accent/30 rounded-2xl p-6 space-y-3 shadow-soft">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold text-text-primary text-lg">Profile Bio</h3>
        <span className="text-xs text-text-muted tabular-nums">{content.length}/{MAX_BIO}</span>
      </div>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value.slice(0, MAX_BIO))}
        rows={3}
        placeholder="A few words about you"
        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
      />
      <p className="text-xs text-text-secondary italic">
        Always public and in every circle: everyone who can see your profile sees your bio, and your LiAIson knows it. If your profile is Private, only your connections see it.
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || content.trim() === (section.content ?? '').trim()}
          className={`px-5 py-2 text-sm font-medium rounded-lg shadow-soft disabled:opacity-50 ${saved ? 'border border-success/30 bg-success/10 text-success' : 'bg-accent hover:bg-accent-light text-white'}`}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  )
}
