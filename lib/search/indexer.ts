import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { mistral } from '@/lib/mistral/client'
import { logAiUsage } from '@/lib/usage/log'
import { getRedis } from '@/lib/redis'

// Discover AI search index (owner decisions 2026-10-09):
// only the Outer Circle of profiles that are Public AND Discoverable is indexed.
// Each section is split into short passages; each passage gets a fingerprint
// (embedding) from mistral-embed (EU). Only sections whose content changed are
// re-embedded. The database re-checks privacy on every search
// (search_match_chunks), so an index that is a little behind never leaks.
// Server-only.

export const EMBED_MODEL = 'mistral-embed'
const MAX_CHUNK = 900
const EMBED_BATCH = 32

// Same as Postgres md5(text) for UTF-8 text.
export function md5(text: string): string {
  return createHash('md5').update(text, 'utf8').digest('hex')
}

// Split a section into passages of at most ~MAX_CHUNK characters, on blank
// lines first, then on sentences.
export function splitIntoPassages(content: string): string[] {
  const paragraphs = content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  const pieces: string[] = []
  for (const paragraph of paragraphs) {
    if (paragraph.length <= MAX_CHUNK) {
      pieces.push(paragraph)
      continue
    }
    let current = ''
    for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
      if (current && current.length + sentence.length + 1 > MAX_CHUNK) {
        pieces.push(current)
        current = ''
      }
      current = current ? `${current} ${sentence}` : sentence
      while (current.length > MAX_CHUNK) {
        pieces.push(current.slice(0, MAX_CHUNK))
        current = current.slice(MAX_CHUNK)
      }
    }
    if (current) pieces.push(current)
  }
  // Join small neighbours so passages carry enough meaning.
  const passages: string[] = []
  for (const piece of pieces) {
    const last = passages[passages.length - 1]
    if (last !== undefined && last.length + piece.length + 2 <= MAX_CHUNK) {
      passages[passages.length - 1] = `${last}\n\n${piece}`
    } else {
      passages.push(piece)
    }
  }
  return passages
}

export async function embedTexts(
  texts: string[]
): Promise<{ vectors: number[][]; promptTokens: number }> {
  const vectors: number[][] = []
  let promptTokens = 0
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH)
    const response = await mistral.embeddings.create({ model: EMBED_MODEL, inputs: batch })
    const data = [...response.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    if (data.length !== batch.length) throw new Error('embedding count mismatch')
    for (const item of data) {
      if (!item.embedding || item.embedding.length !== 1024) throw new Error('bad embedding')
      vectors.push(item.embedding)
    }
    promptTokens += response.usage?.promptTokens ?? 0
  }
  return { vectors, promptTokens }
}

type SectionRow = { id: string; label: string | null; content: string | null; circle: string }

// Bring one user's index up to date. Never throws.
export async function indexUser(userId: string): Promise<'skipped' | 'cleared' | 'updated' | 'unchanged' | 'error'> {
  const redis = getRedis()
  const lockKey = `searchidx:lock:${userId}`
  try {
    const locked = await redis.set(lockKey, '1', { nx: true, ex: 120 })
    if (locked !== 'OK') return 'skipped'
  } catch {
    // Redis unavailable: index anyway (worst case a duplicate passage).
  }

  try {
    const supabase = createServiceClient()
    const { data: user } = await supabase
      .from('users')
      .select('is_discoverable, public_scope')
      .eq('id', userId)
      .maybeSingle<{ is_discoverable: boolean | null; public_scope: string | null }>()

    const searchable = !!user && user.is_discoverable === true && !!user.public_scope && user.public_scope !== 'none'
    if (!searchable) {
      const { error } = await supabase.from('search_chunks').delete().eq('user_id', userId)
      if (error) throw new Error(error.message)
      return 'cleared'
    }

    const { data: sectionRows, error: sectionsError } = await supabase
      .from('vault_sections')
      .select('id, label, content, circle')
      .eq('user_id', userId)
    if (sectionsError) throw new Error(sectionsError.message)
    const outer = ((sectionRows as SectionRow[] | null) ?? []).filter(
      s => s.circle === 'outer' && (s.content ?? '').trim().length > 0
    )

    const { data: chunkRows, error: chunksError } = await supabase
      .from('search_chunks')
      .select('section_id, section_hash')
      .eq('user_id', userId)
    if (chunksError) throw new Error(chunksError.message)
    const indexed = new Map<string, Set<string>>()
    for (const row of (chunkRows as { section_id: string; section_hash: string }[] | null) ?? []) {
      if (!indexed.has(row.section_id)) indexed.set(row.section_id, new Set())
      indexed.get(row.section_id)!.add(row.section_hash)
    }

    const wanted = new Map(outer.map(s => [s.id, md5(s.content ?? '')]))

    // Remove passages of sections that are gone from the Outer Circle, empty or changed.
    const toRemove = [...indexed.entries()]
      .filter(([sectionId, hashes]) => {
        const hash = wanted.get(sectionId)
        return !hash || hashes.size !== 1 || !hashes.has(hash)
      })
      .map(([sectionId]) => sectionId)
    if (toRemove.length > 0) {
      const { error } = await supabase.from('search_chunks').delete().eq('user_id', userId).in('section_id', toRemove)
      if (error) throw new Error(error.message)
    }

    const toAdd = outer.filter(s => !indexed.has(s.id) || toRemove.includes(s.id))
    if (toAdd.length === 0) return toRemove.length > 0 ? 'updated' : 'unchanged'

    const rows: { user_id: string; section_id: string; section_hash: string; content: string }[] = []
    for (const section of toAdd) {
      const content = section.content ?? ''
      const label = (section.label ?? '').trim()
      for (const passage of splitIntoPassages(content)) {
        rows.push({
          user_id: userId,
          section_id: section.id,
          section_hash: md5(content),
          content: label ? `${label}: ${passage}` : passage,
        })
      }
    }
    if (rows.length === 0) return 'updated'

    const { vectors, promptTokens } = await embedTexts(rows.map(r => r.content))
    await logAiUsage({
      userId,
      feature: 'index',
      model: EMBED_MODEL,
      actor: 'system',
      usage: { promptTokens, completionTokens: 0 },
    })

    const { error: insertError } = await supabase
      .from('search_chunks')
      .insert(rows.map((r, i) => ({ ...r, embedding: JSON.stringify(vectors[i]) })))
    if (insertError) throw new Error(insertError.message)
    return 'updated'
  } catch (err) {
    console.error('SEARCH_INDEX_ERROR', userId, err)
    return 'error'
  } finally {
    try {
      await redis.del(lockKey)
    } catch {
      // ignore
    }
  }
}

// Daily sweep (billing cron): users whose index is missing or out of date.
export async function indexStaleUsers(maxUsers = 15): Promise<{ checked: number; updated: number; errors: number }> {
  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('search_stale_users', { max_users: maxUsers })
  if (error) throw new Error(error.message)
  const ids = ((data as { user_id: string }[] | null) ?? []).map(r => r.user_id)
  let updated = 0
  let errors = 0
  for (const id of ids) {
    const result = await indexUser(id)
    if (result === 'error') errors++
    else if (result !== 'skipped') updated++
  }
  return { checked: ids.length, updated, errors }
}
