import { Mistral } from '@mistralai/mistralai'

// All AI requests go to Mistral's EU regional endpoint (https://api.eu.mistral.ai),
// so they are processed only in EU/EFTA data centres. The global endpoint makes
// no location commitment. Owner decision 2026-10-08: EU only.
export const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
  server: 'eu',
})

export const CHAT_MODEL = 'mistral-medium-latest'
export const FAST_MODEL = 'mistral-small-latest'

// Text of a Mistral message or stream delta (a string, or a list of chunks of
// which only the text ones count).
export function messageText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(
      (chunk): chunk is { type: 'text'; text: string } =>
        typeof chunk === 'object' && chunk !== null && 'type' in chunk &&
        chunk.type === 'text' && 'text' in chunk && typeof chunk.text === 'string'
    )
    .map(chunk => chunk.text)
    .join('')
}
