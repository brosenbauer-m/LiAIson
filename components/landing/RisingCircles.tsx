'use client'

import { useEffect, useRef } from 'react'

// Home hero: circles of different sizes and transparencies drift up from the
// bottom, linked by faint lines to their neighbours, and fade out about a
// third of the way up the screen. Paused when off screen; nothing moves for
// people who prefer reduced motion.

type Circle = { x: number; y: number; r: number; speed: number; drift: number; alpha: number; tone: 0 | 1 }

const TONES = ['92, 59, 40', '140, 106, 82'] as const
const LINK_DISTANCE = 120

export default function RisingCircles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0
    let frame = 0
    let running = true
    let visible = true
    const circles: Circle[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const spawn = (anywhere = false) => {
      const r = 3 + Math.random() ** 2 * 26
      circles.push({
        x: Math.random() * width,
        y: anywhere ? height * (0.4 + Math.random() * 0.6) : height + r + Math.random() * 40,
        r,
        speed: 0.18 + Math.random() * 0.45,
        drift: (Math.random() - 0.5) * 0.15,
        alpha: 0.12 + Math.random() * 0.4,
        tone: Math.random() < 0.6 ? 0 : 1,
      })
    }

    // Fully visible near the bottom, gone at the top of the canvas.
    const fade = (y: number) => Math.max(0, Math.min(1, (y / height - 0.05) / 0.55))

    const target = () => Math.round(Math.max(18, Math.min(60, width / 24)))

    const tick = () => {
      if (!running) return
      frame = requestAnimationFrame(tick)
      if (!visible) return
      while (circles.length < target()) spawn()
      ctx.clearRect(0, 0, width, height)

      for (let i = circles.length - 1; i >= 0; i--) {
        const c = circles[i]
        c.y -= c.speed
        c.x += c.drift
        if (c.y + c.r < 0 || fade(c.y) <= 0) circles.splice(i, 1)
      }

      ctx.lineWidth = 1
      for (let i = 0; i < circles.length; i++) {
        for (let j = i + 1; j < circles.length; j++) {
          const a = circles[i]
          const b = circles[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d > LINK_DISTANCE) continue
          const alpha = (1 - d / LINK_DISTANCE) * Math.min(fade(a.y), fade(b.y)) * 0.28
          ctx.strokeStyle = `rgba(${TONES[0]}, ${alpha})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
      }

      for (const c of circles) {
        const f = fade(c.y)
        ctx.beginPath()
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${TONES[c.tone]}, ${c.alpha * f * 0.35})`
        ctx.fill()
        ctx.strokeStyle = `rgba(${TONES[c.tone]}, ${c.alpha * f})`
        ctx.stroke()
      }
    }

    resize()
    for (let i = 0; i < target(); i++) spawn(true)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    const io = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true })
    io.observe(canvas)
    frame = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-x-0 bottom-0 h-[42%] w-full pointer-events-none" aria-hidden="true" />
}
