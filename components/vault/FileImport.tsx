'use client'

import { useRef, useState } from 'react'

export type ImportTarget = 'professional' | 'personal' | 'both' | 'draft'

interface Props {
  defaultTarget: ImportTarget
  onSave: (label: string, content: string, target: ImportTarget) => Promise<boolean>
}

const TARGETS: { value: ImportTarget; label: string }[] = [
  { value: 'professional', label: 'Professional' },
  { value: 'personal', label: 'Personal' },
  { value: 'both', label: 'Both' },
  { value: 'draft', label: 'Draft (not used yet)' },
]

export default function FileImport({ defaultTarget, onSave }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState<{ label: string; text: string; truncated: boolean } | null>(null)
  const [target, setTarget] = useState<ImportTarget>(defaultTarget)
  const [saving, setSaving] = useState(false)

  const handleFile = async (file: File) => {
    setError('')
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body })
      const data = await res.json().catch(() => null) as
        | { fileName?: string; text?: string; truncated?: boolean; error?: string }
        | null
      if (!res.ok || !data?.text) {
        setError(data?.error ?? 'Something went wrong. Please try again.')
        return
      }
      const label = (data.fileName ?? file.name).replace(/\.(pdf|docx)$/i, '').slice(0, 80) || 'Imported document'
      setTarget(defaultTarget)
      setReview({ label, text: data.text, truncated: !!data.truncated })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!review) return
    const label = review.label.trim()
    const text = review.text.trim()
    if (!label || !text) {
      setError('Please give the section a name and keep some text.')
      return
    }
    setSaving(true)
    setError('')
    const ok = await onSave(label, text, target)
    setSaving(false)
    if (ok) setReview(null)
    else setError("Couldn't save this section — please try again.")
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="px-5 py-2.5 border-2 border-border hover:border-accent text-text-primary hover:text-accent text-sm font-medium rounded-lg transition-all disabled:opacity-60 whitespace-nowrap"
      >
        {uploading ? 'Reading file...' : 'Import from file'}
      </button>
      {error && !review && (
        <p role="alert" className="mt-2 text-sm text-error">{error}</p>
      )}

      {review && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col gap-4 shadow-card">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">Review before adding</h2>
              <p className="text-sm text-text-secondary mt-1">
                Check and edit the text. Only what you save here goes into your Vault — the file itself is not kept.
              </p>
            </div>

            <label className="block">
              <span className="block text-sm font-semibold text-text-primary mb-1">Section name</span>
              <input
                value={review.label}
                onChange={e => setReview({ ...review, label: e.target.value })}
                maxLength={80}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-text-primary focus:outline-none focus:border-accent/60"
              />
            </label>

            <label className="block flex-1 min-h-0">
              <span className="block text-sm font-semibold text-text-primary mb-1">Text</span>
              <textarea
                value={review.text}
                onChange={e => setReview({ ...review, text: e.target.value })}
                rows={12}
                className="w-full h-full min-h-[200px] bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/60 resize-y"
              />
            </label>
            {review.truncated && (
              <p className="text-xs text-text-secondary">This file was long, so only the first part was imported.</p>
            )}

            <div>
              <span className="block text-sm font-semibold text-text-primary mb-2">Use this for</span>
              <div className="flex flex-wrap gap-2">
                {TARGETS.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTarget(t.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                      target === t.value
                        ? 'border-accent bg-accent text-white'
                        : 'border-border text-text-secondary hover:border-accent/50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-error">{error}</p>}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => { setReview(null); setError('') }}
                disabled={saving}
                className="px-5 py-2.5 border-2 border-border text-text-secondary hover:text-text-primary rounded-lg text-sm font-medium transition-all disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white rounded-lg text-sm font-semibold transition-all shadow-soft disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Add to my Vault'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
