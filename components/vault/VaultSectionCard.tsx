'use client'

import { useEffect, useRef, useState } from 'react'
import type { VaultSection } from '@/types'

interface VaultSectionCardProps {
  section: VaultSection
  onUpdate: (id: string, data: Partial<VaultSection>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  hint?: string
}

export default function VaultSectionCard({ section, onUpdate, onDelete, hint }: VaultSectionCardProps) {
  const [content, setContent] = useState(section.content)
  const [isProfessional, setIsProfessional] = useState(section.is_professional)
  const [isPersonal, setIsPersonal] = useState(section.is_personal)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteConfirmationRef = useRef<HTMLDivElement>(null)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates: Partial<VaultSection> = {
        content,
        is_professional: isProfessional,
        is_personal: isPersonal,
      }
      if (isProfessional !== isPersonal) {
        updates.domain = isProfessional ? 'professional' : 'personal'
      }
      await onUpdate(section.id, updates)
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

  const lastConfirmed = section.last_confirmed_at
    ? new Date(section.last_confirmed_at).toLocaleDateString()
    : 'Never confirmed'

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-soft">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-text-primary text-lg">{section.label}</h3>
        </div>
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={`Add information about your ${section.label.toLowerCase()}...`}
        rows={4}
        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y transition-all"
      />

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={isProfessional}
            onChange={event => setIsProfessional(event.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Add to Professional Liaison
        </label>
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={isPersonal}
            onChange={event => setIsPersonal(event.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Add to Personal Liaison
        </label>
        {!isProfessional && !isPersonal && (
          <p className="text-xs text-text-muted">Private draft — not shown to any visitor yet</p>
        )}
      </div>

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
            disabled={saving || (
              content === section.content &&
              isProfessional === section.is_professional &&
              isPersonal === section.is_personal
            )}
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
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded-lg hover:border-text-secondary transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-600 hover:border-red-600 hover:text-white transition-all disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Yes, delete'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="px-3 py-1.5 text-sm text-red-700 border border-red-300 rounded-lg hover:bg-red-600 hover:border-red-600 hover:text-white transition-all"
          >
            Delete section
          </button>
        )}
      </div>
    </div>
  )
}
