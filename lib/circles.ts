// Circles decide who sees which Vault sections (owner decisions 2026-10-09):
// - Outer Circle: everyone who can see the profile (everyone if Public; only
//   accepted connections if Private).
// - Inner Circle: only accepted connections the owner put in it. Ambivert and
//   up (PLANS[plan].circles === 2).
// - Own circles (Social Butterfly): named groups of accepted connections, e.g.
//   "Family". A section in one (circle = 'custom' + custom_circle_id) is seen
//   only by that circle's members. A 'custom' section without a circle id is
//   seen by no one (treated as a draft).
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
