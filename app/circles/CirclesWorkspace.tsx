'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { openContextMenu, type MenuItem } from '@/components/ui/ContextMenu'
import { createClient } from '@/lib/supabase/client'
import CircleBoard, { type BoardHandle, type CircleStats } from '@/components/circles/CircleBoard'
import type { StudioCircle } from '@/components/circles/layout'
import { play } from '@/components/circles/sound'
import { circleChain } from '@/lib/circles'
import Avatar from '@/components/ui/Avatar'
import TierMark from '@/components/ui/TierMark'

// Circles page workspace: Connections (left), the circles (middle) and Vault
// sections (right). Selecting a circle filters both panels: people who see that
// circle (through the hierarchy, lib/access/resolveScope.ts) and the sections
// placed in it. People and sections can be selected in groups and dragged onto
// a circle (mouse), or moved with "Move to" (any device). Own circles (Social
// Butterfly) can be created, arranged by dragging, renamed and deleted.

export type WorkspacePerson = {
  userId: string
  connectionId: string
  username: string
  name: string
  avatarUrl: string | null
  plan: string | null
  inInner: boolean
  circles: string[] // own circles they were put in
}
export type WorkspaceSection = {
  id: string
  label: string
  circle: 'outer' | 'inner' | 'draft' | 'custom'
  customCircleId: string | null
  chars: number
}

type Kind = 'people' | 'sections'
const isOwn = (id: string) => id !== 'outer' && id !== 'inner' && id !== 'alone' && id !== 'draft'
const MIN_DRAG = 6

export default function CirclesWorkspace({
  initialPeople,
  initialSections,
  initialCircles,
  allowed,
}: {
  initialPeople: WorkspacePerson[]
  initialSections: WorkspaceSection[]
  initialCircles: StudioCircle[]
  allowed: number
}) {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [people, setPeople] = useState(initialPeople)
  const [sections, setSections] = useState(initialSections)
  const [circles, setCircles] = useState(initialCircles)
  // Fresh server data (e.g. after accepting a request) replaces the local copy.
  const [fromServer, setFromServer] = useState({ initialPeople, initialSections, initialCircles })
  if (fromServer.initialPeople !== initialPeople || fromServer.initialSections !== initialSections || fromServer.initialCircles !== initialCircles) {
    setFromServer({ initialPeople, initialSections, initialCircles })
    setPeople(initialPeople)
    setSections(initialSections)
    setCircles(initialCircles)
  }
  const canCustom = allowed > 0
  const nodes = useMemo(() => new Map(circles.map(c => [c.id, c])), [circles])
  const ids = useMemo(() => ['outer', 'inner', ...circles.map(c => c.id)], [circles])
  const nameOf = useCallback(
    (id: string) => (id === 'outer' ? 'Outer Circle' : id === 'inner' ? 'Inner Circle' : id === 'draft' ? 'Drafts' : nodes.get(id)?.name ?? ''),
    [nodes]
  )

  // Which circles each person sees (same rules as resolveCircles).
  const seen = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const p of people) {
      const s = new Set<string>()
      let innerVia = false
      let inAny = false
      let insideOuter = false
      for (const id of p.circles) {
        const chain = circleChain(id, nodes)
        if (chain.length === 0) continue
        chain.forEach(c => s.add(c.id))
        const root = chain[chain.length - 1]
        inAny = true
        if (root.in_inner) innerVia = true
        if (!root.isolated) insideOuter = true
      }
      if (p.inInner || innerVia) s.add('inner')
      if (p.inInner || innerVia || !inAny || insideOuter) s.add('outer')
      map.set(p.userId, s)
    }
    return map
  }, [people, nodes])

  const sectionsIn = useCallback((id: string) => sections.filter(s =>
    id === 'outer' ? s.circle === 'outer'
      : id === 'inner' ? s.circle === 'inner'
        : id === 'draft' ? s.circle === 'draft' || (s.circle === 'custom' && !s.customCircleId)
          : s.circle === 'custom' && s.customCircleId === id), [sections])

  const stats: CircleStats = useMemo(() => Object.fromEntries(ids.map(id => [id, {
    people: people.filter(p => seen.get(p.userId)?.has(id)).length,
    sections: sectionsIn(id).length,
  }])), [ids, people, seen, sectionsIn])

  // The circles around a circle (innermost first): its people see them too.
  const around = useCallback((id: string): string[] => {
    if (id === 'outer' || id === 'draft') return []
    if (id === 'inner') return ['outer']
    const chain = circleChain(id, nodes)
    const out = chain.slice(1).map(c => c.id)
    const root = chain[chain.length - 1]
    if (root?.in_inner) out.push('inner')
    if (root && !root.isolated) out.push('outer')
    return out
  }, [nodes])

  // Starts on the circle with the most people (usually the Outer Circle).
  // null = no circle selected: everything shows (owner 2026-10-27: a click on
  // empty space deselects).
  const [selected, setSelected] = useState<string | null>(() => ids.reduce((best, id) => (stats[id].people > stats[best].people ? id : best), 'outer'))
  const [sectionView, setSectionView] = useState<'circle' | 'draft'>('circle')
  const [mobileTab, setMobileTab] = useState<Kind>('people')
  const [pickedPeople, setPickedPeople] = useState<Set<string>>(new Set())
  const [pickedSections, setPickedSections] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [lockedNote, setLockedNote] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState<{ target: string } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const boardRef = useRef<BoardHandle>(null)
  const [panelDrag, setPanelDrag] = useState<{ kind: Kind; ids: string[]; x: number; y: number } | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const press = useRef<{ kind: Kind; id: string; x: number; y: number; started: boolean } | null>(null)

  const select = (id: string | null) => {
    setSelected(id)
    setSectionView('circle')
    setPickedPeople(new Set())
    setPickedSections(new Set())
    setRenaming(false)
    setDeleting(null)
    setConfirmRemove(false)
  }

  // --- Changes (optimistic; undone if the server says no) -------------------

  // Both resolve false when the move failed (and was undone).
  const movePeople = async (userIds: string[], target: string): Promise<boolean> => {
    if (userIds.length === 0 || target === 'alone' || target === 'draft') return true
    const before = people
    setError('')
    setPeople(prev => prev.map(p => (userIds.includes(p.userId) ? { ...p, inInner: target === 'inner', circles: isOwn(target) ? [target] : [] } : p)))
    setPickedPeople(new Set())
    play('drop')
    try {
      const res = await fetch('/api/circles/place', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberIds: userIds, target }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not move them. Please try again.')
      return true
    } catch (err) {
      setPeople(before)
      play('back')
      setError((err as Error).message)
      return false
    }
  }

  const moveSections = async (sectionIds: string[], target: string): Promise<boolean> => {
    if (sectionIds.length === 0 || target === 'alone') return true
    const before = sections
    const fields = target === 'outer' || target === 'inner' || target === 'draft'
      ? { circle: target as WorkspaceSection['circle'], customCircleId: null }
      : { circle: 'custom' as const, customCircleId: target }
    setError('')
    setSections(prev => prev.map(s => (sectionIds.includes(s.id) ? { ...s, ...fields } : s)))
    setPickedSections(new Set())
    play('drop')
    const { error: dbError } = await supabase
      .from('vault_sections')
      .update({ circle: fields.circle, custom_circle_id: fields.customCircleId, updated_at: new Date().toISOString() })
      .in('id', sectionIds)
    if (dbError) {
      setSections(before)
      play('back')
      setError('Could not move these sections. Please try again.')
      return false
    }
    void fetch('/api/discover/index', { method: 'POST' }).catch(() => {})
    return true
  }

  const circlesApi = async (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, string>) => {
    const res = await fetch('/api/circles', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong. Please try again.')
    return data
  }

  const moveCircle = async (id: string, target: string) => {
    const before = circles
    setError('')
    setCircles(prev => prev.map(c => (c.id === id
      ? { ...c, parent_id: isOwn(target) ? target : null, in_inner: target === 'inner', isolated: target === 'alone' }
      : c)))
    try {
      await circlesApi('PATCH', { id, parent: target })
    } catch (err) {
      setCircles(before)
      play('back')
      setError((err as Error).message)
    }
  }

  const createCircle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setBusy(true)
    setError('')
    try {
      const { circle } = await circlesApi('POST', { name: newName })
      setCircles(prev => [...prev, { ...circle, memberCount: 0 }])
      setNewName('')
      setCreating(false)
      play('drop')
      select(circle.id)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const renameCircle = async (id: string, name: string) => {
    setBusy(true)
    setError('')
    try {
      const { circle } = await circlesApi('PATCH', { id, name })
      setCircles(prev => prev.map(c => (c.id === id ? { ...c, name: circle.name } : c)))
      setRenaming(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Deleting asks where its people (and its sections) go. People who are also
  // in other own circles simply stay there.
  const deleteCircle = async (id: string, target: string) => {
    setBusy(true)
    setError('')
    try {
      const only = people.filter(p => p.circles.length === 1 && p.circles[0] === id).map(p => p.userId)
      // Stop if moving its people or sections failed, so nothing lands elsewhere.
      if (only.length > 0 && !(await movePeople(only, target))) return
      const secs = sectionsIn(id).map(s => s.id)
      if (secs.length > 0 && !(await moveSections(secs, target))) return
      await circlesApi('DELETE', { id })
      const gone = circles.find(c => c.id === id)
      const top = !gone?.parent_id
      setCircles(prev => prev.filter(c => c.id !== id).map(c => (c.parent_id === id
        ? { ...c, parent_id: gone?.parent_id ?? null, in_inner: top && !!gone?.in_inner, isolated: top && !!gone?.isolated }
        : c)))
      setPeople(prev => prev.map(p => ({ ...p, circles: p.circles.filter(c => c !== id) })))
      select(target)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const removeConnection = async (person: WorkspacePerson) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/connections/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connectionId: person.connectionId }) })
      if (!res.ok) throw new Error('Could not remove this connection. Please try again.')
      setPeople(prev => prev.filter(p => p.userId !== person.userId))
      setPickedPeople(new Set())
      setConfirmRemove(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // --- Dragging people / sections from the panels onto a circle -------------
  // With a mouse the whole row drags; on touch screens the grip handle does
  // (so the list still scrolls). The page scrolls along near the screen edges.

  // Touch: tapping a row selects it (mouse presses select in onRowPointerUp).
  const lastPointer = useRef('mouse')
  const onRowClick = (e: React.MouseEvent, kind: Kind, id: string) => {
    if (lastPointer.current === 'mouse' || (e.target as HTMLElement).closest('input, button, a, [data-grip]')) return
    togglePick(kind, id)
  }

  const onRowPointerDown = (e: React.PointerEvent, kind: Kind, id: string) => {
    lastPointer.current = e.pointerType
    const fromHandle = !!(e.target as HTMLElement).closest('[data-grip]')
    if (e.button > 0 || (e.pointerType !== 'mouse' && !fromHandle)) return
    if (!fromHandle && (e.target as HTMLElement).closest('input, button, a, select')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    press.current = { kind, id, x: e.clientX, y: e.clientY, started: false }
  }
  const onRowPointerMove = (e: React.PointerEvent) => {
    const p = press.current
    if (!p) return
    if (!p.started && Math.hypot(e.clientX - p.x, e.clientY - p.y) < MIN_DRAG) return
    const picked = p.kind === 'people' ? pickedPeople : pickedSections
    if (!p.started) { p.started = true; play('lift') }
    if (e.clientY < 90) window.scrollBy(0, -16)
    else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 16)
    setPanelDrag({ kind: p.kind, ids: picked.has(p.id) ? [...picked] : [p.id], x: e.clientX, y: e.clientY })
    setDropTarget(boardRef.current?.hitTest(e.clientX, e.clientY) ?? null)
  }
  const onRowPointerUp = (e: React.PointerEvent) => {
    const p = press.current
    press.current = null
    if (!p) return
    if (!p.started) {
      togglePick(p.kind, p.id)
      return
    }
    const target = boardRef.current?.hitTest(e.clientX, e.clientY) ?? null
    const drag = panelDrag
    setPanelDrag(null)
    setDropTarget(null)
    if (!target || !drag) { play('back'); return }
    if (drag.kind === 'people') void movePeople(drag.ids, target)
    else void moveSections(drag.ids, target)
  }
  const onRowPointerCancel = () => { press.current = null; setPanelDrag(null); setDropTarget(null) }

  const togglePick = (kind: Kind, id: string) => {
    const set = kind === 'people' ? setPickedPeople : setPickedSections
    set(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setConfirmRemove(false)
  }

  // --- Right-click menus ----------------------------------------------------

  // Circles something can be moved into (not itself or a circle inside it).
  const moveTargets = (except?: string): string[] =>
    ids.filter(id => id !== except && !(except && isOwn(id) && circleChain(id, nodes).some(c => c.id === except)))

  const circleMenu = (id: string, e: React.MouseEvent) => {
    const own = isOwn(id)
    const c = nodes.get(id)
    const items: MenuItem[] = [{ heading: nameOf(id) }, { label: 'Show Its People and Sections', onSelect: () => select(id) }]
    if (own && canCustom && c) {
      items.push(
        { label: 'Rename', onSelect: () => { select(id); setRenaming(true) } },
        'separator',
        { heading: 'Move Into' },
        ...moveTargets(id).map(t => ({ label: nameOf(t), onSelect: () => void moveCircle(id, t), disabled: (t === 'outer' && !c.parent_id && !c.in_inner && !c.isolated) || c.parent_id === t || (t === 'inner' && c.in_inner && !c.parent_id) })),
        { label: 'On Its Own (Outside the Outer Circle)', onSelect: () => void moveCircle(id, 'alone'), disabled: c.isolated },
        'separator',
        { label: 'Delete', danger: true, onSelect: () => { select(id); setDeleting({ target: c.parent_id ?? (c.in_inner ? 'inner' : 'outer') }) } },
      )
    }
    openContextMenu(e, items)
  }

  const personMenu = (p: WorkspacePerson, e: React.MouseEvent) => {
    openContextMenu(e, [
      { heading: p.name },
      { label: 'Open LiAIson', onSelect: () => router.push(`/${p.username}`) },
      { label: pickedPeople.has(p.userId) ? 'Unselect' : 'Select', onSelect: () => togglePick('people', p.userId) },
      'separator',
      { heading: 'Move To' },
      ...moveTargets().map(t => ({ label: nameOf(t), onSelect: () => void movePeople([p.userId], t) })),
      'separator',
      { label: 'Remove Connection', danger: true, onSelect: () => { setPickedPeople(new Set([p.userId])); setConfirmRemove(true) } },
    ])
  }

  const sectionMenu = (s: WorkspaceSection, e: React.MouseEvent) => {
    openContextMenu(e, [
      { heading: s.label },
      { label: 'Open in Vault', onSelect: () => router.push('/vault') },
      { label: pickedSections.has(s.id) ? 'Unselect' : 'Select', onSelect: () => togglePick('sections', s.id) },
      'separator',
      { heading: 'Move To' },
      ...[...moveTargets(), 'draft'].map(t => ({ label: nameOf(t), onSelect: () => void moveSections([s.id], t) })),
    ])
  }

  // --- What the panels show --------------------------------------------------

  const shownPeople = selected === null ? people : people.filter(p => seen.get(p.userId)?.has(selected))
  const homeOf = (p: WorkspacePerson) => (p.circles.length > 0 ? p.circles.map(nameOf).join(', ') : p.inInner ? 'Inner Circle' : 'Outer Circle')
  const sectionCircle = sectionView === 'draft' ? 'draft' : selected
  const shownSections = sectionCircle === null ? sections : sectionsIn(sectionCircle)
  const inherited = sectionView === 'draft' || selected === null ? [] : around(selected).flatMap(id => sectionsIn(id).map(s => ({ ...s, from: nameOf(id) })))
  const draftCount = sectionsIn('draft').length
  const sel = selected === null ? undefined : nodes.get(selected)
  const chipName = (id: string | null) => (id === null ? 'All' : nameOf(id))

  const pickedPerson = pickedPeople.size === 1 ? people.find(p => pickedPeople.has(p.userId)) : undefined

  const panelClass = 'bg-card border border-border rounded-3xl shadow-soft flex flex-col lg:max-h-[78vh]'
  const circleChip = (label: string) => (
    <span className="inline-flex items-center max-w-[10rem] truncate rounded-full bg-accent-tint px-3 py-1 text-xs font-medium text-accent">{label}</span>
  )
  const grip = (label: string) => (
    <span
      data-grip
      role="img"
      aria-label={`Drag ${label} onto a circle`}
      className="ml-auto flex-shrink-0 p-1.5 -mr-1 rounded-lg text-text-muted hover:text-accent touch-none cursor-grab"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <circle cx="5" cy="3" r="1.2" /><circle cx="9" cy="3" r="1.2" /><circle cx="5" cy="7" r="1.2" /><circle cx="9" cy="7" r="1.2" /><circle cx="5" cy="11" r="1.2" /><circle cx="9" cy="11" r="1.2" />
      </svg>
    </span>
  )
  const actionBar = (kind: Kind, count: number) => (
    <div className="border-t border-border p-3 space-y-2 bg-surface/60 rounded-b-3xl">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-text-primary">{count} selected</span>
        <span className="text-text-muted">Drag them onto a circle</span>
        <button type="button" onClick={() => (kind === 'people' ? setPickedPeople(new Set()) : setPickedSections(new Set()))} className="ml-auto text-text-secondary hover:text-text-primary">
          Clear
        </button>
      </div>
      {kind === 'people' && pickedPerson && (
        confirmRemove ? (
          <p className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-text-secondary">Remove {pickedPerson.name}? They lose access beyond your public profile.</span>
            <button type="button" disabled={busy} onClick={() => removeConnection(pickedPerson)} className="px-2.5 py-1 rounded-full border border-error/40 text-error hover:bg-error hover:text-white disabled:opacity-50">Remove</button>
            <button type="button" onClick={() => setConfirmRemove(false)} className="text-text-secondary">Cancel</button>
          </p>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)} className="text-xs text-text-muted hover:text-error">Remove Connection</button>
        )
      )}
    </div>
  )

  const peoplePanel = (
    <section className={panelClass} aria-label="Connections">
      <header className="flex items-center justify-between gap-3 p-4 pb-3">
        <h2 className="font-semibold text-text-primary">Connections <span className="text-text-muted font-normal tabular-nums">{shownPeople.length}</span></h2>
        {circleChip(chipName(selected))}
      </header>
      <ul className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {shownPeople.length === 0 && <li className="px-3 py-8 text-center text-sm text-text-muted">No one sees this circle yet.</li>}
        {shownPeople.map(p => {
          const picked = pickedPeople.has(p.userId)
          return (
            <li
              key={p.userId}
              onPointerDown={e => onRowPointerDown(e, 'people', p.userId)}
              onClick={e => onRowClick(e, 'people', p.userId)}
              onContextMenu={e => personMenu(p, e)}
              onPointerMove={onRowPointerMove}
              onPointerUp={onRowPointerUp}
              onPointerCancel={onRowPointerCancel}
              className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 cursor-grab select-none transition-colors ${picked ? 'bg-accent-subtle' : 'hover:bg-accent-tint'}`}
            >
              <input
                type="checkbox"
                checked={picked}
                onChange={() => togglePick('people', p.userId)}
                aria-label={`Select ${p.name}`}
                className="h-4 w-4 accent-accent flex-shrink-0"
              />
              <Avatar url={p.avatarUrl} name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <Link href={`/${p.username}`} className="inline-block max-w-full align-top text-sm font-medium text-text-primary truncate hover:underline">{p.name}</Link> <TierMark plan={p.plan} />
                <p className="text-[11px] text-text-muted truncate">{homeOf(p)}</p>
              </div>
              {grip(p.name)}
            </li>
          )
        })}
      </ul>
      {pickedPeople.size > 0 && actionBar('people', pickedPeople.size)}
    </section>
  )

  const sectionsPanel = (
    <section className={panelClass} aria-label="Vault sections">
      <header className="flex items-center justify-between gap-3 p-4 pb-3">
        <h2 className="font-semibold text-text-primary">Sections <span className="text-text-muted font-normal tabular-nums">{shownSections.length}</span></h2>
        {circleChip(chipName(sectionCircle))}
      </header>
      <ul className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {shownSections.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-text-muted">
            {sectionView === 'draft' ? 'No drafts.' : 'No sections in this circle.'}{' '}
            <Link href="/vault" className="text-accent hover:underline">Open Vault</Link>
          </li>
        )}
        {shownSections.map(s => {
          const picked = pickedSections.has(s.id)
          return (
            <li
              key={s.id}
              onPointerDown={e => onRowPointerDown(e, 'sections', s.id)}
              onClick={e => onRowClick(e, 'sections', s.id)}
              onContextMenu={e => sectionMenu(s, e)}
              onPointerMove={onRowPointerMove}
              onPointerUp={onRowPointerUp}
              onPointerCancel={onRowPointerCancel}
              className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 cursor-grab select-none transition-colors ${picked ? 'bg-accent-subtle' : 'hover:bg-accent-tint'}`}
            >
              <input
                type="checkbox"
                checked={picked}
                onChange={() => togglePick('sections', s.id)}
                aria-label={`Select ${s.label}`}
                className="h-4 w-4 accent-accent flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-text-primary truncate">{s.label}</p>
                <p className="text-[11px] text-text-muted tabular-nums">{s.chars.toLocaleString('en-GB')} characters</p>
              </div>
              {grip(s.label)}
            </li>
          )
        })}
        {inherited.length > 0 && (
          <>
            <li className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide text-text-muted">Also seen here</li>
            {inherited.map(s => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl px-2.5 py-1.5 opacity-60">
                <span className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-secondary truncate">{s.label}</p>
                  <p className="text-[11px] text-text-muted truncate">From {s.from}</p>
                </div>
              </li>
            ))}
          </>
        )}
      </ul>
      {sectionView === 'draft' && pickedSections.size === 0 && (
        <button type="button" onClick={() => setSectionView('circle')} className="mx-4 mb-3 text-left text-xs text-text-muted hover:text-accent">
          ← Back to {chipName(selected)}
        </button>
      )}
      {sectionView === 'circle' && selected !== null && draftCount > 0 && pickedSections.size === 0 && (
        <button type="button" onClick={() => { setSectionView('draft'); setPickedSections(new Set()) }} className="mx-4 mb-3 text-left text-xs text-text-muted hover:text-accent">
          {draftCount} {draftCount === 1 ? 'draft' : 'drafts'} not in any circle →
        </button>
      )}
      {pickedSections.size > 0 && actionBar('sections', pickedSections.size)}
    </section>
  )

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error" role="alert">{error}</p>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(0,18rem)] lg:items-start">
        {/* The circles */}
        <div
          className="order-1 lg:order-2 flex flex-col items-center gap-6"
          // A click on empty space (not a circle, button or field) deselects.
          onClick={e => {
            const t = e.target as Element
            if (t.closest('button, a, input, select, textarea, form, [role="dialog"]')) return
            // On the board, the circles' real (round) shapes decide.
            if (t.closest('[role="button"]') && boardRef.current?.hitTest(e.clientX, e.clientY)) return
            select(null)
          }}
        >
          <CircleBoard
            ref={boardRef}
            circles={circles}
            innerAllowed
            stats={stats}
            selected={selected}
            onSelect={id => select(id)}
            onCircleMenu={circleMenu}
            canArrange={canCustom}
            onMoveCircle={moveCircle}
            dropTarget={dropTarget}
          />

          {/* The selected circle */}
          <div className="w-full max-w-md text-center space-y-3" aria-live="polite">
            {renaming && sel ? (
              <form
                className="flex gap-2"
                onSubmit={e => {
                  e.preventDefault()
                  const v = new FormData(e.currentTarget).get('name')
                  if (typeof v === 'string' && v.trim()) void renameCircle(sel.id, v)
                }}
              >
                <input name="name" defaultValue={sel.name} maxLength={40} autoFocus aria-label="Circle name" className="flex-1 min-w-0 bg-background border border-border rounded-full px-4 py-2 text-sm text-text-primary focus:outline-none focus:border-accent" />
                <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-full disabled:opacity-50">Save</button>
                <button type="button" onClick={() => setRenaming(false)} className="px-2 text-sm text-text-secondary">Cancel</button>
              </form>
            ) : (
              selected !== null && around(selected).length > 0 && (
                <p className="text-sm text-text-secondary">
                  Individuals in this Circle also see {around(selected).map(nameOf).join(', ').replace(/, ([^,]*)$/, ' and $1')}.
                </p>
              )
            )}
            {sel && canCustom && !renaming && !deleting && (
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
                <button type="button" onClick={() => setRenaming(true)} className="px-5 py-2 rounded-full border-2 border-accent/50 text-accent hover:bg-accent hover:text-white hover:border-accent transition-colors">Rename</button>
                <button type="button" onClick={() => setDeleting({ target: sel.parent_id ?? (sel.in_inner ? 'inner' : 'outer') })} className="px-5 py-2 rounded-full border-2 border-error text-error hover:bg-error hover:text-white transition-colors">Delete</button>
              </div>
            )}
            {sel && deleting && (
              <div className="rounded-2xl border border-border bg-surface p-4 space-y-3 text-left" role="dialog" aria-label={`Delete ${sel.name}`}>
                <p className="text-sm text-text-primary">Delete <b>{sel.name}</b>? Where should its people and its {sectionsIn(sel.id).length} Vault {sectionsIn(sel.id).length === 1 ? 'section' : 'sections'} move?</p>
                <select
                  value={deleting.target}
                  onChange={e => setDeleting({ target: e.target.value })}
                  aria-label="Move them to"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {ids.filter(id => id !== sel.id).map(id => <option key={id} value={id}>{nameOf(id)}</option>)}
                </select>
                <p className="text-xs text-text-muted">Circles inside it move up one level. People who are also in another circle stay there.</p>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={() => deleteCircle(sel.id, deleting.target)} className="px-4 py-2 rounded-full bg-error text-white text-sm font-medium disabled:opacity-50">
                    {busy ? 'Deleting…' : 'Delete and Move'}
                  </button>
                  <button type="button" onClick={() => setDeleting(null)} className="px-3 py-2 text-sm text-text-secondary">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Create Circle (own circles: Social Butterfly) */}
          <div className="w-full max-w-sm text-center">
            {creating ? (
              <form onSubmit={createCircle} className="flex gap-2">
                <input value={newName} onChange={e => setNewName(e.target.value)} maxLength={40} autoFocus placeholder="New circle, e.g. Family" aria-label="New circle name" className="flex-1 min-w-0 bg-background border border-border rounded-full px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent" />
                <button type="submit" disabled={busy || !newName.trim()} className="px-5 py-2.5 bg-accent hover:bg-accent-light text-white text-sm font-medium rounded-full disabled:opacity-50">Add</button>
                <button type="button" onClick={() => setCreating(false)} className="px-2 text-sm text-text-secondary">Cancel</button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!canCustom) { setLockedNote(true); return }
                  if (circles.length >= allowed) { setError(`You have all ${allowed} circles your plan allows. You can allow more in Settings.`); return }
                  setCreating(true)
                }}
                aria-disabled={!canCustom}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium shadow-card ${
                  canCustom ? 'bg-accent hover:bg-accent-light text-white' : 'bg-accent/30 text-white cursor-not-allowed'
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">+</span> Create Circle
              </button>
            )}
            {!canCustom && lockedNote && (
              <p className="mt-2 text-sm italic text-text-muted">
                <Link href="/settings#subscription" className="hover:text-accent underline-offset-2 hover:underline">To use this feature please upgrade tiers.</Link>
              </p>
            )}
            {canCustom && <p className="mt-2 text-xs text-text-muted tabular-nums">{circles.length} of {allowed} own circles</p>}
          </div>
        </div>

        {/* Phones: one panel at a time */}
        <div className="order-2 lg:hidden inline-flex self-center justify-self-center rounded-full border border-border bg-surface p-1" role="tablist">
          {(['people', 'sections'] as Kind[]).map(k => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mobileTab === k}
              onClick={() => setMobileTab(k)}
              className={`px-5 py-2 rounded-full text-sm font-medium ${mobileTab === k ? 'bg-accent text-white shadow-soft' : 'text-text-secondary'}`}
            >
              {k === 'people' ? `Connections (${shownPeople.length})` : `Sections (${shownSections.length})`}
            </button>
          ))}
        </div>

        <div className={`order-3 lg:order-1 lg:sticky lg:top-24 ${mobileTab === 'people' ? '' : 'hidden lg:block'}`}>{peoplePanel}</div>
        <div className={`order-4 lg:order-3 lg:sticky lg:top-24 ${mobileTab === 'sections' ? '' : 'hidden lg:block'}`}>{sectionsPanel}</div>
      </div>

      {/* What is being dragged from a panel */}
      {panelDrag && (
        <div className="fixed z-[70] pointer-events-none px-3 py-1.5 rounded-full bg-accent text-white text-xs font-medium shadow-card" style={{ left: panelDrag.x + 14, top: panelDrag.y + 10 }}>
          {panelDrag.ids.length} {panelDrag.kind === 'people' ? (panelDrag.ids.length === 1 ? 'person' : 'people') : (panelDrag.ids.length === 1 ? 'section' : 'sections')}
          {dropTarget ? ` → ${nameOf(dropTarget)}` : ''}
        </div>
      )}
    </div>
  )
}
