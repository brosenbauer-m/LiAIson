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
        Everything starts with your <b>Vault</b>: write whatever you want your LiAIson to know about you. Sort it into your own
        categories, such as hobbies or work experience, and upload files like your CV. The higher your tier, the more your{' '}
        <b>Vault</b> can hold.
      </>
    ),
    mock: <VaultMock />,
    callouts: [
      { ax: 392, ay: 32, y: 44, title: 'More room on higher tiers', text: 'From 1,000 to 60,000 characters.' },
      { ax: 392, ay: 135, y: 150, title: 'Your Vault', text: 'Anything you want your LiAIson to know.' },
      { ax: 392, ay: 222, y: 250, title: 'Your own categories', text: 'Hobbies, work experience, anything you like.' },
      { ax: 300, ay: 394, y: 372, title: 'Import files', text: 'Upload your CV as PDF or Word.' },
    ],
  },
  {
    title: 'Your LiAIson',
    short: 'Your LiAIson',
    body: (
      <>
        You get a link to your personal <b>LiAIson</b>. Visitors talk to it about you in natural conversation, and it answers only
        from your <b>Vault</b>, pointing out what they have in common with you. Higher tiers also show <b>Similarity</b>: a
        score and a map of shared interests.
      </>
    ),
    mock: <ChatMock />,
    callouts: [
      { ax: 392, ay: 32, y: 34, title: 'Your personal link', text: 'Share it anywhere.' },
      { ax: 322, ay: 190, y: 196, title: 'Only from your Vault', text: 'No guessing, no outside sources.' },
      { ax: 244, ay: 236, y: 276, title: 'What you have in common', text: 'Pointed out during the chat.' },
      { ax: 392, ay: 350, y: 372, title: 'Similarity map', text: 'A score and shared interests, on higher tiers.' },
    ],
  },
  {
    title: 'Circles',
    short: 'Circles',
    body: (
      <>
        <b>Circles</b> decide what your LiAIson may tell whom, and they sit inside each other: whoever is in a circle also sees
        everything in the circles around it. From Ambivert up there is an <b>Outer Circle</b> for everyone and an{' '}
        <b>Inner Circle</b> for friends; with Social Butterfly you can place your own circles anywhere, even inside the Inner Circle.
        You pick someone&apos;s circle when you accept their request.
      </>
    ),
    mock: <CirclesMock />,
    callouts: [
      { ax: 297, ay: 156, y: 90, title: 'Outer Circle', text: 'Everyone who can see your profile.' },
      { ax: 237, ay: 215, y: 190, title: 'Inner Circle', text: 'Also sees the Outer Circle.' },
      { ax: 368, ay: 282, y: 290, title: 'Your own circles', text: 'Placed anywhere, on Social Butterfly.' },
      { ax: 392, ay: 389, y: 392, title: 'Chosen when you accept', text: 'And changeable at any time.' },
    ],
  },
  {
    title: 'Discover',
    short: 'Discover',
    body: (
      <>
        On <b>Discover</b> everyone can find people by name or @username. Higher tiers can also search <b>By Information</b>, for
        example &ldquo;people in Vienna who play tennis&rdquo;, and see a short reason for each match. Only people who chose to be
        findable appear, and only what everyone may see is searched.
      </>
    ),
    mock: <DiscoverMock />,
    callouts: [
      { ax: 244, ay: 70, y: 52, title: 'By name', text: 'Find anyone by name or @username, on every tier.' },
      { ax: 392, ay: 117, y: 130, title: 'By Information', text: 'Search by what people share, on higher tiers.' },
      { ax: 392, ay: 205, y: 212, title: 'A short reason', text: 'Never their Vault text.' },
      { ax: 260, ay: 360, y: 340, title: 'Only the findable', text: 'People decide whether they can be found.' },
    ],
  },
  {
    title: 'Echoes',
    short: 'Echoes',
    body: (
      <>
        You never see who talks to your LiAIson or exactly what they say. With higher tiers you get <b>Echoes</b>: weekly or
        monthly reports that summarise what people want to know about you and the topics of their conversations, so you know
        what to add to your <b>Vault</b>.
      </>
    ),
    mock: <EchoesMock />,
    callouts: [
      { ax: 392, ay: 30, y: 36, title: 'Weekly or monthly', text: 'Depending on your tier, also by email.' },
      { ax: 392, ay: 126, y: 140, title: 'Topics', text: 'What people ask about most.' },
      { ax: 392, ay: 302, y: 290, title: 'Summarized', text: 'What they want to know, in a few words.' },
      { ax: 300, ay: 372, y: 384, title: 'Anonymous', text: 'Never who asked or their exact words.' },
    ],
  },
  {
    title: 'Cost',
    short: 'Cost',
    body: (
      <>
        You only pay for the messages <b>you</b> send, never for conversations others have with your LiAIson. A message
        typically costs half a cent to two cents. Your usage is always visible, you set a monthly limit, and you pay once at
        the end of the month. Higher tiers add a fixed monthly fee.
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
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-border bg-surface text-text-primary font-medium disabled:opacity-0 disabled:pointer-events-none"
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <span className="text-sm text-text-muted tabular-nums" aria-live="polite">{index + 1} of {SLIDES.length}</span>
        {last ? (
          <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-light text-white font-medium shadow-card">
            See tiers <span aria-hidden="true">→</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(index + 1)}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent-light text-white font-medium shadow-card ${index === 0 ? 'animate-nudge' : ''}`}
          >
            Next: {SLIDES[index + 1].short} <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  )
}
