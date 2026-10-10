import Link from 'next/link'

// Introvert (one circle) sees nothing about circles; only this short note on
// the pages where circles would be (Vault, Connections, Settings).
export default function CirclesNote({ className = '' }: { className?: string }) {
  return (
    <p className={`text-sm text-text-muted ${className}`}>
      With a higher tier you can create circles to choose who sees which parts of your Vault.{' '}
      <Link href="/#circles" className="text-accent hover:underline font-medium">Learn more</Link>
    </p>
  )
}
