'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { VaultSection } from '@/types'
import { useUnsavedChanges } from '@/lib/unsaved'
import { openContextMenu } from '@/components/ui/ContextMenu'
import { circleChain, circleWhere, placementLabel, placementOf, placementFields, type CustomCircle, type Placement } from '@/lib/circles'

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
  // Introvert: no circle words (Visible / Draft).
  noCircles?: boolean
}

const countChars = (text: string) => Array.from(text).length

export default function VaultSectionCard({ section, onUpdate, onDelete, roomLeft, innerAllowed, customCircles, noCircles }: VaultSectionCardProps) {
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  // Optimize Text (AI, only on request): asks first, then puts the shorter
  // text straight into the section; Undo puts the earlier text back.
  const [confirmingOptimize, setConfirmingOptimize] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [beforeOptimize, setBeforeOptimize] = useState<string | null>(null)
  const [optimizeNote, setOptimizeNote] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const handleOptimize = async () => {
    setOptimizing(true)
    setOptimizeNote(null)
    try {
      const res = await fetch('/api/vault/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content }),
      })
      const data = await res.json().catch(() => ({})) as { optimized?: string; error?: string }
      if (!res.ok || typeof data.optimized !== 'string') {
        setOptimizeNote({ type: 'error', text: data.error ?? 'Optimize Text is not available right now.' })
        return
      }
      window.dispatchEvent(new Event('liaison:usage-changed'))
      setConfirmingOptimize(false)
      if (data.optimized === content) {
        setOptimizeNote({ type: 'ok', text: 'This text is already as short as it can be.' })
        return
      }
      const saved = countChars(content) - countChars(data.optimized)
      setBeforeOptimize(content)
      setContent(data.optimized)
      setOptimizeNote({ type: 'ok', text: `${saved.toLocaleString('en-GB')} characters freed up. Review the text, then Save.` })
    } catch {
      setOptimizeNote({ type: 'error', text: 'Optimize Text is not available right now.' })
    } finally {
      setOptimizing(false)
    }
  }

  const undoOptimize = () => {
    if (beforeOptimize === null) return
    setContent(beforeOptimize)
    setBeforeOptimize(null)
    setOptimizeNote(null)
  }

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: PointerEvent) => { if (e.target instanceof Node && !menuRef.current?.contains(e.target)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

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

  const handleSave = async (): Promise<boolean> => {
    setSaving(true)
    try {
      await onUpdate(section.id, { content, ...placementFields(placement) })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1500)
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  useUnsavedChanges(content !== section.content || placement !== placementOf(section), handleSave)

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


  // Circles inside the chosen one also see this section (hierarchy): their
  // tags are greyed. Circles on their own outside the Outer Circle don't.
  const nodes = new Map(customCircles.map(c => [c.id, { id: c.id, parent_id: c.parent_id ?? null, in_inner: !!c.in_inner, isolated: !!c.isolated }]))
  const alsoSees = new Set<Placement>()
  if (placement === 'outer' && innerAllowed) alsoSees.add('inner')
  for (const c of customCircles) {
    const chain = circleChain(c.id, nodes)
    const root = chain[chain.length - 1]
    if (!root) continue
    const inside =
      placement === 'outer' ? !root.isolated
        : placement === 'inner' ? !!root.in_inner
          : placement.startsWith('c:') ? chain.slice(1).some(a => a.id === placement.slice(2))
            : false
    if (inside) alsoSees.add(`c:${c.id}`)
  }
  const placementChoices = [
    'outer',
    ...(innerAllowed || placement === 'inner' ? ['inner'] : []),
    ...customCircles.map(c => `c:${c.id}`),
    'draft',
  ] as Placement[]

  return (
    <div
      className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-soft"
      // Right-click: the ⋯ menu's tools plus who can see it (saved at once).
      onContextMenu={e => openContextMenu(e, [
        { heading: section.label },
        { label: 'Import File', onSelect: () => fileRef.current?.click(), disabled: importing },
        { label: 'Optimize Text*', onSelect: () => { setConfirmingDelete(false); setOptimizeNote(null); setConfirmingOptimize(true) }, disabled: content.trim().length < 20 },
        ...(placementChoices.length > 1 ? [
          'separator' as const,
          { heading: 'Who Can See This' },
          ...placementChoices.map(p => ({
            label: p === 'draft' ? 'Draft' : noCircles && p === 'outer' ? 'Visible' : placementLabel(p, customCircles),
            disabled: p === placement,
            onSelect: () => { setPlacement(p); void onUpdate(section.id, placementFields(p)).catch(() => {}) },
          })),
        ] : []),
        'separator',
        { label: 'Delete Section', danger: true, onSelect: () => { setConfirmingOptimize(false); setConfirmingDelete(true) } },
      ])}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-text-primary text-lg">{section.label}</h3>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`w-9 h-9 rounded-full flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-accent-tint ${menuOpen ? 'bg-accent-tint text-text-primary' : ''}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true"><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" /></svg>
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 mt-1 w-52 rounded-xl border border-border bg-surface shadow-card p-1 z-20 animate-message-in">
              <button
                type="button"
                role="menuitem"
                disabled={importing}
                onClick={() => { setMenuOpen(false); fileRef.current?.click() }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-text-primary hover:bg-accent-tint disabled:opacity-60"
              >
                {importing ? 'Reading File…' : 'Import File'}
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={content.trim().length < 20}
                onClick={() => { setMenuOpen(false); setConfirmingDelete(false); setOptimizeNote(null); setConfirmingOptimize(true) }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-text-primary hover:bg-accent-tint disabled:opacity-50"
              >
                Optimize Text<span aria-hidden="true">*</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); setConfirmingOptimize(false); setConfirmingDelete(true) }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-error hover:bg-error/10"
              >
                Delete Section
              </button>
            </div>
          )}
        </div>
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

      {confirmingDelete && (
        <div ref={deleteConfirmationRef} className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-error/20 bg-error/5 px-4 py-3">
          <span className="text-sm text-text-primary">Delete this section?</span>
          <span className="flex items-center gap-2">
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
              {deleting ? 'Deleting...' : 'Yes, Delete'}
            </button>
          </span>
        </div>
      )}

      {confirmingOptimize && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-accent/20 bg-accent-tint px-4 py-3">
          <span className="text-sm text-text-primary">Automatically optimize this text to free up Vault storage?</span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmingOptimize(false)}
              disabled={optimizing}
              className="px-3 py-1.5 text-sm text-text-secondary border border-border rounded-lg hover:border-text-secondary transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleOptimize()}
              disabled={optimizing}
              className="px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent-light rounded-lg transition-all disabled:opacity-60"
            >
              {optimizing ? 'Optimizing…' : <>Optimize Text<span aria-hidden="true">*</span></>}
            </button>
          </span>
        </div>
      )}

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={`Add information about your ${section.label.toLowerCase()}...`}
        rows={4}
        readOnly={optimizing}
        className={`w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-y transition-all ${optimizing ? 'opacity-60 animate-pulse' : ''}`}
      />
      {(optimizeNote || beforeOptimize !== null) && (
        <div className="-mt-2 flex items-center gap-3 flex-wrap text-xs">
          {optimizeNote && (
            <span className={optimizeNote.type === 'error' ? 'text-error' : 'text-success'} role={optimizeNote.type === 'error' ? 'alert' : 'status'}>
              {optimizeNote.text}
            </span>
          )}
          {beforeOptimize !== null && (
            <button type="button" onClick={undoOptimize} className="px-3 py-1 rounded-full border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 font-medium">
              Undo?
            </button>
          )}
        </div>
      )}
      <p className={`-mt-2 text-xs ${blocked ? 'text-error' : 'text-text-muted'}`}>
        {blocked
          ? <>This is {overBy.toLocaleString('en-GB')} characters more than fits in your Vault. Shorten it, or <Link href="/settings#subscription" className="underline">get more space with a higher plan</Link>.</>
          : `${length.toLocaleString('en-GB')} characters`}
      </p>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text-primary mb-1">Who can see this</legend>
        <div className="flex flex-wrap gap-2">
          {placementChoices.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPlacement(p)}
                aria-pressed={placement === p}
                title={alsoSees.has(p) ? 'Also sees this (it sits inside the chosen circle)' : p.startsWith('c:') ? circleWhere(customCircles.find(c => c.id === p.slice(2)) ?? { id: '', name: '' }, customCircles) : undefined}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
                  placement === p
                    ? 'border-accent bg-accent-tint text-accent'
                    : alsoSees.has(p)
                      ? 'border-transparent bg-accent/10 text-accent/60'
                      : 'border-border text-text-secondary hover:border-accent/50'
                }`}
              >
                {p === 'draft' ? 'Draft' : noCircles && p === 'outer' ? 'Visible' : placementLabel(p, customCircles)}
              </button>
            ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-text-muted">{lastUpdated ? `Last updated ${lastUpdated}` : ''}</p>
        <div className="flex gap-2">
          <button
            onClick={() => void handleSave()}
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

    </div>
  )
}
