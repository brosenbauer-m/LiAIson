export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Import text from a PDF or Word (.docx) file into the Vault.
// The file is only read in memory to extract its text and is NOT stored anywhere.
// Nothing is saved here: the owner reviews and edits the text first, and the
// Vault page saves only the text they approve (source = 'file_extracted').

const MAX_FILE_BYTES = 4 * 1024 * 1024 // 4 MB (Vercel request limit is 4.5 MB)
const MAX_TEXT_CHARS = 20000

const PDF_TYPE = 'application/pdf'
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

function detectKind(file: File): 'pdf' | 'docx' | null {
  const name = file.name.toLowerCase()
  if (file.type === PDF_TYPE || name.endsWith('.pdf')) return 'pdf'
  if (file.type === DOCX_TYPE || name.endsWith('.docx')) return 'docx'
  return null
}

function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'The file could not be read. Please try again.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'That file is too large. The limit is 4 MB.' }, { status: 400 })
  }

  const kind = detectKind(file)
  if (!kind) {
    return NextResponse.json({ error: 'Only PDF and Word (.docx) files are supported.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let extracted = ''

  try {
    if (kind === 'pdf') {
      const { extractText } = await import('unpdf')
      const { text } = await extractText(new Uint8Array(buffer))
      extracted = Array.isArray(text) ? text.join('\n') : text
    } else {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      extracted = result.value
    }
  } catch {
    return NextResponse.json({ error: "We couldn't read text from that file." }, { status: 422 })
  }

  const text = cleanText(extracted)
  if (!text) {
    return NextResponse.json(
      { error: 'No text was found in that file. Scanned documents (images) are not supported.' },
      { status: 422 }
    )
  }

  return NextResponse.json({
    fileName: file.name,
    text,
    truncated: extracted.trim().length > MAX_TEXT_CHARS,
  })
}
