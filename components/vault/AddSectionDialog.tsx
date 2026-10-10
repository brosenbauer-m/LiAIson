'use client'

import { useEffect, useRef, useState } from 'react'

// Vault → Add Section: a dialog in the site's style (instead of the browser's
// prompt) with suggested names. A suggestion fills the name, which can still
// be changed: names cost the AI next to nothing, so people may word them freely.

const SUGGESTIONS = [
  'Hobbies',
  'Interests',
  'Professional Experience',
  'Education',
  'Skills',
  'Values',
  'Family',
  'Travel',
  'Favourite Books & Films',
  'Music',
  'Sports',
  'Goals',
  'Languages',
  'Fun Facts',
]

export default function AddSectionDialog({
  existing,
  onAdd,
  onClose,
}: {
  existing: string[]
  onAdd: (label: string) => Promise<boolean>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const taken = new Set(existing.map(e => e.trim().toLowerCase()))
  const suggestions = SUGGESTIONS.filter(s => !taken.has(s.toLowerCase()))

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const label = name.replace(/\s+/g, ' ').trim()
    if (!label) return
    setBusy(true)
    const ok = await onAdd(label.slice(0, 60))
    setBusy(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4 pb-4 sm:pb-0 animate-page-in" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-section-title"
        className="w-full max-w-lg bg-card border border-border rounded-3xl shadow-card p-6 sm:p-8 space-y-5"
      >
        <h2 id="add-section-title" className="font-display text-2xl text-text-primary">Add Section</h2>
        <div>
          <label htmlFor="section-name" className="block text-sm font-medium text-text-primary mb-1.5">Name</label>
          <input
            ref={inputRef}
            id="section-name"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Hobbies"
            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>
        {suggestions.length > 0 && (
          <div>
            <p className="text-xs text-text-muted mb-2">Suggestions</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setName(s); inputRef.current?.focus() }}
                  aria-pressed={name === s}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    name === s ? 'border-accent bg-accent text-white' : 'border-border text-text-secondary hover:border-accent/50 hover:text-text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-full disabled:opacity-50">
            {busy ? 'Adding…' : 'Add Section'}
          </button>
        </div>
      </form>
    </div>
  )
}
