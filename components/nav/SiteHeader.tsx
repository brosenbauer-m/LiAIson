'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type AuthState = 'loading' | 'signed-in' | 'signed-out'

const SIGNED_IN_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/vault', label: 'Vault' },
  { href: '/discover', label: 'Discover' },
  { href: '/connections', label: 'Connections' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
]

export default function SiteHeader() {
  const pathname = usePathname()
  const [auth, setAuth] = useState<AuthState>('loading')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session ? 'signed-in' : 'signed-out')
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? 'signed-in' : 'signed-out')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Close the mobile menu whenever the page changes.
  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  const linkClass = (href: string) =>
    `text-sm font-medium transition-colors ${
      isActive(href) ? 'text-accent' : 'text-text-secondary hover:text-accent'
    }`

  return (
    <header className="border-b border-border bg-surface/95 backdrop-blur-sm shadow-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link
          href={auth === 'signed-in' ? '/dashboard' : '/'}
          className="font-display text-2xl text-accent"
        >
          LiAIson
        </Link>

        {auth === 'signed-in' && (
          <>
            <nav className="hidden md:flex items-center gap-6" aria-label="Main">
              {SIGNED_IN_LINKS.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={linkClass(link.href)}
                  aria-current={isActive(link.href) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => setMenuOpen(open => !open)}
              className="md:hidden p-2 -mr-2 text-text-primary"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
                {menuOpen ? (
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </>
        )}

        {auth === 'signed-out' && (
          <nav className="flex items-center gap-4 sm:gap-6" aria-label="Main">
            <Link href="/plans" className={linkClass('/plans')}>
              Plans
            </Link>
            <Link href="/discover" className={linkClass('/discover')}>
              Discover
            </Link>
            <Link href="/login" className={linkClass('/login')}>
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>

      {auth === 'signed-in' && menuOpen && (
        <nav className="md:hidden border-t border-border bg-surface" aria-label="Main mobile">
          <div className="max-w-6xl mx-auto px-4 py-2 flex flex-col">
            {SIGNED_IN_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`py-3 ${linkClass(link.href)}`}
                aria-current={isActive(link.href) ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}
