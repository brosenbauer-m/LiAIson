'use client'

import { useState } from 'react'

// Settings → Subscription: use an event code (from a conference, a company…)
// for a free period on a tier plus some AI credit. Checks the code while
// typing; nothing is taken until Use Code is pressed.
export default function RedeemCodeCard() {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState<{ ok: boolean; reason?: string; summary?: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState('')

  const check = async (value: string) => {
    const c = value.trim()
    if (c.length < 4) { setPreview(null); return }
    const res = await fetch(`/api/coupons/preview?code=${encodeURIComponent(c)}`, { cache: 'no-store' }).catch(() => null)
    const d = res ? await res.json().catch(() => null) : null
    setPreview(d)
  }

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/coupons/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'The code could not be used right now.')
      const until = new Date(d.periodEndsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      setDone(`Done: ${d.summary}, until ${until}.${d.tierRaised ? ' Your tier has been changed.' : ''}`)
      window.dispatchEvent(new Event('liaison:usage-changed'))
      setTimeout(() => window.location.reload(), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The code could not be used right now.')
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p className="text-sm text-success">{done}</p>

  return (
    <form onSubmit={redeem} className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Redeem a Code</h3>
        <p className="text-sm text-text-secondary mt-1">Got a code from an event or organisation? It gives you a tier free for a while, plus some AI credit.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); void check(e.target.value) }}
          placeholder="e.g. WEBSUMMIT26"
          maxLength={40}
          autoCapitalize="characters"
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm font-mono uppercase text-text-primary placeholder:text-text-muted placeholder:font-sans placeholder:normal-case focus:outline-none focus:border-accent"
        />
        <button type="submit" disabled={busy || !preview?.ok} className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg shadow-soft disabled:opacity-50">
          {busy ? 'Using…' : 'Use Code'}
        </button>
      </div>
      {preview && (preview.ok ? <p className="text-sm text-success">✓ {preview.summary}</p> : <p className="text-sm text-text-secondary">{preview.reason}</p>)}
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </form>
  )
}
