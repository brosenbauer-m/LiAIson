import Link from 'next/link'

// The owner's LiAIson suggesting what to add to the Vault (from an Echo), as
// a speech bubble.
export default function LiaisonNote({ note, compact = false }: { note: string; compact?: boolean }) {
  return (
    <div className="flex items-end gap-3">
      <span
        className="flex-shrink-0 w-9 h-9 rounded-full bg-accent text-white font-display text-sm flex items-center justify-center shadow-soft"
        aria-hidden="true"
      >
        Li
      </span>
      <div className="relative rounded-2xl rounded-bl-md bg-accent-tint border border-accent/15 px-4 py-3 shadow-soft">
        <p className="text-[11px] uppercase tracking-wide text-text-muted mb-1">Your LiAIson</p>
        <p className={`${compact ? 'text-sm' : 'text-[15px]'} text-text-primary leading-relaxed`}>{note}</p>
        <Link href="/vault" className="inline-block mt-2 text-xs font-medium text-accent hover:underline">Open My Vault →</Link>
      </div>
    </div>
  )
}
