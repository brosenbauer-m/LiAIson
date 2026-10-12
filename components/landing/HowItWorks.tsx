'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Annotated, { type Callout } from '@/components/landing/Annotated'
import { ChatMock, CirclesMock, CostMock, DiscoverMock, EchoesMock, VaultMock } from '@/components/landing/mocks'

// "How it Works" on the home page: six slides, each a short text and an
// annotated picture. Swipe, use the arrows or the dots; arrow keys work too.

type Slide = { title: string; short: string; body: React.ReactNode; mock: React.ReactNode; callouts: Callout[] }

const SLIDES: Slide[] = [
  {
    title: 'Creating Your LiAIson',
    short: 'Your Vault',
    body: (
      <>
        Store in your <b>Vault</b> anything you want your LiAIson to know about you, from hobbies and interests to professional
        work experience. Your LiAIson knows only what exists in your <b>Vault</b>. For each section in your <b>Vault</b>, you can
        specify who gets to interact with this information. The higher your tier, the more information your <b>Vault</b> can
        hold for your LiAIson to work with.
      </>
    ),
    mock: <VaultMock />,
    callouts: [
      { ax: 392, ay: 32, y: 34, title: 'Room to Grow', text: 'Store from 1,000 up to 60,000 characters, depending on your tier.' },
      { ax: 300, ay: 70, y: 124, title: 'Who Can Hear It', text: 'Choose who your LiAIson can share each section with.' },
      { ax: 384, ay: 165, y: 220, title: 'Section Tools', text: 'Import a file or optimize a section’s text to free up space.' },
      { ax: 300, ay: 396, y: 330, title: 'Your Sections', text: 'Create sections to categorise your information, with suggestions to start.' },
    ],
  },
  {
    title: 'Your LiAIson',
    short: 'Your LiAIson',
    body: (
      <>
        You get a link to your personal <b>LiAIson</b>. Users can talk to your LiAIson in natural conversation to learn about you.
        Responses come only from the information in your <b>Vault</b>. Your LiAIson will even point out what you have in common!
        On higher tiers, your LiAIson can map out <b>Similarities</b> visually for you across multiple individuals.
      </>
    ),
    mock: <ChatMock />,
    callouts: [
      { ax: 392, ay: 32, y: 34, title: 'Your Personal Link', text: 'Share your link anywhere so people can talk to your LiAIson.' },
      { ax: 322, ay: 190, y: 160, title: 'Only From Your Vault', text: 'Trust that every answer comes only from your Vault.' },
      { ax: 244, ay: 236, y: 262, title: 'What You Have in Common', text: 'Discover what you share with the person you’re talking to.' },
      { ax: 392, ay: 350, y: 372, title: 'Similarities Chart', text: 'Map out what you have in common visually, even across several people.' },
    ],
  },
  {
    title: 'Circles',
    short: 'Circles',
    body: (
      <>
        On higher tiers, <b>Circles</b> let you decide what your LiAIson may tell whom. Drag and drop <b>Circles</b> in and out of
        each other to set who can access which information. For example, a close friend in your <b>Inner Circle</b> can talk to
        your LiAIson about everything in both your <b>Inner Circle</b> and your <b>Outer Circle</b>, while an acquaintance in your{' '}
        <b>Outer Circle</b> only hears about the <b>Outer Circle</b>. The higher your tier, the more <b>Circles</b> you can create.
      </>
    ),
    mock: <CirclesMock />,
    callouts: [
      { ax: 148, ay: 30, y: 40, title: 'Public or Private', text: 'Choose whether everyone or only your connections can talk to your LiAIson.' },
      { ax: 297, ay: 156, y: 132, title: 'Outer Circle', text: 'Share information with everyone who can see your profile.' },
      { ax: 237, ay: 215, y: 214, title: 'Inner Circle', text: 'Share more with the people closest to you.' },
      { ax: 368, ay: 282, y: 300, title: 'Your Own Circles', text: 'Create your own Circles and drag them in and out of each other.' },
      { ax: 392, ay: 380, y: 392, title: 'Chosen When You Connect', text: 'Pick a Circle for each new connection and change it anytime.' },
    ],
  },
  {
    title: 'Discover',
    short: 'Discover',
    body: (
      <>
        On <b>Discover</b> everyone can find people by name or @username. In higher tiers you can also search{' '}
        <b>By Description</b>, for example &ldquo;people in Vienna who play tennis&rdquo;. Your profile can only be found if it is
        set to Public, and the search only scans through the information you have made visible to all.
      </>
    ),
    mock: <DiscoverMock />,
    callouts: [
      { ax: 244, ay: 70, y: 52, title: 'By Name', text: 'Find anyone by their name or @username, on every tier.' },
      { ax: 392, ay: 117, y: 150, title: 'By Description', text: 'Search by what people share, on higher tiers.' },
      { ax: 260, ay: 360, y: 300, title: 'Public Profiles Only', text: 'Set your profile to Public to be found by description.' },
    ],
  },
  {
    title: 'Echoes',
    short: 'Echoes',
    body: (
      <>
        You never see who talks to your LiAIson or exactly what they say. However, on higher tiers you can get monthly or weekly
        summaries, called <b>Echoes</b>, on what people have been asking about you and what they&apos;d like to know more about,
        with a note from your LiAIson on what could be worth adding to your <b>Vault</b>.
      </>
    ),
    mock: <EchoesMock />,
    callouts: [
      { ax: 392, ay: 30, y: 36, title: 'Monthly or Weekly', text: 'Receive your Echoes monthly or weekly, also by email.' },
      { ax: 392, ay: 126, y: 140, title: 'Topics', text: 'See what people ask about you most.' },
      { ax: 392, ay: 302, y: 280, title: 'A Note From Your LiAIson', text: 'Get suggestions on what could be worth adding to your Vault.' },
      { ax: 300, ay: 372, y: 384, title: 'Anonymous', text: 'Learn what people want to know without seeing who asked.' },
    ],
  },
  {
    title: 'Cost',
    short: 'Cost',
    body: (
      <>
        You only pay for the messages you send (and for features marked with *), never for conversations others have with your
        LiAIson. A message typically costs half a cent to two cents depending on content size. Your first month is free with up
        to 5 messages a day. Your usage is always shown at the top of the page. You can set a monthly limit and you pay at the end
        of every month. Higher tiers have an additional fixed monthly fee for the extra features.
      </>
    ),
    mock: <CostMock />,
    callouts: [
      { ax: 392, ay: 54, y: 46, title: 'Always Visible', text: 'Check your usage at the top of every page.' },
      { ax: 392, ay: 128, y: 128, title: 'Your Monthly Limit', text: 'Set a limit so you never pay more than you choose.' },
      { ax: 392, ay: 168, y: 206, title: 'About 1 Cent', text: 'Pay roughly half a cent to two cents per message you send.' },
      { ax: 392, ay: 282, y: 290, title: 'Free Month', text: 'Start with a free first month of up to 5 messages a day.' },
      { ax: 392, ay: 370, y: 390, title: 'Free When Others Ask', text: 'Let others chat with your LiAIson at no cost to you.' },
    ],
  },
]

export default function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)

  const go = useCallback((i: number) => {
    const track = trackRef.current
    if (!track) return
    const next = Math.max(0, Math.min(SLIDES.length - 1, i))
    track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' })
  }, [])

  // "Learn More" links elsewhere go to /#circles or /#echoes: open that slide.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined
    const open = () => {
      const hash = window.location.hash.slice(1)
      const i = SLIDES.findIndex(s => s.short.toLowerCase() === hash)
      if (i < 0) return
      t = setTimeout(() => {
        const track = trackRef.current
        if (track) track.scrollTo({ left: i * track.clientWidth, behavior: 'auto' })
      }, 60)
    }
    open()
    window.addEventListener('hashchange', open)
    return () => { clearTimeout(t); window.removeEventListener('hashchange', open) }
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const onScroll = () => setIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)))
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => track.removeEventListener('scroll', onScroll)
  }, [])

  const last = index === SLIDES.length - 1

  return (
    <div
      className="w-full"
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
      }}
    >
      {/* Targets for /#circles and /#echoes (see the effect above). */}
      <span id="circles" aria-hidden="true" />
      <span id="echoes" aria-hidden="true" />
      {/* Steps: always shows where you are and that more follows */}
      <ol data-step style={{ '--i': 1 } as React.CSSProperties} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Steps">
        {SLIDES.map((s, i) => (
          <li key={s.title} className="flex-1 min-w-[110px]">
            <button
              type="button"
              onClick={() => go(i)}
              aria-current={i === index ? 'step' : undefined}
              className="group w-full text-left"
            >
              <span className="block h-1 rounded-full bg-border overflow-hidden">
                <span className={`block h-full rounded-full bg-accent transition-all duration-500 ${i <= index ? 'w-full' : 'w-0'}`} />
              </span>
              <span className={`mt-2.5 flex items-baseline gap-2 text-sm ${i === index ? 'text-text-primary font-semibold' : 'text-text-muted group-hover:text-text-secondary'}`}>
                <span className="font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
                {s.short}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div
        ref={trackRef}
        data-step
        style={{ '--i': 2 } as React.CSSProperties}
        className="mt-10 flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label="How LiAIson works"
        tabIndex={0}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={slide.title}
            className="w-full flex-shrink-0 snap-center px-1"
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${SLIDES.length}: ${slide.title}`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] gap-10 lg:gap-20 items-center">
              <div className={`transition-all duration-700 ${i === index ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
                <h3 className="font-display text-3xl sm:text-4xl text-text-primary">{slide.title}</h3>
                <p className="mt-5 text-[17px] text-text-secondary leading-relaxed [&_b]:font-semibold [&_b]:text-text-primary">{slide.body}</p>
              </div>
              <Annotated mock={slide.mock} callouts={slide.callouts} active={i === index} />
            </div>
          </div>
        ))}
      </div>

      <div data-step style={{ '--i': 3 } as React.CSSProperties} className="mt-10 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-border bg-surface text-text-primary font-medium whitespace-nowrap disabled:opacity-0 disabled:pointer-events-none"
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <span className="hidden sm:inline text-sm text-text-muted tabular-nums" aria-live="polite">{index + 1} of {SLIDES.length}</span>
        {last ? (
          <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-light text-white font-medium shadow-card">
            See Tiers <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(index + 1)}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-light text-white font-medium shadow-card whitespace-nowrap ${index === 0 ? 'animate-nudge' : ''}`}
          >
            Next: {SLIDES[index + 1].short} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  )
}
