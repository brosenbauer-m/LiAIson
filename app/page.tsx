'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { fadeInUp, scaleIn } from '@/lib/animations'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-surface/95 backdrop-blur-sm shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-bold text-xl text-accent">LiAIson</span>
          <div className="flex items-center gap-6">
            <Link href="/discover" className="text-text-secondary hover:text-accent text-sm font-medium transition-colors">
              Discover
            </Link>
            <Link href="/login" className="text-text-secondary hover:text-accent text-sm font-medium transition-colors">
              Login
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-lg transition-all shadow-soft"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-40 pb-24 px-4">
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
              href="/signup"
              className="px-8 py-4 bg-accent hover:bg-accent-light text-white font-semibold rounded-xl transition-all shadow-card hover:shadow-lg text-lg"
            >
              Create Your LiAIson
            </Link>
            <Link
              href="/discover"
              className="px-8 py-4 bg-card border-2 border-border hover:border-accent text-text-primary font-semibold rounded-xl transition-all text-lg"
            >
              See an Example
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
                desc: 'Let the right people find you. Set your discoverability preferences and let your LiAIson surface you to relevant connections.',
              },
              {
                icon: '🤝',
                title: 'Connect Meaningfully',
                desc: "When mutual interest sparks, LiAIson generates a compatibility summary so both of you know exactly why you'd connect well.",
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

      {/* Mock Chat UI */}
      <section className="py-24 px-4 bg-accent-tint/30 border-y border-border-light">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-text-primary mb-4">
            See it in action
          </h2>
          <p className="text-center text-text-secondary text-lg mb-12">
            This is what it looks like to talk to someone&apos;s LiAIson
          </p>
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
            <div className="border-b border-border px-6 py-5 bg-surface/50 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-white font-bold text-lg shadow-soft">
                A
              </div>
              <div>
                <p className="font-semibold text-text-primary">Alex&apos;s LiAIson</p>
                <p className="text-xs text-text-secondary">Ask me anything about Alex</p>
              </div>
            </div>
            <div className="p-6 space-y-4 min-h-[280px]">
              <div className="flex justify-end">
                <div className="bg-accent text-white rounded-2xl rounded-br-none px-5 py-3 text-sm max-w-[75%] shadow-soft">
                  What does Alex do for work?
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-1 border border-accent/20">
                  <span className="text-accent text-xs font-bold">M</span>
                </div>
                <div className="bg-surface border border-border rounded-2xl rounded-bl-none px-5 py-3 text-sm text-text-primary max-w-[75%] shadow-soft">
                  Alex is a product designer with 7 years of experience, currently leading design at a Series B startup in the climate tech space. She specialises in design systems and user research.
                </div>
              </div>
              <div className="flex justify-end">
                <div className="bg-accent text-white rounded-2xl rounded-br-none px-5 py-3 text-sm max-w-[75%] shadow-soft">
                  What is she passionate about outside of work?
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-1 border border-accent/20">
                  <span className="text-accent text-xs font-bold">M</span>
                </div>
                <div className="bg-surface border border-border rounded-2xl rounded-bl-none px-5 py-3 text-sm text-text-primary max-w-[75%] shadow-soft">
                  Outside of work, Alex is an avid rock climber and amateur ceramicist. She&apos;s also deeply interested in sustainable architecture and spends a lot of time exploring how design can influence behaviour at a city scale.
                </div>
              </div>
            </div>
            <div className="border-t border-border p-5 bg-surface/50">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ask about Alex..."
                  className="flex-1 bg-background border border-border rounded-lg px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
                  readOnly
                />
                <button className="px-6 py-3 bg-accent text-white font-medium rounded-lg text-sm shadow-soft">
                  Send
                </button>
              </div>
            </div>
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
            <Link href="/login" className="hover:text-accent transition-colors font-medium">Login</Link>
            <Link href="/signup" className="hover:text-accent transition-colors font-medium">Sign Up</Link>
          </div>
          <p className="text-xs text-text-muted">© 2025 LiAIson. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
