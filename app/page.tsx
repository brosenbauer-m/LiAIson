'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/animations'
import { createClient } from '@/lib/supabase/client'
import { PLANS, PLAN_IDS, formatEur } from '@/lib/plans'
import SimilarityMap from '@/components/similarity/SimilarityMap'

// Landing page (redesign 2026-10-09: warm brown palette, serif headlines,
// thin grid lines, product visuals). Claims stay within what the app does:
// answers only from the Vault, circles decide who sees what, EU data centres,
// sender pays.

const EXAMPLE_INTERESTS = [
  { label: 'Tennis', people: ['A', 'B'], strength: 3 as const, reason: 'You both play every week.' },
  { label: 'Vienna', people: ['A', 'B'], strength: 2 as const },
  { label: 'Product design', people: ['A', 'B'], strength: 3 as const },
  { label: 'Climbing', people: ['A'], strength: 2 as const },
  { label: 'Jazz', people: ['A'], strength: 1 as const },
  { label: 'Sailing', people: ['B'], strength: 2 as const },
  { label: 'Cooking', people: ['B'], strength: 1 as const },
]

const FACTS = [
  { title: 'Only what you wrote', text: 'Your LiAIson answers from your Vault and nothing else. No guessing, no outside sources.' },
  { title: 'You decide who sees what', text: 'Circles keep some things for everyone and others only for the people you choose.' },
  { title: 'Data in EU data centres', text: 'Your profile and the AI behind it run in the EU.' },
  { title: 'Pay for what you send', text: 'Nobody pays when others talk to your LiAIson. You only pay for your own messages.' },
]

const STEPS = [
  { n: '01', title: 'Fill your Vault', text: 'Write about your work, your interests and what you are looking for, or import a CV.' },
  { n: '02', title: 'Choose who sees what', text: 'Put each part in your Outer Circle, your Inner Circle or keep it as a draft.' },
  { n: '03', title: 'Share your link', text: 'People ask your LiAIson anything about you, any time, and it answers for you.' },
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted mb-4">{children}</p>
}

export default function LandingPage() {
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  const primaryHref = signedIn ? '/dashboard' : '/signup'
  const primaryLabel = signedIn ? 'Go to my LiAIson' : 'Create your LiAIson'

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-grid [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 pt-20 pb-16 sm:pt-28">
          <div className="max-w-3xl">
            <motion.p
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface text-xs font-medium text-text-secondary mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />
              Your personal AI representative
            </motion.p>

            <motion.h1
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.1 }}
              className="font-display text-5xl sm:text-7xl font-medium text-text-primary leading-[1.05] tracking-tight text-balance"
            >
              Your AI. Your story. <span className="italic text-accent">On your terms.</span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.2 }}
              className="mt-6 text-lg sm:text-xl text-text-secondary max-w-2xl leading-relaxed"
            >
              Create your LiAIson: an AI that knows what you choose to share and answers for you when people visit your profile.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              transition={{ delay: 0.3 }}
              className="mt-10 flex flex-col sm:flex-row gap-3"
            >
              <Link
                href={primaryHref}
                className="px-7 py-3.5 bg-accent hover:bg-accent-light text-white font-medium rounded-lg transition-colors shadow-card text-center"
              >
                {primaryLabel}
              </Link>
              <Link
                href="/discover"
                className="px-7 py-3.5 bg-surface border border-border hover:border-accent text-text-primary font-medium rounded-lg transition-colors text-center"
              >
                Find someone&apos;s LiAIson
              </Link>
            </motion.div>
            {!signedIn && <p className="mt-4 text-sm text-text-muted">Every plan starts with a free month.</p>}
          </div>

          {/* Product visual: a chat and a Similarity map */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.4 }}
            className="mt-16 grid lg:grid-cols-5 gap-4"
          >
            <div className="lg:col-span-3 bg-card border border-border rounded-xl shadow-card overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center font-display text-lg">A</div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Anna&apos;s LiAIson</p>
                  <p className="text-xs text-text-muted">Ask me anything about Anna</p>
                </div>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <div className="flex justify-end">
                  <p className="max-w-[80%] bg-accent text-white px-4 py-2.5 rounded-2xl rounded-br-none">What does Anna do outside of work?</p>
                </div>
                <div className="flex justify-start">
                  <p className="max-w-[85%] bg-surface border border-border text-text-primary px-4 py-2.5 rounded-2xl rounded-bl-none leading-relaxed">
                    Anna plays tennis twice a week and spends her summers sailing on the Attersee. She has played tennis since she was a child, just like you!
                  </p>
                </div>
                <p className="pl-1 text-xs text-text-secondary">✨ See everything you have in common →</p>
                <div className="flex justify-end pt-2">
                  <p className="max-w-[80%] bg-accent text-white px-4 py-2.5 rounded-2xl rounded-br-none">Is she open to new projects?</p>
                </div>
                <div className="flex justify-start">
                  <p className="max-w-[85%] bg-surface border border-border text-text-primary px-4 py-2.5 rounded-2xl rounded-bl-none leading-relaxed">
                    Yes. Anna is looking for freelance product design work from January, ideally with small teams.
                  </p>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 bg-card border border-border rounded-xl shadow-card p-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted mb-2">What you have in common</p>
              <p className="flex items-center gap-2 text-text-primary mb-3">
                <span aria-hidden="true" className="tracking-widest">●●●●○</span>
                <span className="font-semibold">A lot in common</span>
              </p>
              <SimilarityMap people={[{ key: 'A', name: 'You' }, { key: 'B', name: 'Anna' }]} interests={EXAMPLE_INTERESTS} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Facts */}
      <section className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 lg:divide-x divide-border">
          {FACTS.map(f => (
            <div key={f.title} className="px-4 sm:px-6 py-8">
              <h3 className="font-semibold text-text-primary">{f.title}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="font-display text-4xl sm:text-5xl font-medium text-text-primary max-w-2xl leading-tight text-balance">
            Tell it once. It answers for you every day.
          </h2>
          <div className="mt-14 grid md:grid-cols-3 gap-px bg-border border border-border rounded-xl overflow-hidden">
            {STEPS.map(s => (
              <div key={s.n} className="bg-card p-8">
                <p className="font-mono text-sm text-accent">{s.n}</p>
                <h3 className="mt-6 text-xl font-semibold text-text-primary">{s.title}</h3>
                <p className="mt-3 text-text-secondary leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <Eyebrow>Features</Eyebrow>
          <h2 className="font-display text-4xl sm:text-5xl font-medium text-text-primary max-w-2xl leading-tight text-balance">
            Meet people through what matters to them.
          </h2>
          <div className="mt-14 grid md:grid-cols-6 gap-4">
            <div className="md:col-span-4 bg-card border border-border rounded-xl p-8 shadow-soft">
              <h3 className="text-xl font-semibold text-text-primary">Circles</h3>
              <p className="mt-3 text-text-secondary leading-relaxed max-w-md">
                Your Outer Circle is for everyone who visits your profile. Your Inner Circle is only for the people you choose. Drafts stay with you.
              </p>
              <div className="mt-8 flex items-center gap-6" aria-hidden="true">
                <div className="relative w-36 h-36 rounded-full border border-accent/40 bg-accent-tint flex items-center justify-center">
                  <span className="absolute top-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">Outer</span>
                  <div className="w-20 h-20 rounded-full bg-accent text-white flex items-center justify-center text-xs font-mono uppercase tracking-wider">Inner</div>
                </div>
                <ul className="space-y-2 text-sm text-text-secondary">
                  <li><span className="text-text-primary font-medium">Everyone:</span> work, skills, hobbies</li>
                  <li><span className="text-text-primary font-medium">Inner Circle:</span> what you share with friends</li>
                  <li><span className="text-text-primary font-medium">Drafts:</span> only you</li>
                </ul>
              </div>
            </div>
            <div className="md:col-span-2 bg-accent text-white rounded-xl p-8 shadow-soft flex flex-col">
              <h3 className="text-xl font-semibold">Discover</h3>
              <p className="mt-3 text-white/80 leading-relaxed">
                Find people by name, or by what they share, like someone who plays tennis in Vienna.
              </p>
              <div className="mt-auto pt-8">
                <div className="rounded-lg bg-white/10 border border-white/20 px-4 py-3 text-sm text-white/90">tennis in Vienna</div>
              </div>
            </div>
            <div className="md:col-span-3 bg-card border border-border rounded-xl p-8 shadow-soft">
              <h3 className="text-xl font-semibold text-text-primary">Similarity</h3>
              <p className="mt-3 text-text-secondary leading-relaxed">
                Your LiAIson tells you when you have something in common with someone. With Extrovert you also see how much, on a map of your interests.
              </p>
            </div>
            <div className="md:col-span-3 bg-card border border-border rounded-xl p-8 shadow-soft">
              <h3 className="text-xl font-semibold text-text-primary">Echoes</h3>
              <p className="mt-3 text-text-secondary leading-relaxed">
                A short report of what people asked your LiAIson, without showing who asked, so you know what to add to your Vault.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="py-24 border-b border-border">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div>
              <Eyebrow>Plans</Eyebrow>
              <h2 className="font-display text-4xl sm:text-5xl font-medium text-text-primary leading-tight">Start free. Grow when you like.</h2>
            </div>
            <Link href="/plans" className="text-accent font-medium hover:underline">Compare plans →</Link>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-xl overflow-hidden">
            {PLAN_IDS.map(id => {
              const plan = PLANS[id]
              return (
                <Link key={id} href="/plans" className="bg-card p-6 hover:bg-accent-tint transition-colors">
                  <p className="font-semibold text-text-primary">{plan.name}</p>
                  <p className="mt-3 font-display text-3xl text-text-primary">
                    {plan.feeEur === 0 ? 'Free' : id === 'butterfly' ? `from ${formatEur(plan.feeEur)}` : formatEur(plan.feeEur)}
                    {plan.feeEur > 0 && <span className="text-sm font-sans text-text-secondary"> / month</span>}
                  </p>
                  <p className="mt-3 text-sm text-text-secondary leading-relaxed">{plan.available ? plan.tagline : 'Coming soon.'}</p>
                </Link>
              )
            })}
          </div>
          <p className="mt-4 text-sm text-text-muted">On every plan you pay only for the messages you send, usually between half a cent and two cents each.</p>
        </div>
      </section>

      {/* Final call to action */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4">
        <div className="bg-accent rounded-2xl px-8 py-16 sm:px-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" aria-hidden="true" />
          <h2 className="relative font-display text-4xl sm:text-5xl font-medium text-white leading-tight text-balance">
            Let your LiAIson make the introduction.
          </h2>
          <Link
            href={primaryHref}
            className="relative mt-10 inline-block px-8 py-3.5 bg-background text-accent font-medium rounded-lg hover:bg-white transition-colors"
          >
            {primaryLabel}
          </Link>
        </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="font-display text-2xl text-accent">LiAIson</span>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-text-secondary">
            <Link href="/plans" className="hover:text-accent transition-colors font-medium">Plans</Link>
            <Link href="/discover" className="hover:text-accent transition-colors font-medium">Discover</Link>
            <Link href="/privacy" className="hover:text-accent transition-colors font-medium">Privacy</Link>
            {!signedIn && (
              <>
                <Link href="/login" className="hover:text-accent transition-colors font-medium">Log in</Link>
                <Link href="/signup" className="hover:text-accent transition-colors font-medium">Sign up</Link>
              </>
            )}
          </div>
          <p className="text-xs text-text-muted">© {new Date().getFullYear()} LiAIson. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
