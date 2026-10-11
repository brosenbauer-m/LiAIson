'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasUnsavedChanges, saveAllUnsaved, setUnsavedPrompt } from '@/lib/unsaved'

type Choice = 'save' | 'discard' | 'cancel'

// Asks "Save / Don't Save / Cancel" when leaving a page with unsaved changes
// (see lib/unsaved.ts): in-app links and anything calling confirmLeave().
// Closing or reloading the tab shows the browser's own warning instead.
export default function UnsavedChangesGuard() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const resolver = useRef<((choice: Choice) => void) | null>(null)
  const saveRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setUnsavedPrompt(() => new Promise<Choice>(resolve => {
      resolver.current = resolve
      setFailed(false)
      setOpen(true)
    }))
    return () => setUnsavedPrompt(null)
  }, [])

  useEffect(() => {
    if (open) saveRef.current?.focus()
  }, [open])

  const finish = (choice: Choice) => {
    setOpen(false)
    resolver.current?.(choice)
    resolver.current = null
  }

  const handleSave = async () => {
    setSaving(true)
    setFailed(false)
    const ok = await saveAllUnsaved()
    setSaving(false)
    if (ok) finish('save')
    else setFailed(true)
  }

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return
      e.preventDefault()
      e.returnValue = ''
    }
    const onClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges() || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const link = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return
      const url = new URL(link.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      e.preventDefault()
      e.stopPropagation()
      const href = url.pathname + url.search + url.hash
      void new Promise<Choice>(resolve => {
        resolver.current = resolve
        setFailed(false)
        setOpen(true)
      }).then(choice => { if (choice !== 'cancel') router.push(href) })
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [router])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) finish('cancel') }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, saving])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4" onClick={() => { if (!saving) finish('cancel') }}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-card space-y-4 animate-message-in"
      >
        <div className="space-y-1">
          <h2 id="unsaved-title" className="text-lg font-semibold text-text-primary">Save Changes?</h2>
          <p className="text-sm text-text-secondary">You have changes that aren&apos;t saved yet.</p>
        </div>
        {failed && <p className="text-sm text-error" role="alert">Not everything could be saved. Please check the page and try again.</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => finish('cancel')} disabled={saving} className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:text-text-primary disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={() => finish('discard')} disabled={saving} className="px-4 py-2 rounded-lg border border-border text-sm text-text-primary hover:border-error/50 hover:text-error disabled:opacity-50">
            Don&apos;t Save
          </button>
          <button ref={saveRef} type="button" onClick={() => void handleSave()} disabled={saving} className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-light text-white text-sm font-medium disabled:opacity-60">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
