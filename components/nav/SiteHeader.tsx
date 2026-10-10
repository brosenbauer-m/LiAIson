'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import NotificationBell from '@/components/nav/NotificationBell'
import UsageIndicator from '@/components/nav/UsageIndicator'

type AuthState = 'loading' | 'signed-in' | 'signed-out'

const SIGNED_IN_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/vault', label: 'Vault' },
  { href: '/discover', label: 'Discover' },
  { href: '/connections', label: 'Connections' },
  { href: '/settings', label: 'Settings' },
]

export default function SiteHeader() {
  const pathname = usePathname()
  const [auth, setAuth] = useState<AuthState>('loading')
  // The mobile menu is open only on the page where it was opened, so it
  // closes by itself when the page changes.
  const [menuOpenOn, setMenuOpenOn] = useState<string | null>(null)
  const menuOpen = menuOpenOn !== null && menuOpenOn === pathname
  // Tiers with more than one circle have the Circles page instead of Connections.
  const [hasCircles, setHasCircles] = useState(false)
  const links = SIGNED_IN_LINKS.map(l => (l.href === '/connections' && hasCircles ? { href: '/circles', label: 'Circles' } : l))

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session ? 'signed-in' : 'signed-out')
      if (data.session) {
        fetch('/api/plan', { cache: 'no-store' })
          .then(r => (r.ok ? r.json() : null))
          .then((p: { circles?: number } | null) => setHasCircles(p?.circles === 2))
          .catch(() => {})
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? 'signed-in' : 'signed-out')
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  const linkClass = (href: string) =>
    `whitespace-nowrap text-sm font-medium rounded-full px-2.5 sm:px-3 py-1.5 ${
      isActive(href) ? 'text-text-primary bg-accent-subtle' : 'text-text-secondary hover:text-text-primary hover:bg-accent-tint'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl backdrop-saturate-150">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Always the home page; signed in, the header keeps the signed-in menu. */}
        <Link href="/" className="font-display text-2xl text-accent">
          LiAIson
        </Link>

        {auth === 'signed-in' && (
          <>
            <nav className="hidden md:flex items-center gap-1" aria-label="Main">
              {links.map(link => (
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
            <div className="ml-auto md:ml-2 mr-1 md:mr-0 flex items-center gap-2">
              {pathname !== '/' && <UsageIndicator />}
              <NotificationBell />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
              className="md:hidden p-2 -mr-2 text-text-primary"
              aria-label={menuOpen ? 'Close Menu' : 'Open Menu'}
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
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
            <Link href="/#how-it-works" className={`hidden sm:inline-block ${linkClass('/#how-it-works')}`}>
              How it Works
            </Link>
            <Link href="/discover" className={linkClass('/discover')}>
              Discover
            </Link>
            <Link href="/login" className={linkClass('/login')}>
              Log In
            </Link>
            <Link
              href="/signup"
              className="ml-1 whitespace-nowrap px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-full shadow-soft"
            >
              Sign Up
            </Link>
          </nav>
        )}
      </div>

      {auth === 'signed-in' && menuOpen && (
        <nav className="md:hidden border-t border-border/70 animate-message-in" aria-label="Main mobile">
          <div className="max-w-6xl mx-auto px-2 py-2 flex flex-col">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl px-3 py-3 text-base font-medium ${isActive(link.href) ? 'text-text-primary bg-accent-subtle' : 'text-text-secondary hover:bg-accent-tint'}`}
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
