// Circles decide who sees which Vault sections (owner decisions 2026-10-09):
// - Outer Circle: everyone who can see the profile (everyone if Public; only
//   accepted connections if Private).
// - Inner Circle: only accepted connections the owner put in it. Ambivert and
//   up (PLANS[plan].circles === 2).
// - Own circles (Social Butterfly): named groups of accepted connections, e.g.
//   "Family". A section in one (circle = 'custom' + custom_circle_id) is seen
//   only by that circle's members. A 'custom' section without a circle id is
//   seen by no one (treated as a draft).
// - Circles are nested (owner decision 2026-10-10): everyone in a circle also
//   sees every circle around it. An own circle sits directly in the Outer
//   Circle, in the Inner Circle, or inside another own circle (parent_id), so
//   Outer > Inner > Family, or Outer > Climbing club > Coaches.
// - Draft: only the owner; never used by their LiAIson.
// Replaces the old Professional / Personal flags.

export type Circle = 'outer' | 'inner' | 'draft' | 'custom'
export type BasicCircle = Exclude<Circle, 'custom'>
export type VisibleCircle = 'outer' | 'inner'

export const CIRCLES: Circle[] = ['outer', 'inner', 'draft', 'custom']

export function isCircle(value: unknown): value is Circle {
  return typeof value === 'string' && (CIRCLES as string[]).includes(value)
}

export const CIRCLE_LABEL: Record<BasicCircle, string> = {
  outer: 'Outer Circle',
  inner: 'Inner Circle',
  draft: 'Drafts',
}

export const CIRCLE_HELP: Record<BasicCircle, string> = {
  outer: 'Everyone who can see your profile.',
  inner: 'Only people you put in your Inner Circle.',
  draft: 'Only you. Your LiAIson does not use drafts.',
}

// One of the owner's own circles (Social Butterfly).
export type CustomCircle = { id: string; name: string }

// Where an own circle sits (custom_circles.parent_id / in_inner).
export type CircleNode = { id: string; parent_id: string | null; in_inner: boolean }

// The circle and every own circle around it, innermost first. The last one
// decides (by in_inner) whether the Inner Circle is around them. Unknown ids
// give []; a loop (never stored, see migration 30) is cut off.
export function circleChain<T extends CircleNode>(id: string, byId: Map<string, T>): T[] {
  const chain: T[] = []
  const seen = new Set<string>()
  let node = byId.get(id)
  while (node && !seen.has(node.id)) {
    seen.add(node.id)
    chain.push(node)
    node = node.parent_id ? byId.get(node.parent_id) : undefined
  }
  return chain
}

// Where a section is: a basic circle, or `c:<id>` for an own circle.
export type Placement = BasicCircle | `c:${string}`

export function placementOf(section: { circle?: Circle | null; custom_circle_id?: string | null }): Placement {
  if (section.circle === 'custom') return section.custom_circle_id ? `c:${section.custom_circle_id}` : 'draft'
  return section.circle ?? 'outer'
}

export function placementFields(placement: Placement): { circle: Circle; custom_circle_id: string | null } {
  if (placement.startsWith('c:')) return { circle: 'custom', custom_circle_id: placement.slice(2) }
  return { circle: placement as BasicCircle, custom_circle_id: null }
}

export function placementLabel(placement: Placement, circles: CustomCircle[]): string {
  if (!placement.startsWith('c:')) return CIRCLE_LABEL[placement as BasicCircle]
  return circles.find(c => c.id === placement.slice(2))?.name ?? 'Own circle'
}

export function placementHelp(placement: Placement, circles: CustomCircle[]): string {
  if (!placement.startsWith('c:')) return CIRCLE_HELP[placement as BasicCircle]
  return `Only people you put in ${placementLabel(placement, circles)}.`
}
