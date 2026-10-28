'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/coupons', label: 'Event Codes' },
  { href: '/admin/accounts', label: 'Accounts' },
  { href: '/admin/money', label: 'Money' },
]

export default function AdminNav() {
  const pathname = usePathname()
  return (
    <nav className="flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1" aria-label="Admin">
      {TABS.map(t => {
        const active = t.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(t.href)
        return (
          <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined} className={`rounded-full px-4 py-1.5 text-sm font-medium ${active ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary hover:bg-accent-tint'}`}>
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
