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
  // Older results only: one size value (1 to 5, or 1 to 3). Newer results
  // keep it as the highest of `scores` so they still draw anywhere.
  strength: number
  // How much the topic matters to each person who has it (owner decision
  // 2026-10-27), 1 = a passing mention … 5 = central to who they are. Keyed by
  // person ('A' = the viewer). Drives bubble size and position; never shown.
  scores?: Record<string, number>
  // Only for interests shared by more than one person.
  reason?: string
}

export type SimilarityResult = {
  // One-to-one: the score. Several people: the highest of `levels`.
  level: SimilarityLevel
  // Several people (Social Butterfly): the score with the viewer per person key
  // (only when the viewer is part of the chart).
  levels?: Record<string, SimilarityLevel>
  // Several people: the score between two of the others, keyed "B-C" (letters sorted).
  pairs?: Record<string, SimilarityLevel>
  // Several people: whether the viewer ('A') is part of the chart.
  includesViewer?: boolean
  interests: SimilarityInterest[]
}
