// Circles decide who sees which Vault sections (owner decisions 2026-10-09):
// - Outer Circle: everyone who can see the profile (everyone if Public; only
//   accepted connections if Private).
// - Inner Circle: only accepted connections the owner put in it. Ambivert and
//   Extrovert only (PLANS[plan].circles === 2).
// - Draft: only the owner; never used by their LiAIson.
// Replaces the old Professional / Personal flags.

export type Circle = 'outer' | 'inner' | 'draft'
export type VisibleCircle = Exclude<Circle, 'draft'>

export const CIRCLES: Circle[] = ['outer', 'inner', 'draft']

export function isCircle(value: unknown): value is Circle {
  return typeof value === 'string' && (CIRCLES as string[]).includes(value)
}

export const CIRCLE_LABEL: Record<Circle, string> = {
  outer: 'Outer Circle',
  inner: 'Inner Circle',
  draft: 'Drafts',
}

export const CIRCLE_HELP: Record<Circle, string> = {
  outer: 'Everyone who can see your profile.',
  inner: 'Only people you put in your Inner Circle.',
  draft: 'Only you. Your LiAIson does not use drafts.',
}
