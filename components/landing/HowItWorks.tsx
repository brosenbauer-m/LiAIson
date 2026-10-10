'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Annotated, { type Callout } from '@/components/landing/Annotated'
import { ChatMock, CirclesMock, CostMock, DiscoverMock, EchoesMock, VaultMock } from '@/components/landing/mocks'

// "How it Works" on the home page: six slides, each a short text and an
// annotated picture. Swipe, use the arrows or the dots; arrow keys work too.

type Slide = { title: string; body: React.ReactNode; mock: React.ReactNode; callouts: Callout[] }

const SLIDES: Slide[] = [
  {
    title: 'Creating Your LiAIson',
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
    body: (
      <>
        You get a link to your personal <b>LiAIson</b>. Visitors talk to it about you in natural conversation, and it answers only
        from what is in your <b>Vault</b>. Along the way it points out what the visitor has in common with you. Higher tiers also
        show <b>Similarity</b>: a score and a map of your shared interests.
      </>
    ),
    mock: <ChatMock />,
    callouts: [
      { ax: 392, ay: 32, y: 34, title: 'Your personal link', text: 'Share it anywhere.' },
      { ax: 392, ay: 131, y: 116, title: 'Natural conversation', text: 'Visitors ask whatever they want to know.' },
      { ax: 322, ay: 190, y: 196, title: 'Only from your Vault', text: 'No guessing, no outside sources.' },
      { ax: 244, ay: 236, y: 276, title: 'What you have in common', text: 'Pointed out during the chat.' },
      { ax: 392, ay: 350, y: 372, title: 'Similarity map', text: 'A score and shared interests, on higher tiers.' },
    ],
  },
  {
    title: 'Circles',
    body: (
      <>
        <b>Circles</b> decide what your LiAIson may tell whom. From Ambivert up you have an <b>Inner Circle</b> for friends and your
        close network and an <b>Outer Circle</b> for the public or your professional network; with Social Butterfly you can create
        your own circles. You choose someone&apos;s circle when you accept their connection request, and can change it any time. A{' '}
        <b>Public</b> profile lets anyone with an account talk to your LiAIson about your Outer Circle; a <b>Private</b> profile is
        open only to people you accepted.
      </>
    ),
    mock: <CirclesMock />,
    callouts: [
      { ax: 152, ay: 32, y: 34, title: 'Public or Private', text: 'Open to everyone, or only to your connections.' },
      { ax: 297, ay: 156, y: 120, title: 'Outer Circle', text: 'The public or your professional network.' },
      { ax: 237, ay: 215, y: 205, title: 'Inner Circle', text: 'Friends and your close network.' },
      { ax: 368, ay: 282, y: 290, title: 'Your own circles', text: 'Like Family or Climbing club, on Social Butterfly.' },
      { ax: 392, ay: 389, y: 392, title: 'Chosen when you accept', text: 'And changeable at any time.' },
    ],
  },
  {
    title: 'Discover',
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
    body: (
      <>
        Because LiAIson runs on AI, you pay for what you use: only for the messages you send to other LiAIsons, never for
        conversations others have with yours. A message typically costs between half a cent and two cents. Your usage is always
        visible, you can set a monthly limit, and you pay once at the end of the month. Higher tiers add a fixed monthly fee for
        their extra features.
      </>
    ),
    mock: <CostMock />,
    callouts: [
      { ax: 392, ay: 54, y: 46, title: 'Always visible', text: 'Your usage this month.' },
      { ax: 392, ay: 128, y: 124, title: 'Your monthly limit', text: 'You never pay more than you set.' },
      { ax: 392, ay: 182, y: 200, title: 'About 1 cent', text: 'Typically ½ to 2 cents per message.' },
      { ax: 392, ay: 224, y: 276, title: 'Paid at month end', text: 'One charge for everything you used.' },
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

  return (
    <div
      className="w-full"
      onKeyDown={e => {
        if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1) }
      }}
    >
      <div
        ref={trackRef}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,8fr)] gap-8 lg:gap-12 items-center">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-text-muted">{String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</p>
                <h3 className="mt-3 font-display text-3xl sm:text-4xl text-text-primary">{slide.title}</h3>
                <p className="mt-4 text-text-secondary leading-relaxed [&_b]:font-semibold [&_b]:text-text-primary">{slide.body}</p>
                {i === SLIDES.length - 1 && (
                  <Link href="/signup" className="mt-5 inline-block text-accent font-medium hover:underline">See tiers →</Link>
                )}
              </div>
              <Annotated mock={slide.mock} callouts={slide.callouts} active={i === index} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="h-10 w-10 rounded-full border border-border bg-surface text-text-primary disabled:opacity-30"
          aria-label="Previous"
        >
          ←
        </button>
        <div className="flex gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => go(i)}
              aria-label={`Go to ${s.title}`}
              aria-current={i === index ? 'step' : undefined}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-accent' : 'w-2 bg-border hover:bg-text-muted'}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(index + 1)}
          disabled={index === SLIDES.length - 1}
          className="h-10 w-10 rounded-full border border-border bg-surface text-text-primary disabled:opacity-30"
          aria-label="Next"
        >
          →
        </button>
      </div>
    </div>
  )
}
