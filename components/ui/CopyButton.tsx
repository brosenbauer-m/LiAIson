'use client'

import { useState } from 'react'

// Copies text to the clipboard and confirms with a short "Copied" state.
export default function CopyButton({ text, label = 'Copy link' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard blocked: nothing to do, the address is visible to copy by hand.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`px-5 py-3 text-sm font-medium rounded-lg whitespace-nowrap border ${
        copied ? 'border-success/30 bg-success/10 text-success' : 'border-border bg-surface text-text-primary hover:border-accent'
      }`}
      aria-live="polite"
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}
