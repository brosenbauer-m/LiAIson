'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RisingCircles from '@/components/landing/RisingCircles'
import HowItWorks from '@/components/landing/HowItWorks'

// Home page (owner design 2026-10-10): full-screen sections that snap like
// slides — the story, How it Works (carousel with annotated pictures), On
// Your Terms (privacy and EU), and the call to action. Claims stay within
// what the app does and what the owner confirmed (company in Vienna).

const TRUST = [
  { title: 'Only what you disclose', text: 'Your LiAIson knows only what you write in your Vault. No outside sources, no guessing.' },
  { title: 'Kept in the EU', text: 'Your profile, your Vault and the AI that answers for you run in EU data centres.' },
  { title: 'GDPR-compliant', text: 'Built around the European data protection rules from the first line of code.' },
  { title: 'Based in Vienna, Austria', text: 'LiAIson is a company in Vienna, under Austrian and EU law.' },
  { title: 'Change or erase anytime', text: 'Edit any part of your Vault whenever you like, or delete your account and everything in it in one step.' },
  { title: 'You decide who sees what', text: 'Circles and a Public or Private profile. Echoes never show who asked or their exact words.' },
]

export default function HomePage() {
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session))
    return () => listener.subscription.unsubscribe()
  }, [])

  const primaryHref = signedIn ? '/dashboard' : '/signup'

  return (
    <main className="h-[calc(100dvh-4rem)] overflow-y-auto snap-y snap-proximity md:snap-mandatory scroll-smooth motion-reduce:scroll-auto">
      {/* 1 · The story */}
      <section className="relative snap-start min-h-full flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" aria-hidden="true" />
        <RisingCircles />
        <div className="relative w-full max-w-3xl mx-auto px-4 pt-12 pb-[22vh] text-center">
          <h1 className="font-display text-5xl sm:text-7xl font-medium text-text-primary leading-[1.05] tracking-tight text-balance animate-page-in">
            Tell Your Story a Million Times
          </h1>
          <p className="mt-8 text-base sm:text-lg text-text-secondary leading-relaxed text-balance animate-page-in" style={{ animationDelay: '120ms' }}>
            Human nature yearns to know and to be known. Exchanging stories has guided us throughout our history, fulfilling our
            social nature and keeping us alive. Millennia ago this came naturally: there were few of us, living in small
            communities, with the time, desire and opportunity to get to know everyone around us. Today we are billions, and
            neither our societies nor our biology can fulfil the wish to know everyone and to be known by all.
          </p>
          <p className="mt-5 text-lg sm:text-xl text-text-primary font-medium animate-page-in" style={{ animationDelay: '220ms' }}>
            Let your LiAIson help. Tell your story once, and let it be told endlessly.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center animate-page-in" style={{ animationDelay: '320ms' }}>
            <Link href={primaryHref} className="px-7 py-3.5 bg-accent hover:bg-accent-light text-white font-medium rounded-full shadow-card">
              {signedIn ? 'Go to my LiAIson' : 'Create Your Own LiAIson'}
            </Link>
            <Link href="#how-it-works" className="px-7 py-3.5 bg-surface/80 backdrop-blur border border-border hover:border-accent text-text-primary font-medium rounded-full">
              How it Works
            </Link>
          </div>
        </div>
      </section>

      {/* 2 · How it Works */}
      <section id="how-it-works" className="snap-start min-h-full flex items-center py-16 border-t border-border bg-surface/40">
        <div className="w-full max-w-6xl mx-auto px-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted mb-3">How it works</p>
          <h2 className="font-display text-4xl sm:text-5xl font-medium text-text-primary mb-10">How it Works</h2>
          <HowItWorks />
        </div>
      </section>

      {/* 3 · On Your Terms */}
      <section className="snap-start min-h-full flex items-center py-16 border-t border-border">
        <div className="w-full max-w-6xl mx-auto px-4">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted mb-3">Privacy</p>
          <h2 className="font-display text-4xl sm:text-6xl font-medium text-text-primary">On Your Terms</h2>
          <p className="mt-5 text-lg text-text-secondary max-w-2xl leading-relaxed">
            Your LiAIson only ever knows what you choose to tell it, and you stay in control of who hears what.
          </p>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-2xl overflow-hidden">
            {TRUST.map(t => (
              <div key={t.title} className="bg-card p-6 sm:p-8">
                <h3 className="font-semibold text-text-primary">{t.title}</h3>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 · Call to action */}
      <section className="snap-start min-h-full flex flex-col border-t border-border">
        <div className="relative flex-1 flex items-center justify-center px-4 py-20 overflow-hidden">
          <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden="true" />
          <div className="relative text-center">
            <h2 className="font-display text-5xl sm:text-7xl font-medium text-text-primary tracking-tight">Make Yourself Known</h2>
            <p className="mt-5 text-lg text-text-secondary">Every tier starts with a free month.</p>
            <Link
              href={primaryHref}
              className="mt-10 inline-block px-8 py-4 bg-accent hover:bg-accent-light text-white font-medium rounded-full shadow-card"
            >
              {signedIn ? 'Go to my LiAIson' : 'Create Your LiAIson'}
            </Link>
          </div>
        </div>
        <footer className="border-t border-border py-10">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <span className="font-display text-2xl text-accent">LiAIson</span>
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm text-text-secondary" aria-label="Footer">
              <Link href="#how-it-works" className="hover:text-accent font-medium">How it Works</Link>
              <Link href="/discover" className="hover:text-accent font-medium">Discover</Link>
              <Link href="/privacy" className="hover:text-accent font-medium">Privacy</Link>
              {!signedIn && (
                <>
                  <Link href="/login" className="hover:text-accent font-medium">Log in</Link>
                  <Link href="/signup" className="hover:text-accent font-medium">Sign up</Link>
                </>
              )}
            </nav>
            <p className="text-xs text-text-muted">© {new Date().getFullYear()} LiAIson · Vienna, Austria</p>
          </div>
        </footer>
      </section>
    </main>
  )
}
