'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { VaultSection } from '@/types'
import { placementLabel, placementOf, placementFields, type CustomCircle, type Placement } from '@/lib/circles'

interface VaultSectionCardProps {
  section: VaultSection
  onUpdate: (id: string, data: Partial<VaultSection>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  // Characters this section may hold without going over the Vault limit
  // (limit minus everything saved in the other sections). Undefined = unknown.
  roomLeft?: number
  // false on plans with one circle (Introvert): no Inner Circle option
  innerAllowed: boolean
  // The owner's own circles (Social Butterfly); empty on other plans.
  customCircles: CustomCircle[]
}

const countChars = (text: string) => Array.from(text).length

export default function VaultSectionCard({ section, onUpdate, onDelete, roomLeft, innerAllowed, customCircles }: VaultSectionCardProps) {
  const [content, setContent] = useState(section.content)
  const [placement, setPlacement] = useState<Placement>(placementOf(section))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const deleteConfirmationRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // Import a PDF or Word file into this section: its text is added below what
  // is already here, ready to review; nothing is saved until you press Save.
  // The file itself is never stored.
  const handleImport = async (file: File) => {
    setImporting(true)
    setImportNote(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body })
      const data = await res.json().catch(() => null) as { text?: string; truncated?: boolean; error?: string } | null
      if (!res.ok || !data?.text) {
        setImportNote({ type: 'error', text: data?.error ?? 'Something went wrong. Please try again.' })
        return
      }
      setContent(prev => (prev.trim() ? `${prev.trimEnd()}\n\n${data.text}` : data.text!))
      setImportNote({ type: 'ok', text: data.truncated ? 'Imported the first part of a long file. Review it, then Save.' : 'Imported. Review the text, then Save.' })
    } catch {
      setImportNote({ type: 'error', text: 'Something went wrong. Please try again.' })
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(section.id, { content, ...placementFields(placement) })
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

  const length = countChars(content)
  const overBy = roomLeft === undefined ? 0 : length - roomLeft
  // Only block saving when the text grows past the limit; shortening is always fine.
  const blocked = overBy > 0 && length > countChars(section.content ?? '')

  const lastUpdated = section.updated_at
    ? new Date(section.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-soft">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-text-primary text-lg">{section.label}</h3>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-text-secondary hover:border-accent hover:text-text-primary disabled:opacity-60"
        >
          <span aria-hidden="true">↑</span> {importing ? 'Reading file…' : 'Import file'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void handleImport(f) }}
        />
      </div>
      {importNote && (
        <p className={`-mt-2 text-xs ${importNote.type === 'error' ? 'text-error' : 'text-success'}`} role={importNote.type === 'error' ? 'alert' : 'status'}>
          {importNote.text}
        </p>
      )}

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={`Add information about your ${section.label.toLowerCase()}...`}
        rows={4}
        className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y transition-all"
      />
      <p className={`-mt-2 text-xs ${blocked ? 'text-error' : 'text-text-muted'}`}>
        {blocked
          ? <>This is {overBy.toLocaleString('en-GB')} characters more than fits in your Vault. Shorten it, or <Link href="/settings#subscription" className="underline">get more space with a higher plan</Link>.</>
          : `${length.toLocaleString('en-GB')} characters`}
      </p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary mb-1">Who can see this</legend>
        <div className="flex flex-wrap gap-2">
          {([
            'outer',
            ...(innerAllowed || placement === 'inner' ? ['inner'] : []),
            ...customCircles.map(c => `c:${c.id}`),
            'draft',
          ] as Placement[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPlacement(p)}
                aria-pressed={placement === p}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  placement === p ? 'border-accent bg-accent-tint text-accent' : 'border-border text-text-secondary hover:border-accent/50'
                }`}
              >
                {p === 'draft' ? 'Draft' : placementLabel(p, customCircles)}
              </button>
            ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-text-muted">{lastUpdated ? `Last updated ${lastUpdated}` : ''}</p>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || blocked || (
              content === section.content &&
              placement === placementOf(section)
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
