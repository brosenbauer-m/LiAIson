'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeInUp, scaleIn } from '@/lib/animations'
import { createClient } from '@/lib/supabase/client'

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

  return (
    <div className="min-h-screen bg-background">

      {/* Hero */}
      <section className="pt-24 pb-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent-tint border border-accent/20 text-accent text-sm font-medium mb-8"
          >
            <span>✨</span>
            <span>Your personal AI representative</span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.1 }}
            className="text-5xl sm:text-7xl font-bold text-text-primary leading-tight mb-6"
          >
            Your AI.{' '}
            <span className="text-accent">Your Story.</span>
            <br />
            On Your Terms.
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
            className="text-xl sm:text-2xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            Create your LiAIson — an AI agent that knows you deeply and speaks on your behalf to anyone who visits your profile.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
              href={signedIn ? '/dashboard' : '/signup'}
              className="px-8 py-4 bg-accent hover:bg-accent-light text-white font-semibold rounded-xl transition-all shadow-card hover:shadow-lg text-lg"
            >
              {signedIn ? 'Go to My LiAIson' : 'Create Your LiAIson'}
            </Link>
            <Link
              href="/discover"
              className="px-8 py-4 bg-card border-2 border-border hover:border-accent text-text-primary font-semibold rounded-xl transition-all text-lg"
            >
              Find someone&apos;s LiAIson
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="py-24 px-4 border-t border-border-light">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-text-primary mb-16">
            Everything you need to share who you are
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '📖',
                title: 'Share Your Story',
                desc: 'Feed your LiAIson everything that makes you unique — your work, passions, values, and goals. It speaks for you with precision.',
              },
              {
                icon: '🔍',
                title: 'Be Discovered',
                desc: 'Let the right people find you. Turn on Discoverable and anyone can find your LiAIson by name or username — or keep it link-only.',
              },
              {
                icon: '🤝',
                title: 'Connect Meaningfully',
                desc: 'Send a connect request. When it is accepted, you get access to more of their LiAIson — they decide what: professional, personal or both.',
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                variants={scaleIn}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-50px' }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-border rounded-xl p-8 shadow-soft hover:shadow-card transition-shadow"
              >
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-xl font-semibold text-text-primary mb-3">{f.title}</h3>
                <p className="text-text-secondary leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-light bg-border-light/30 py-12 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <span className="font-bold text-xl text-accent">LiAIson</span>
          <div className="flex flex-wrap gap-8 text-sm text-text-secondary">
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
