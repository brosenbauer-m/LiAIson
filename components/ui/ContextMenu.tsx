'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// Right-click menus (owner request 2026-10-27): any item can call
// openContextMenu(event, items) from onContextMenu; one menu host lives in the
// root layout. Closes on a click elsewhere, Escape, scrolling or resizing.
// Arrow keys move between items, Enter chooses. On touch screens the normal
// buttons stay the way to do these things.

export type MenuItem =
  | { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }
  | { heading: string }
  | 'separator'

type Open = { x: number; y: number; items: MenuItem[] }

let show: ((menu: Open) => void) | null = null

export function openContextMenu(e: React.MouseEvent | MouseEvent, items: MenuItem[]) {
  // Text fields keep the browser's own menu (copy, paste, spelling).
  const t = e.target as Element | null
  if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return
  const usable = items.filter(i => i === 'separator' || 'heading' in i || !i.disabled)
  if (!show || !usable.some(i => i !== 'separator' && !('heading' in i))) return
  e.preventDefault()
  e.stopPropagation()
  show({ x: e.clientX, y: e.clientY, items })
}

export default function ContextMenuHost() {
  const [menu, setMenu] = useState<Open | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    show = m => { setPos(null); setMenu(m) }
    return () => { show = null }
  }, [])

  // Keep the menu on screen.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8)),
    })
    ref.current.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus()
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onDown = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const list = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? [])]
      const i = list.indexOf(document.activeElement as HTMLButtonElement)
      list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus()
    }
    document.addEventListener('pointerdown', onDown, true)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('blur', close)
    return () => {
      document.removeEventListener('pointerdown', onDown, true)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('blur', close)
    }
  }, [menu])

  if (!menu) return null
  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[120] min-w-[12rem] max-w-[18rem] max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-card animate-message-in"
      style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
      onContextMenu={e => e.preventDefault()}
    >
      {menu.items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="my-1 border-t border-border" role="separator" />
        ) : 'heading' in item ? (
          <p key={i} className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">{item.heading}</p>
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { setMenu(null); item.onSelect() }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate focus:outline-none disabled:opacity-40 ${
              item.danger ? 'text-error hover:bg-error/10 focus:bg-error/10' : 'text-text-primary hover:bg-accent-tint focus:bg-accent-tint'
            }`}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
