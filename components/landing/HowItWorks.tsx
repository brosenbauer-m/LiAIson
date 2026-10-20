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
        Store anything you want your LiAIson to know about you in your <b>Vault</b>, from hobbies to work experience. Your
        LiAIson knows only what is in your <b>Vault</b>, and for each section you choose who it may share it with. Higher tiers
        hold more.
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
        Share the link to your <b>LiAIson</b>. People chat with it to learn about you, and every answer comes only from your{' '}
        <b>Vault</b>. It even points out what you have in common, and on higher tiers maps out <b>Similarities</b> across
        several people.
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
        On higher tiers, <b>Circles</b> decide what your LiAIson may tell whom. Drag them in and out of each other: a friend in
        your <b>Inner Circle</b> hears about your Inner and Outer Circle, an acquaintance in the <b>Outer Circle</b> only about
        the Outer Circle. Higher tiers let you create more <b>Circles</b>.
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
        Find anyone on <b>Discover</b> by name or @username. Higher tiers can also search <b>By Description</b>, like
        &ldquo;people in Vienna who play tennis&rdquo;. Only Public profiles are found this way, and only what you share with
        everyone is searched.
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
        You never see who talks to your LiAIson or their exact words. On higher tiers, <b>Echoes</b> summarise monthly or
        weekly what people ask about you, with a note from your LiAIson on what to add to your <b>Vault</b>.
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
        You only pay for the messages you send and features marked with *, never for others talking to your LiAIson. A
        message costs about half a cent to two cents. Your first month is free (5 messages a day); after that you set a
        monthly limit and pay at the end of the month. Higher tiers add a fixed monthly fee.
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

// A tall, slim arrow beside the cards (tablets and computers).
function SideArrow({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === 1 ? 'Next' : 'Back'}
      className="hidden md:flex flex-shrink-0 h-44 w-12 items-center justify-center rounded-full border border-border bg-surface text-text-primary shadow-card hover:bg-accent hover:text-white hover:border-accent transition-colors disabled:opacity-0 disabled:pointer-events-none"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
        <path d={dir === 1 ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7'} />
      </svg>
    </button>
  )
}

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

      {/* Each slide is a card; tall arrows on either side (phones: buttons below). */}
      <div data-step style={{ '--i': 2 } as React.CSSProperties} className="mt-6 flex items-center gap-3 lg:gap-5">
        <SideArrow dir={-1} disabled={index === 0} onClick={() => go(index - 1)} />
        <div
          ref={trackRef}
          className="min-w-0 flex-1 flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="region"
          aria-roledescription="carousel"
          aria-label="How LiAIson works"
          tabIndex={0}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={slide.title}
              className="w-full flex-shrink-0 snap-center p-2 sm:p-4"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${SLIDES.length}: ${slide.title}`}
            >
              <div className={`rounded-3xl border border-border bg-card shadow-[0_18px_40px_-12px_rgba(43,30,22,0.18),0_2px_8px_rgba(43,30,22,0.06)] p-6 sm:p-10 transition-all duration-700 ${i === index ? 'opacity-100 scale-100' : 'opacity-60 scale-[0.97]'}`}>
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)] gap-8 lg:gap-12 items-center">
                  <div className={`transition-all duration-700 ${i === index ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
                    <h3 className="font-display text-3xl sm:text-4xl text-text-primary">{slide.title}</h3>
                    <p className="mt-5 text-[17px] text-text-secondary leading-relaxed [&_b]:font-semibold [&_b]:text-text-primary">{slide.body}</p>
                    {i === SLIDES.length - 1 && (
                      <Link href="/signup" className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-light text-white font-medium shadow-card">
                        See Tiers <span aria-hidden="true">→</span>
                      </Link>
                    )}
                  </div>
                  <Annotated mock={slide.mock} callouts={slide.callouts} active={i === index} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <SideArrow dir={1} disabled={last} onClick={() => go(index + 1)} />
      </div>

      <div data-step style={{ '--i': 3 } as React.CSSProperties} className="mt-6 flex md:hidden items-center justify-between gap-4">
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
