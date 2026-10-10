'use client'

import { useEffect, useState } from 'react'

// Presentation-style paging for the home page on desktop (fine pointer, ≥768px):
// one wheel gesture or arrow key moves to the next full-screen section with a
// slow ease, instead of the browser's quick snap. A section taller than the
// screen scrolls normally until its end, then the next gesture pages on.
// Touch devices and "reduce motion" keep native scrolling. Also returns
// `paging` so the page can switch off CSS snapping while this is active.

const DURATION = 950
const COOLDOWN = 700

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function useSectionPager(container: React.RefObject<HTMLElement | null>) {
  const [paging, setPaging] = useState(false)

  useEffect(() => {
    const el = container.current
    if (!el) return
    const media = window.matchMedia('(min-width: 768px) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let enabled = media.matches && !reduced.matches
    const initial = setTimeout(() => setPaging(enabled), 0)

    let animating = false
    let lockedUntil = 0
    let frame = 0

    const sections = () => Array.from(el.querySelectorAll<HTMLElement>('[data-section]'))

    const scrollToY = (target: number) => {
      cancelAnimationFrame(frame)
      const start = el.scrollTop
      const distance = target - start
      if (Math.abs(distance) < 2) return
      const t0 = performance.now()
      animating = true
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / DURATION)
        el.scrollTop = start + distance * ease(t)
        if (t < 1) frame = requestAnimationFrame(step)
        else {
          animating = false
          lockedUntil = performance.now() + COOLDOWN
        }
      }
      frame = requestAnimationFrame(step)
    }

    const current = () => {
      const list = sections()
      const y = el.scrollTop + 2
      let index = 0
      list.forEach((s, i) => { if (s.offsetTop <= y) index = i })
      return { list, index }
    }

    const goTo = (i: number) => {
      const list = sections()
      const target = list[Math.max(0, Math.min(list.length - 1, i))]
      if (target) scrollToY(target.offsetTop)
    }

    const page = (dir: 1 | -1) => {
      const { list, index } = current()
      const s = list[index]
      if (!s) return false
      const top = s.offsetTop
      const bottom = top + s.offsetHeight
      const viewTop = el.scrollTop
      const viewBottom = viewTop + el.clientHeight
      // Inside a tall section: let it scroll normally first.
      if (dir === 1 && bottom > viewBottom + 2) return false
      if (dir === -1 && viewTop > top + 2) return false
      if (dir === 1 && index === list.length - 1) return false
      if (dir === -1 && index === 0) return false
      goTo(index + dir)
      return true
    }

    const onWheel = (e: WheelEvent) => {
      if (!enabled || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      if (animating || performance.now() < lockedUntil) {
        e.preventDefault()
        return
      }
      if (Math.abs(e.deltaY) < 4) return
      if (page(e.deltaY > 0 ? 1 : -1)) e.preventDefault()
    }

    const onKey = (e: KeyboardEvent) => {
      if (!enabled) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)
      const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)
      if (!down && !up) return
      if (animating) { e.preventDefault(); return }
      if (page(down ? 1 : -1)) e.preventDefault()
    }

    // In-page links (#how-it-works) and the header link (/#how-it-works).
    const toHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      const target = id ? el.querySelector<HTMLElement>(`#${CSS.escape(id)}`) : null
      if (target) scrollToY(target.offsetTop)
    }
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest('a')
      const href = a?.getAttribute('href') ?? ''
      if (!href.startsWith('#') || href.length < 2) return
      const target = el.querySelector<HTMLElement>(href)
      if (!target) return
      e.preventDefault()
      history.replaceState(null, '', href)
      scrollToY(target.offsetTop)
    }

    const onMedia = () => {
      enabled = media.matches && !reduced.matches
      setPaging(enabled)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('hashchange', toHash)
    el.addEventListener('click', onClick)
    media.addEventListener('change', onMedia)
    reduced.addEventListener('change', onMedia)
    if (window.location.hash) setTimeout(toHash, 50)

    return () => {
      clearTimeout(initial)
      cancelAnimationFrame(frame)
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('hashchange', toHash)
      el.removeEventListener('click', onClick)
      media.removeEventListener('change', onMedia)
      reduced.removeEventListener('change', onMedia)
    }
  }, [container])

  return paging
}

// Marks [data-reveal] blocks as visible when their section comes into view,
// so their content can ease in (CSS in globals.css).
export function useReveal(container: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = container.current
    if (!el) return
    const items = Array.from(el.querySelectorAll<HTMLElement>('[data-reveal]'))
    const io = new IntersectionObserver(
      entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.setAttribute('data-reveal', 'in') }),
      { root: el, threshold: 0.25 }
    )
    items.forEach(item => io.observe(item))
    return () => io.disconnect()
  }, [container])
}
