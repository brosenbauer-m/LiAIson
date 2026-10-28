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

// Icons for the phone tab bar (24 × 24, stroked).
const TAB_ICONS: Record<string, string> = {
  '/dashboard': 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  '/vault': 'M4 5.5h16v13H4zM4 9.5h16M9 13.5h6',
  '/discover': 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM15.5 15.5 20 20',
  '/connections': 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5c1.8.8 3 2.9 3 5.5',
  '/circles': 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z',
  '/settings': 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.8 1l-.3 2h-4l-.3-2a7 7 0 0 1-1.8-1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-2.1L3 10.3l2-3.4 1.9.7a7 7 0 0 1 1.8-1l.3-2h4l.3 2a7 7 0 0 1 1.8 1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 2.1Z',
}

export default function SiteHeader() {
  const pathname = usePathname()
  const [auth, setAuth] = useState<AuthState>('loading')
  // Tiers with more than one circle have the Circles page instead of Connections.
  const [hasCircles, setHasCircles] = useState(false)
  // The admin account only has the admin console (no LiAIson pages).
  const [isAdmin, setIsAdmin] = useState(false)
  const links = isAdmin ? [{ href: '/admin', label: 'Admin' }] : SIGNED_IN_LINKS.map(l => (l.href === '/connections' && hasCircles ? { href: '/circles', label: 'Circles' } : l))

  useEffect(() => {
    const supabase = createClient()
    // Re-checked on every sign-in, so the menu shows Circles right after logging in.
    let loadedFor: string | null = null
    const loadPlan = (userId: string | undefined) => {
      if (!userId || loadedFor === userId) return
      loadedFor = userId
      fetch('/api/plan', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then((p: { circles?: number; admin?: boolean } | null) => { setHasCircles(p?.circles === 2); setIsAdmin(p?.admin === true) })
        .catch(() => {})
    }
    supabase.auth.getSession().then(({ data }) => {
      setAuth(data.session ? 'signed-in' : 'signed-out')
      loadPlan(data.session?.user.id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth(session ? 'signed-in' : 'signed-out')
      if (session) setTimeout(() => loadPlan(session.user.id), 0)
      else { loadedFor = null; setHasCircles(false); setIsAdmin(false) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Phones: signed in, the pages are in a tab bar at the bottom (not on the
  // home page, which fills the screen). The body gets room for it.
  const showTabs = auth === 'signed-in' && pathname !== '/' && !isAdmin
  useEffect(() => {
    document.body.classList.toggle('has-tabbar', showTabs)
  }, [showTabs])

  const isActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  const linkClass = (href: string) =>
    `whitespace-nowrap text-sm font-medium rounded-full px-2.5 sm:px-3 py-1.5 ${
      isActive(href) ? 'text-text-primary bg-accent-subtle' : 'text-text-secondary hover:text-text-primary hover:bg-accent-tint'
    }`

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/75 backdrop-blur-xl backdrop-saturate-150 pt-[env(safe-area-inset-top)]">
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
            <div className="ml-auto md:ml-2 flex items-center gap-2">
              {pathname !== '/' && !isAdmin && <UsageIndicator />}
              {!isAdmin && <NotificationBell />}
              {pathname === '/' && (
                <Link href={isAdmin ? '/admin' : '/dashboard'} className="md:hidden whitespace-nowrap px-4 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-full shadow-soft">
                  {isAdmin ? 'Admin' : 'Dashboard'}
                </Link>
              )}
            </div>
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

    </header>

    {showTabs && (
      <nav
        className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur-xl backdrop-saturate-150 pb-[env(safe-area-inset-bottom)]"
        aria-label="Main mobile"
      >
        <div className="grid grid-cols-5 h-16">
          {links.map(link => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-accent' : 'text-text-muted hover:text-text-secondary'}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
                  <path d={TAB_ICONS[link.href]} />
                </svg>
                {link.label}
              </Link>
            )
          })}
        </div>
      </nav>
    )}
    </>
  )
}