'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import RisingCircles from '@/components/landing/RisingCircles'
import HowItWorks from '@/components/landing/HowItWorks'
import { useReveal, useSectionPager } from '@/components/landing/useSectionPager'

// Home page (owner design 2026-10-10): full-screen sections that snap like
// slides — the story, How it Works (carousel with annotated pictures), On
// Your Terms (privacy and EU), and the call to action. Claims stay within
// what the app does and what the owner confirmed (company in Vienna).

// The EU is the headline of "On Your Terms" (owner 2026-10-10).
const EU_POINTS = [
  { title: 'Kept in the EU', text: 'Your profile, your Vault and the AI that answers for you run in EU data centres.' },
  { title: 'Paid in the EU', text: 'Payments are handled only by a payment provider in the EU.' },
  { title: 'GDPR-Compliant', text: 'Built around the European data protection rules from the first line of code.' },
  { title: 'Based in Vienna, Austria', text: 'LiAIson is a company in Vienna, under Austrian and EU law.' },
]

const TRUST = [
  { title: 'Only What You Disclose', text: 'Your LiAIson knows only what you write in your Vault. No outside sources, no guessing.' },
  { title: 'You Decide Who Sees What', text: 'A Public or Private profile, and circles from Ambivert up. Echoes never show who asked or their exact words.' },
  { title: 'Change or Erase Anytime', text: 'Edit any part of your Vault whenever you like, or delete your account and everything in it in one step.' },
]

// Twelve stars in a ring, like the EU flag.
function EuStars({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2
        const x = 100 + Math.cos(a) * 70
        const y = 100 + Math.sin(a) * 70
        const pts = Array.from({ length: 10 }, (_, k) => {
          const r = k % 2 ? 4.4 : 11
          const t = (k / 10) * Math.PI * 2 - Math.PI / 2
          return `${(x + Math.cos(t) * r).toFixed(1)},${(y + Math.sin(t) * r).toFixed(1)}`
        }).join(' ')
        return <polygon key={i} points={pts} fill="currentColor" />
      })}
    </svg>
  )
}

export default function HomePage() {
  const [signedIn, setSignedIn] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  // Desktop: eased section-by-section paging (CSS snapping off meanwhile).
  const paging = useSectionPager(mainRef)
  useReveal(mainRef)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(!!session))
    return () => listener.subscription.unsubscribe()
  }, [])

  const primaryHref = signedIn ? '/dashboard' : '/signup'

  return (
    <main
      ref={mainRef}
      className={`h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-y-auto ${paging ? '' : 'snap-y snap-proximity scroll-smooth motion-reduce:scroll-auto'}`}
    >
      {/* 1 · The story */}
      <section data-section className="relative snap-start min-h-full flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" aria-hidden="true" />
        <RisingCircles />
        <div data-reveal className="relative w-full max-w-3xl mx-auto px-4 pt-12 pb-[22vh] text-center">
          <h1 data-step style={{ "--i": 0 } as React.CSSProperties} className="font-display text-5xl sm:text-7xl font-medium text-text-primary leading-[1.05] tracking-tight text-balance">
            Tell Your Story a Million Times
          </h1>
          <p data-step style={{ "--i": 1 } as React.CSSProperties} className="mt-8 text-base sm:text-lg text-text-secondary leading-relaxed text-balance">
            The desire to know others and to be known is in our nature. Millennia ago we were few, living in small communities
            with the time, will and opportunity to meet this need naturally. Today we are billions, making it increasingly
            difficult to know, and be known by, so many. Our current lifestyles, biology and infrastructure are not designed to
            sustain this social fulfilment at such a scale. Offload your insignificant interactions and let your LiAIson handle them.
          </p>
          <p data-step style={{ "--i": 2 } as React.CSSProperties} className="mt-5 text-lg sm:text-xl text-text-primary font-medium">
            Tell your story once, and let it be told endlessly.
          </p>
          <div data-step style={{ "--i": 3 } as React.CSSProperties} className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={primaryHref} className="px-7 py-3.5 bg-accent hover:bg-accent-light text-white font-medium rounded-full shadow-card">
              {signedIn ? 'Go to My LiAIson' : 'Create Your Own LiAIson'}
            </Link>
            <Link href="#how-it-works" className="px-7 py-3.5 bg-surface/80 backdrop-blur border border-border hover:border-accent text-text-primary font-medium rounded-full">
              How it Works
            </Link>
          </div>
        </div>
      </section>

      {/* 2 · How it Works */}
      <section id="how-it-works" data-section className="snap-start min-h-full flex items-center py-16 border-t border-border bg-surface/40">
        <div data-reveal className="w-full max-w-6xl mx-auto px-4">
          <h2 data-step style={{ "--i": 0 } as React.CSSProperties} className="font-display text-4xl sm:text-5xl font-medium text-text-primary mb-10">How it Works</h2>
          <HowItWorks />
        </div>
      </section>

      {/* 3 · On Your Terms: the EU first, then the rest */}
      <section data-section className="snap-start min-h-full flex items-center py-16 border-t border-border bg-surface/40">
        <div data-reveal className="w-full max-w-6xl mx-auto px-4">
          <h2 data-step style={{ "--i": 0 } as React.CSSProperties} className="font-display text-4xl sm:text-6xl font-medium text-text-primary">On Your Terms</h2>
          <p data-step style={{ "--i": 1 } as React.CSSProperties} className="mt-5 text-lg text-text-secondary max-w-2xl leading-relaxed">
            Your LiAIson only ever knows what you choose to tell it, and you stay in control of who hears what.
          </p>
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div data-step style={{ "--i": 2 } as React.CSSProperties} className="relative lg:col-span-3 overflow-hidden rounded-3xl bg-gradient-to-br from-accent to-[#3F2819] text-white p-7 sm:p-10 shadow-card">
              <EuStars className="hidden sm:block absolute -right-16 -top-16 w-72 h-72 text-[#E3C27A] opacity-25" />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                <EuStars className="w-14 h-14 text-[#E3C27A] flex-shrink-0" />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Built in Vienna, Kept in the EU</p>
                  <h3 className="font-display text-3xl sm:text-4xl leading-tight">Your Data and Payments Stay in the EU</h3>
                </div>
              </div>
              <div className="relative mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                {EU_POINTS.map(p => (
                  <div key={p.title} className="border-t border-white/15 pt-4">
                    <h4 className="font-semibold text-[#F3E3C0]">{p.title}</h4>
                    <p className="mt-1.5 text-sm text-white/75 leading-relaxed">{p.text}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="lg:col-span-2 grid gap-4">
              {TRUST.map((t, i) => (
                <div key={t.title} data-step style={{ '--i': 3 + i } as React.CSSProperties} className="rounded-3xl border border-border bg-card p-6 shadow-soft">
                  <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
                    <h3 className="font-semibold text-text-primary">{t.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-text-secondary leading-relaxed">{t.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4 · Call to action */}
      <section data-section className="snap-start min-h-full flex flex-col border-t border-border">
        <div className="relative flex-1 flex items-center justify-center px-4 py-20 overflow-hidden">
          <div className="absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden="true" />
          <div data-reveal className="relative text-center">
            <h2 data-step style={{ "--i": 0 } as React.CSSProperties} className="font-display text-5xl sm:text-7xl font-medium text-text-primary tracking-tight">Make Yourself Known</h2>
            <p data-step style={{ "--i": 1 } as React.CSSProperties} className="mt-5 text-lg text-text-secondary">Every tier starts with a free month.</p>
            <Link
              href={primaryHref}
              data-step style={{ "--i": 2 } as React.CSSProperties}
              className="mt-10 inline-block px-8 py-4 bg-accent hover:bg-accent-light text-white font-medium rounded-full shadow-card"
            >
              {signedIn ? 'Go to My LiAIson' : 'Create Your LiAIson'}
            </Link>
          </div>
        </div>
        <footer className="border-t border-border py-10">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
            <span className="font-display text-2xl text-accent">LiAIson</span>
            <Link href="/privacy" className="text-sm text-text-secondary hover:text-accent font-medium">Privacy</Link>
            <p className="text-xs text-text-muted">© {new Date().getFullYear()} LiAIson · Vienna, Austria</p>
          </div>
        </footer>
      </section>
    </main>
  )
}
