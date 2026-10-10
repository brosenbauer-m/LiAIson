// Layout for the Circle Studio: circles drawn inside the circle they sit in
// (Outer > Inner > own circles, see lib/circles.ts). Pure functions, no React.

export type StudioCircle = { id: string; name: string; parent_id: string | null; in_inner: boolean; memberCount: number }

export type NodeKind = 'outer' | 'inner' | 'custom'

export type LaidOut = {
  id: string // 'outer' | 'inner' | circle id
  kind: NodeKind
  name: string
  count: number
  parent: string | null
  depth: number // 0 = Outer
  x: number // centre, relative to the Outer Circle's centre
  y: number
  r: number
  hasChildren: boolean
}

type Tree = { id: string; kind: NodeKind; name: string; count: number; children: Tree[]; r: number; x: number; y: number }

const GAP = 10 // between sibling circles
const PAD = 12 // between children and the circle around them
// Room for the name at the top of a circle with circles inside, and the
// smallest circle; both grow on small screens (see layoutCircles options).
type Sizes = { label: number; leafMin: number }
export const MAX_CUSTOM_DEPTH = 4 // as in migration 30

// A circle with nothing inside is sized to its name.
function leafRadius(name: string, min: number): number {
  return Math.max(min, Math.min(58, name.length * 3.6 + 18))
}

// Places circles of the given radii close together without overlapping,
// largest first, each where it keeps the group smallest. Returns the group's
// enclosing radius; positions are written into the items (centred on 0,0).
function pack(items: Tree[]): number {
  const order = [...items].sort((a, b) => b.r - a.r || a.id.localeCompare(b.id))
  const placed: Tree[] = []
  const fits = (x: number, y: number, r: number) =>
    placed.every(p => Math.hypot(p.x - x, p.y - y) >= p.r + r + GAP - 0.01)
  for (const c of order) {
    if (placed.length === 0) { c.x = 0; c.y = 0 }
    else if (placed.length === 1) { c.x = placed[0].r + c.r + GAP; c.y = 0 }
    else {
      let best: [number, number] | null = null
      let bestScore = Infinity
      const consider = (x: number, y: number) => {
        if (!fits(x, y, c.r)) return
        const score = Math.hypot(x, y) + c.r
        if (score < bestScore) { bestScore = score; best = [x, y] }
      }
      for (let i = 0; i < placed.length; i++) {
        const a = placed[i]
        for (let j = i + 1; j < placed.length; j++) {
          const b = placed[j]
          const da = a.r + c.r + GAP
          const db = b.r + c.r + GAP
          const d = Math.hypot(b.x - a.x, b.y - a.y)
          if (d === 0 || d > da + db || d < Math.abs(da - db)) continue
          const along = (da * da - db * db + d * d) / (2 * d)
          const h = Math.sqrt(Math.max(0, da * da - along * along))
          const ux = (b.x - a.x) / d
          const uy = (b.y - a.y) / d
          consider(a.x + along * ux - h * uy, a.y + along * uy + h * ux)
          consider(a.x + along * ux + h * uy, a.y + along * uy - h * ux)
        }
        for (let k = 0; k < 12; k++) {
          const t = (k / 12) * Math.PI * 2
          consider(a.x + Math.cos(t) * (a.r + c.r + GAP), a.y + Math.sin(t) * (a.r + c.r + GAP))
        }
      }
      const [x, y] = best ?? [0, placed.reduce((m, p) => Math.max(m, p.y + p.r), 0) + c.r + GAP]
      c.x = x
      c.y = y
    }
    placed.push(c)
  }
  // Centre the group on the middle of its bounding box.
  const minX = Math.min(...placed.map(p => p.x - p.r))
  const maxX = Math.max(...placed.map(p => p.x + p.r))
  const minY = Math.min(...placed.map(p => p.y - p.r))
  const maxY = Math.max(...placed.map(p => p.y + p.r))
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  for (const p of placed) { p.x -= cx; p.y -= cy }
  return Math.max(...placed.map(p => Math.hypot(p.x, p.y) + p.r))
}

function size(node: Tree, sizes: Sizes): void {
  if (node.children.length === 0) {
    node.r = node.kind === 'custom' ? leafRadius(node.name, sizes.leafMin) : node.kind === 'inner' ? Math.max(62, sizes.leafMin * 1.4) : 90
    return
  }
  node.children.forEach(c => size(c, sizes))
  const inner = pack(node.children)
  // Children sit a little low so the name fits above them.
  for (const c of node.children) c.y += sizes.label / 2
  node.r = Math.max(inner + PAD + sizes.label / 2, node.kind === 'custom' ? leafRadius(node.name, sizes.leafMin) : 0)
}

function flatten(node: Tree, parent: string | null, depth: number, ox: number, oy: number, out: LaidOut[]): void {
  const x = ox + node.x
  const y = oy + node.y
  out.push({ id: node.id, kind: node.kind, name: node.name, count: node.count, parent, depth, x, y, r: node.r, hasChildren: node.children.length > 0 })
  node.children.forEach(c => flatten(c, node.id, depth + 1, x, y, out))
}

// All circles with their place, outermost first (so inner ones draw on top).
export function layoutCircles(
  circles: StudioCircle[],
  options: { innerAllowed: boolean; innerCount: number; label?: number; leafMin?: number }
): { nodes: LaidOut[]; radius: number } {
  const make = (c: StudioCircle): Tree => ({ id: c.id, kind: 'custom', name: c.name, count: c.memberCount, children: [], r: 0, x: 0, y: 0 })
  const byId = new Map(circles.map(c => [c.id, make(c)]))
  const outer: Tree = { id: 'outer', kind: 'outer', name: 'Outer Circle', count: 0, children: [], r: 0, x: 0, y: 0 }
  const inner: Tree = { id: 'inner', kind: 'inner', name: 'Inner Circle', count: options.innerCount, children: [], r: 0, x: 0, y: 0 }
  if (options.innerAllowed) outer.children.push(inner)
  for (const c of circles) {
    const node = byId.get(c.id)!
    const parent = c.parent_id ? byId.get(c.parent_id) : undefined
    if (parent && parent !== node) parent.children.push(node)
    else if (c.in_inner && options.innerAllowed) inner.children.push(node)
    else outer.children.push(node)
  }
  size(outer, { label: options.label ?? 24, leafMin: options.leafMin ?? 38 })
  const nodes: LaidOut[] = []
  flatten(outer, null, 0, 0, 0, nodes)
  return { nodes, radius: outer.r }
}

// Own circles nested inside `id` (itself included).
export function subtreeIds(nodes: LaidOut[], id: string): Set<string> {
  const ids = new Set([id])
  for (const n of nodes) if (n.parent && ids.has(n.parent)) ids.add(n.id) // nodes are outermost first
  return ids
}

// How many own circles deep a circle is (the Outer and Inner Circle count 0).
export function customDepth(nodes: LaidOut[], id: string): number {
  const byId = new Map(nodes.map(n => [n.id, n]))
  let depth = 0
  for (let n = byId.get(id); n && n.kind === 'custom'; n = n.parent ? byId.get(n.parent) : undefined) depth++
  return depth
}

// Where a circle (with what is inside it) may be moved to.
export function canMoveInto(nodes: LaidOut[], id: string, target: string): boolean {
  const moving = subtreeIds(nodes, id)
  if (moving.has(target)) return false
  const height = Math.max(...[...moving].map(m => customDepth(nodes, m))) - customDepth(nodes, id) + 1
  return customDepth(nodes, target) + height <= MAX_CUSTOM_DEPTH
}

// The innermost circle under a point, leaving out the given ones.
export function circleAt(nodes: LaidOut[], x: number, y: number, skip: Set<string>): LaidOut | null {
  let hit: LaidOut | null = null
  for (const n of nodes) {
    if (skip.has(n.id)) continue
    if (Math.hypot(n.x - x, n.y - y) <= n.r && (!hit || n.depth >= hit.depth)) hit = n
  }
  return hit
}
