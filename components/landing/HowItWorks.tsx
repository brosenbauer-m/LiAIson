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
        Everything starts with your <b>Vault</b>: write whatever you want your LiAIson to know about you, in sections you name
        yourself, such as hobbies or work experience. Import a file like your CV into any section, and let <b>Optimize Text</b>{' '}
        shorten a section to free up space. For each section you choose who may hear about it. The higher your tier, the more
        your <b>Vault</b> can hold.
      </>
    ),
    mock: <VaultMock />,
    callouts: [
      { ax: 392, ay: 32, y: 34, title: 'More room on higher tiers', text: 'From 1,000 to 60,000 characters.' },
      { ax: 300, ay: 70, y: 112, title: 'Who hears about it', text: 'Each section sits in a circle or stays a draft.' },
      { ax: 384, ay: 165, y: 200, title: 'Import File, Optimize Text', text: 'In the ⋯ menu of every section.' },
      { ax: 392, ay: 262, y: 290, title: 'Your own sections', text: 'Hobbies, work experience, anything you like.' },
      { ax: 300, ay: 396, y: 384, title: 'Add Section', text: 'With suggestions to get you started.' },
    ],
  },
  {
    title: 'Your LiAIson',
    short: 'Your LiAIson',
    body: (
      <>
        You get a link to your personal <b>LiAIson</b>. Signed-in visitors talk to it about you in natural conversation, and it
        answers only from what your <b>Vault</b> lets them hear, pointing out what they have in common with you. On Extrovert
        and Social Butterfly they also see <b>Similarity</b>: a score and a map of shared interests.
      </>
    ),
    mock: <ChatMock />,
    callouts: [
      { ax: 392, ay: 32, y: 34, title: 'Your personal link', text: 'Share it anywhere.' },
      { ax: 322, ay: 190, y: 196, title: 'Only from your Vault', text: 'No guessing, no outside sources.' },
      { ax: 244, ay: 236, y: 276, title: 'What you have in common', text: 'Pointed out during the chat.' },
      { ax: 392, ay: 350, y: 372, title: 'Similarity map', text: 'A score and shared interests, on Extrovert and up.' },
    ],
  },
  {
    title: 'Circles',
    short: 'Circles',
    body: (
      <>
        <b>Circles</b> decide what your LiAIson may tell whom, and they sit inside each other: whoever is in a circle also hears
        about everything in the circles around it. From Ambivert up there is an <b>Outer Circle</b> and an <b>Inner Circle</b>{' '}
        for people you choose; Social Butterfly adds your own circles, placed anywhere, even on their own outside everything
        else. Connections go both ways: whoever sends a request and whoever accepts it each choose
        the other&apos;s circle, and you can drag people between circles on the <b>Circles</b> page anytime.
      </>
    ),
    mock: <CirclesMock />,
    callouts: [
      { ax: 148, ay: 30, y: 40, title: 'Public or Private', text: 'Public: everyone can talk to your LiAIson.' },
      { ax: 297, ay: 156, y: 130, title: 'Outer Circle', text: 'Everyone who can see your profile.' },
      { ax: 237, ay: 215, y: 210, title: 'Inner Circle', text: 'Also hears about the Outer Circle.' },
      { ax: 368, ay: 282, y: 296, title: 'Your own circles', text: 'Placed anywhere, on Social Butterfly.' },
      { ax: 392, ay: 380, y: 392, title: 'Chosen when you connect', text: 'By each of you, changeable anytime.' },
    ],
  },
  {
    title: 'Discover',
    short: 'Discover',
    body: (
      <>
        On <b>Discover</b> everyone can find people by name or @username. From Ambivert up you can also search <b>By Description</b>, for
        example &ldquo;people in Vienna who play tennis&rdquo;, and see a short reason for each match. Only Public profiles can be found
        by description, and only what everyone may see is searched.
      </>
    ),
    mock: <DiscoverMock />,
    callouts: [
      { ax: 244, ay: 70, y: 52, title: 'By Name', text: 'Find anyone by name or @username, on every tier.' },
      { ax: 392, ay: 117, y: 130, title: 'By Description', text: 'Search by what people share, from Ambivert up.' },
      { ax: 392, ay: 205, y: 212, title: 'A short reason', text: 'Never their Vault text.' },
      { ax: 260, ay: 360, y: 340, title: 'Public profiles only', text: 'Private profiles are found by name only.' },
    ],
  },
  {
    title: 'Echoes',
    short: 'Echoes',
    body: (
      <>
        You never see who talks to your LiAIson or exactly what they say. From Ambivert up you get <b>Echoes</b>: monthly reports
        (weekly too on Extrovert and up) that summarise what people want to know about you, with a note from your LiAIson on
        what could be worth adding to your <b>Vault</b>.
      </>
    ),
    mock: <EchoesMock />,
    callouts: [
      { ax: 392, ay: 30, y: 36, title: 'Monthly or weekly', text: 'Depending on your tier, also by email.' },
      { ax: 392, ay: 126, y: 140, title: 'Topics', text: 'What people ask about most.' },
      { ax: 392, ay: 302, y: 290, title: 'A note from your LiAIson', text: 'What could be worth adding.' },
      { ax: 300, ay: 372, y: 384, title: 'Anonymous', text: 'Never who asked or their exact words.' },
    ],
  },
  {
    title: 'Cost',
    short: 'Cost',
    body: (
      <>
        You only pay for the messages <b>you</b> send (and for features marked with *, like Optimize Text), never for
        conversations others have with your LiAIson. A message typically costs half a cent to two cents. The first month is free
        with up to 5 messages a day. Your usage is always shown at the top of the page, you set a monthly limit, and you pay once
        at the end of the month. Ambivert and up add a fixed monthly fee.
      </>
    ),
    mock: <CostMock />,
    callouts: [
      { ax: 392, ay: 54, y: 46, title: 'Always visible', text: 'Your usage this month.' },
      { ax: 392, ay: 128, y: 124, title: 'Your monthly limit', text: 'You never pay more than you set.' },
      { ax: 392, ay: 182, y: 200, title: 'About 1 cent', text: 'Typically ½ to 2 cents per message.' },
      { ax: 392, ay: 370, y: 376, title: 'Free when others ask', text: 'Their messages are paid by them.' },
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
      <ol className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Steps">
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

      <div className="mt-10 flex items-center justify-between gap-4">
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
