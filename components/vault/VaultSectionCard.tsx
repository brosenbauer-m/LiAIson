'use client'

import { useEffect, useRef, useState } from 'react'
import VisibilityToggle from '@/components/ui/VisibilityToggle'
import type { VaultSection, VaultVisibility } from '@/types'

interface VaultSectionCardProps {
  section: VaultSection
  onUpdate: (id: string, data: Partial<VaultSection>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  hint?: string
}

// Privacy badge component
function PrivacyBadge({ visibility }: { visibility: VaultVisibility }) {
  const config = {
    public: { color: 'bg-badge-public/10 text-badge-public border-badge-public/30', label: 'Public' },
    discoverable_only: { color: 'bg-badge-discoverable/10 text-badge-discoverable border-badge-discoverable/30', label: 'Discoverable' },
    private: { color: 'bg-badge-private/10 text-badge-private border-badge-private/30', label: 'Private' },
  }

  const { color, label } = config[visibility]

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${color}`}>
      {label}
    </span>
  )
}

export default function VaultSectionCard({ section, onUpdate, onDelete, hint }: VaultSectionCardProps) {
  const [content, setContent] = useState(section.content)
  const [visibility, setVisibility] = useState<VaultVisibility>(section.visibility)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteConfirmationRef = useRef<HTMLDivElement>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(section.id, { content, visibility })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
    } catch {
      return
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete(section.id)
      setConfirmingDelete(false)
    } catch {
      return
    } finally {
      setDeleting(false)
    }
  }

  useEffect(() => {
    if (!confirmingDelete) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !deleteConfirmationRef.current?.contains(event.target)) {
        setConfirmingDelete(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [confirmingDelete])

  const handleVisibilityChange = async (v: VaultVisibility) => {
    setVisibility(v)
    await onUpdate(section.id, { visibility: v })
  }

  const lastConfirmed = section.last_confirmed_at
    ? new Date(section.last_confirmed_at).toLocaleDateString()
    : 'Never confirmed'

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-soft">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-text-primary text-lg">{section.label}</h3>
          <PrivacyBadge visibility={visibility} />
        </div>
        <VisibilityToggle value={visibility} onChange={handleVisibilityChange} />
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={`Add information about your ${section.label.toLowerCase()}...`}
        rows={4}
        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y transition-all"
      />

      {hint && (
        <p className="text-sm text-text-secondary italic border-l-2 border-accent pl-4">{hint}</p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium border border-border bg-background text-text-secondary">
          Last confirmed: {lastConfirmed}
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || (content === section.content && visibility === section.visibility)}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-all shadow-soft disabled:opacity-50 ${saved
              ? 'border border-success/30 bg-success/10 text-success'
              : 'bg-accent hover:bg-accent-light text-white'
            }`}
          >
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex justify-end border-t border-border pt-3">
        {confirmingDelete ? (
          <div ref={deleteConfirmationRef} className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-text-secondary">Delete this section?</span>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded-lg hover:border-text-secondary transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-sm text-error border border-error/30 rounded-lg hover:bg-error/10 transition-all disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="px-3 py-1.5 text-sm text-text-muted hover:text-error transition-colors"
          >
            Delete section
          </button>
        )}
      </div>
    </div>
  )
}
