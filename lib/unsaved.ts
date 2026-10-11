'use client'

import { useEffect, useId, useRef } from 'react'

// Unsaved changes (owner request 2026-10-11): anything with a Save button
// registers here while it has changes that aren't saved. Leaving the page
// (links, Vault tabs) then asks Save / Don't Save / Cancel
// (components/ui/UnsavedChangesGuard.tsx); closing or reloading the tab gets
// the browser's own warning.

type Save = () => Promise<boolean>
type Choice = 'save' | 'discard' | 'cancel'

const dirty = new Map<string, { current: Save }>()
let ask: (() => Promise<Choice>) | null = null

export function hasUnsavedChanges(): boolean {
  return dirty.size > 0
}

// Saves everything that has changes; false if anything failed.
export async function saveAllUnsaved(): Promise<boolean> {
  const results = await Promise.all([...dirty.values()].map(save => save.current().catch(() => false)))
  return results.every(Boolean)
}

// The guard component registers the dialog.
export function setUnsavedPrompt(fn: (() => Promise<Choice>) | null) {
  ask = fn
}

// Resolves true when it is fine to leave (nothing unsaved, saved, or Don't Save).
export async function confirmLeave(): Promise<boolean> {
  if (!hasUnsavedChanges() || !ask) return true
  return (await ask()) !== 'cancel'
}

// `isDirty`: there are changes; `save` saves them and resolves true on success.
export function useUnsavedChanges(isDirty: boolean, save: Save) {
  const id = useId()
  const ref = useRef(save)
  useEffect(() => { ref.current = save })
  useEffect(() => {
    if (!isDirty) return
    dirty.set(id, ref)
    return () => { dirty.delete(id) }
  }, [id, isDirty])
}
