// Similarity result shape and labels (lib/similarity/compare.ts).
// Safe to import from client components.

export type SimilarityLevel = 1 | 2 | 3 | 4 | 5

export const LEVEL_LABEL: Record<SimilarityLevel, string> = {
  1: 'Little in common',
  2: 'A few things in common',
  3: 'Some things in common',
  4: 'A lot in common',
  5: 'Very much in common',
}

export type SimilarityInterest = {
  label: string
  // Person keys: 'A' = the viewer, 'B' (and 'C', 'D', ... in a group) = the others.
  people: string[]
  strength: 1 | 2 | 3
  // Only for interests shared by more than one person.
  reason?: string
}

export type SimilarityResult = {
  // One-to-one: the score. Several people: the highest of `levels`.
  level: SimilarityLevel
  // Several people (Social Butterfly): the score with the viewer per person key.
  levels?: Record<string, SimilarityLevel>
  interests: SimilarityInterest[]
}
