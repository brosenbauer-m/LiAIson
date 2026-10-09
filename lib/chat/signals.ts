// Chat stream signals (owner decision 2026-10-09: the LiAIson points out
// similarities with the reader; the chat page then sometimes shows a small
// Similarity note under that reply).
// - The AI ends a reply that points out something in common with
//   COMMON_MARKER. The chat route removes it from the text and, after the
//   last chunk, sends COMMON_SIGNAL instead.
// - SIGNAL_SEPARATOR never appears in normal text; the chat page shows only
//   what comes before it.
// Safe to import from client components.

export const COMMON_MARKER = '[[common]]'
export const SIGNAL_SEPARATOR = '\u001E'
export const COMMON_SIGNAL = `${SIGNAL_SEPARATOR}common`

// Splits streamed text into what is shown and whether the reply pointed out
// something in common.
export function readChatSignals(raw: string): { text: string; common: boolean } {
  const at = raw.indexOf(SIGNAL_SEPARATOR)
  if (at === -1) return { text: raw, common: false }
  return { text: raw.slice(0, at).trimEnd(), common: raw.slice(at) === COMMON_SIGNAL }
}
